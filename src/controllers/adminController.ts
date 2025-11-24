import {
	Body,
	Controller,
	Get,
	// Middlewares,
	Post,
	Query,
	Request,
	Route,
	Security,
	SuccessResponse,
	Tags,
} from 'tsoa';
import { db as DB } from '../db/index';
import schemas from '../db/schemas/index';
import { and, eq, gt } from 'drizzle-orm';
import Utils from '../utils';
import config from '../config';
import { createActionResult, withPagination } from '../db/helpers/withPagination';
import { CreateUserSchema } from './helpers/zod/userSchemas';
import { APIResponse, PaginatedResult } from '../types/response';
import { CreateUserInputBody, UserWithRelationship } from '../types/user';
import logger, { Logger } from '../utils/logger';
import { Request as AuthRequest } from 'express';
// import { addJobToQueue as addEmailJob } from '../workers/queue';
import { sendUserVerificationEmail } from '../services/emailService';
// import {
// 	adminMiddleware,
// 	authenticateMiddleware,
// 	staffMiddleware,
// } from '../middlewares/authMiddleware';

/**
 * Controller for handling all admin-related operations.
 * This class includes methods for creating new admin users, fetching paginated
 * lists of all users and organizers, and other administrative tasks.
 *
 * @class AdminController
 */
@Route('admin')
@Tags('Admin')
export class AdminController extends Controller {
	private log: Logger;

	/**
	 * Constructs the AdminController, initializing the logger and Redis client.
	 * All methods are bound to 'this' to ensure they can be used as Express middleware.
	 */
	constructor() {
		super();
		this.log = logger('[ADMIN_CONTROLLER]');

		// Bind all method handlers to this instance to ensure correct context
		// when they are passed as Express route handlers.
		this.createAdmin = this.createAdmin.bind(this);
		this.getAllUsers = this.getAllUsers.bind(this);
		this.getAllOrganizers = this.getAllOrganizers.bind(this);
	}

	/**
	 * Creates a new admin user account with a given email and password.
	 *
	 * @param {AuthRequest} req The Express request object containing the user's details.
	 * @param {CreateUserInputBody} requestBody The requst body object with zod validattion.
	 *
	 * @step 1 Validate the request body using Zod schema.
	 * @step 2 Check for an existing user with the same email.
	 * @step 3 Start a database transaction to ensure atomicity for user, account, and settings creation.
	 * @step 4 Within the transaction: encrypt the password, insert the new user (with the 'admin' role), create a linked account, and set default user settings.
	 * @step 5 Generate and store an email verification token in Redis.
	 * @step 6 Queue an email job to send the verification link to the new admin.
	 * @step 7 Return the newly created admin user and their settings.
	 *
	 * @returns {Promise<APIResponse<null>>} Response from creating the user
	 */
	@Post('')
	@SuccessResponse('201')
	public async createAdmin(
		@Request() req: AuthRequest,
		@Body() requestBody: CreateUserInputBody,
	): Promise<APIResponse<null>> {
		try {
			// Step 1: Validate request body
			const userDataParseResult = CreateUserSchema.safeParse(requestBody);
			if (!userDataParseResult.success) {
				const resError = await createActionResult<null>(
					false,
					null,
					'VALIDATION_ERROR',
					userDataParseResult.error.issues
						.map((issue) => `${issue.message} for field/s [${issue.path.join(',')}]`)
						.join(', '),
				);
				this.setStatus(400);
				return resError;
			}
			const userData = userDataParseResult.data;
			const now = new Date();

			// Step 2: Check for existing user
			const existingUser = await DB.query.user.findFirst({
				where: eq(schemas.user.email, userData.email),
			});
			if (existingUser) {
				const resError = await createActionResult<null>(
					false,
					null,
					'USER_ALREADY_EXISTS',
					'A user with this email already exists.',
				);
				this.setStatus(409);
				return resError;
			}

			// Step 3 & 4: Start transaction and create user records
			await DB.transaction(async (tx) => {
				const hashedPassword = await Utils.AuthUtils.hashPassword(userData.password);

				const [createdUser] = await tx
					.insert(schemas.user)
					.values({
						...userData,
						role: 'admin', // Explicitly set the role to 'admin'
						banned: false,
						lastLogin: now,
						createdAt: now,
						updatedAt: now,
					})
					.returning();

				if (!createdUser) {
					const resError = await createActionResult<null>(
						false,
						null,
						'USER_NOT_CREATED',
						'Failed to create user.',
					);
					this.setStatus(500);
					return resError;
				}

				await tx.insert(schemas.account).values({
					userId: createdUser.id,
					password: hashedPassword,
					providerId: 'email_password',
					accountId: createdUser.id,
					createdAt: now,
					updatedAt: now,
				});

				const userSettingsData = {
					userId: createdUser.id,
					notification: { email: true, sms: false, push: false },
				};
				const [userSettingsCreated] = await tx
					.insert(schemas.userSettings)
					.values(userSettingsData)
					.returning();

				const verifyToken = await Utils.AuthUtils.generateToken(
					{
						email: createdUser.email,
						id: createdUser.id,
						now: new Date().toISOString(),
					},
					config.JWT_SECRET as string,
					30 * 60,
				);
				const tokenKey = `verifyEmail:${createdUser.id}`;
				await req.redisClient?.set(tokenKey, verifyToken, { EX: 30 * 60 });

				// Step 6: Queue email job
				// await addEmailJob('emailQueue', {
				// 	to: createdUser.email,
				// 	type: 'emailVerification',
				// 	token: verifyToken,
				// 	callbackUrl: config.EMAIL_VERIFICATION_URL,
				// });

				await sendUserVerificationEmail(
					verifyToken,
					createdUser.email,
					config.EMAIL_VERIFICATION_URL,
				);

				return { settings: userSettingsCreated, newUser: createdUser };
			});

			// Step 7: Return success response
			const resData = await createActionResult(
				true,
				null,
				undefined,
				'Admin user created successfully. Please verify their email.',
			);
			this.setStatus(201);
			return resData;
		} catch (error: any) {
			this.log.error('Error creating admin user:', error);
			const resError = await createActionResult<null>(
				false,
				null,
				'CREATE_ADMIN_ERROR',
				error.message || 'Failed to create admin user.',
			);
			return resError;
		}
	}

	/**
	 * Gets a paginated list of all general users with their settings.
	 *
	 * @param {number} pageSize Defaults to 10.
	 * @param {Date | undefined} nextCursor What cursor field to work with.
	 * @param {boolean | undefined} emailVerified If the user's email is verified.
	 *
	 * @step 1 Build a dynamic array of Drizzle ORM `where` conditions.
	 * @step 2 Add conditions for email verification status and cursor-based pagination.
	 * @step 3 Execute the Drizzle query to fetch users with their settings, applying the role filter.
	 * @step 4 Use the pagination helper function to format the results and determine the next cursor.
	 * @step 5 Return the paginated user data in a success response.
	 *
	 * @returns {Promise<APIResponse<PaginatedResult<UserWithRelationship|null>>>} Return response
	 */
	@Get('')
	@SuccessResponse('200')
	@Security('bearer', ['admin', 'staff'])
	public async getAllUsers(
		@Query() pageSize: number = 10,
		@Query() nextCursor?: Date,
		@Query() emailVerified?: boolean,
	): Promise<APIResponse<PaginatedResult<UserWithRelationship> | null>> {
		try {
			// Step 1 & 2: Build dynamic WHERE conditions
			const whereConditions = [];
			if (emailVerified !== undefined) {
				whereConditions.push(eq(schemas.user.emailVerified, emailVerified));
			}
			if (nextCursor) {
				whereConditions.push(gt(schemas.user.createdAt, nextCursor));
			}

			// Step 3: Execute the Drizzle query
			const usersData = await DB.query.user.findMany({
				with: { userSettings: true },
				where: and(...whereConditions, eq(schemas.user.role, 'user')),
				orderBy: (users, { asc }) => asc(users.createdAt),
				limit: pageSize + 1,
			});

			// Step 4 Format results with pagination helper
			const paginatedResult = await withPagination(usersData, pageSize, 'createdAt');

			// Step 5: Return success response
			const successResult = await createActionResult(
				true,
				paginatedResult,
				undefined,
				'Users fetched successfully.',
			);
			this.setStatus(200);
			return successResult;
		} catch (error: any) {
			this.log.error('Error fetching users:', error);
			const resError = await createActionResult<null>(
				false,
				null,
				'FETCH_USERS_ERROR',
				error.message || 'Failed to fetch users.',
			);
			this.setStatus(500);
			return resError;
		}
	}

	/**
	 * Gets a paginated list of all organizers with their related accounts and settings.
	 *
	 * @param {number} pageSize Defaults to 10.
	 * @param {Date | undefined} nextCursor What cursor field to work with.
	 * @param {boolean | undefined} emailVerified If the user's email is verified.
	 *
	 * @step 1 Build a dynamic array of Drizzle ORM `where` conditions.
	 * @step 2 Add conditions for email verification status and cursor-based pagination.
	 * @step 3 Execute the Drizzle query to fetch organizers with their related data, applying the role filter.
	 * @step 4 Use the pagination helper function to format the results and determine the next cursor.
	 * @step 5 Return the paginated organizer data in a success response.
	 *
	 * @returns {Promise<APIResponse<PaginatedResult<UserWithRelationship|null>>>} Return response
	 */
	@Get('/organizers')
	@SuccessResponse('200')
	@Security('bearer', ['admin', 'staff'])
	public async getAllOrganizers(
		@Query('pageSize') pageSize: number = 10,
		@Query('nextCursor') nextCursor?: Date,
		@Query('emailVerified') emailVerified?: boolean,
	): Promise<APIResponse<PaginatedResult<UserWithRelationship> | null>> {
		try {
			// Step 1 & 2: Build dynamic WHERE conditions
			const whereConditions = [];
			if (emailVerified !== undefined) {
				whereConditions.push(eq(schemas.user.emailVerified, emailVerified));
			}
			if (nextCursor) {
				whereConditions.push(gt(schemas.user.createdAt, nextCursor));
			}

			// Step 3: Execute the Drizzle query
			const usersData = await DB.query.user.findMany({
				with: {
					userSettings: true,
					organiser: {
						with: {
							wallet: true,
						},
					},
					organizerPayoutAccount: true,
				},
				where: and(...whereConditions, eq(schemas.user.role, 'hoster')),
				orderBy: (users, { asc }) => asc(users.createdAt),
				limit: pageSize + 1,
			});

			// Step 4: Format results with pagination helper
			const paginatedResult = await withPagination(usersData, pageSize, 'createdAt');

			// Step 5: Return success response
			const successResult = await createActionResult(
				true,
				paginatedResult,
				undefined,
				'Organizers fetched successfully.',
			);
			this.setStatus(200);
			return successResult;
		} catch (error: any) {
			this.log.error('Error fetching organizers:', error);
			const resError = await createActionResult<null>(
				false,
				null,
				'FETCH_ORGANIZERS_ERROR',
				error.message || 'Failed to fetch organizers.',
			);
			this.setStatus(500);
			return resError;
		}
	}

	/**
	 * Gets a paginated list of all staffs with their related accounts and settings.
	 *
	 * @param {number} pageSize Defaults to 10.
	 * @param {Date | undefined} nextCursor What cursor field to work with.
	 * @param {boolean | undefined} emailVerified If the user's email is verified.
	 *
	 * @step 1 Build a dynamic array of Drizzle ORM `where` conditions.
	 * @step 2 Add conditions for email verification status and cursor-based pagination.
	 * @step 3 Execute the Drizzle query to fetch organizers with their related data, applying the role filter.
	 * @step 4 Use the pagination helper function to format the results and determine the next cursor.
	 * @step 5 Return the paginated organizer data in a success response.
	 *
	 * @returns {Promise<APIResponse<PaginatedResult<UserWithRelationship|null>>>} Return response
	 */
	@Get('/staffs')
	@Security('bearer', ['admin'])
	@SuccessResponse('200', 'Fetched all staffs')
	public async getAllStaffs(
		@Query() pageSize: number = 10,
		@Query() nextCursor?: Date,
		@Query() emailVerified?: boolean,
	): Promise<APIResponse<PaginatedResult<UserWithRelationship> | null>> {
		try {
			// Step 1 & 2: Build dynamic WHERE conditions
			const whereConditions = [];
			if (emailVerified !== undefined) {
				whereConditions.push(eq(schemas.user.emailVerified, emailVerified));
			}
			if (nextCursor) {
				whereConditions.push(gt(schemas.user.createdAt, nextCursor));
			}

			// Step 3: Execute the Drizzle query
			const usersData = await DB.query.user.findMany({
				with: {
					userSettings: true,
				},
				where: and(...whereConditions, eq(schemas.user.role, 'staff')),
				orderBy: (users, { asc }) => asc(users.createdAt),
				limit: pageSize + 1,
			});

			// Step 4: Format results with pagination helper
			const paginatedResult = await withPagination(usersData, pageSize, 'createdAt');

			// Step 5: Return success response
			const successResult = await createActionResult(
				true,
				paginatedResult,
				undefined,
				'Organizers fetched successfully.',
			);
			this.setStatus(200);
			return successResult;
		} catch (error: any) {
			this.log.error('Error fetching organizers:', error);
			const resError = await createActionResult<null>(
				false,
				null,
				'FETCH_ORGANIZERS_ERROR',
				error.message || 'Failed to fetch organizers.',
			);
			this.setStatus(500);
			return resError;
		}
	}
}
