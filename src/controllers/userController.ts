import { db as DB } from '../db';
import {
	GetSSOAccounts,
	UpdateUserInputBody,
	UpdateUserSettingsInputBody,
	UserWithRelationship,
	UserSettings,
	User,
	BecomeOrganiserInputBody,
} from '../types/user';
import { createActionResult } from '../db/helpers/withPagination';
import { APIResponse } from '../types/response';
import {
	UpdateUserSchema,
	BecomeOrganiserSchema,
	UserSettingsSchema as UpdateUserSettingsSchema,
} from './helpers/zod/userSchemas';
import schemas from '../db/schemas';
import { and, eq } from 'drizzle-orm';
import logger, { Logger } from '../utils/logger';
import { clearAuthTokens } from './helpers/generators';
import {
	Body,
	Controller,
	Delete,
	Get,
	Path,
	Post,
	Put,
	Request,
	Route,
	Security,
	SuccessResponse,
	Tags,
} from 'tsoa';
import { AuthRequest } from '../types/express';
import { createPaystackCustomer } from '../utils/paystack';

/**
 * @summary Controller for handling user-related operations, including creating organisers.
 *
 * @class UserController
 */
@Route('users')
@Tags('Users')
export class UserController extends Controller {
	// @ts-ignore
	private log: Logger;

	constructor() {
		super();
		this.log = logger('[USER_CONTROLLER]');
	}

	/**
	 * @summary Retrieves the details of the currently authenticated user.
	 *

	 * @param {AuthRequest} req The Express request object containing the authenticated user.
	 * @returns {Promise<APIResponse<UserWithRelationship | null>>} A JSON response with the user's data on success, or an error.
	 *
	 * @step 1 Check if the user is authenticated from the `req.activeUser` object.
	 * @step 2 If the user is authenticated, retrieve their details including related settings and organiser profiles.
	 * @step 3 Return the user's data in a success response.
	 */
	@Get('me')
	@SuccessResponse('200', 'User data fetched successfully')
	@Security('bearer', [])
	public async getMe(
		@Request() req: AuthRequest,
	): Promise<APIResponse<UserWithRelationship | null>> {
		try {
			const { user } = schemas;
			// Step 1: Check if user is authenticated
			if (!req.activeUser) {
				const resError = await createActionResult<null>(
					false,
					null,
					'NOT_AUTHENTICATED',
					'User is not authenticated.',
				);
				this.setStatus(401);
				return resError;
			}

			// Step 2: Retrieve full user details with relations
			const currentUser = await DB.query.user.findFirst({
				where: eq(user.id, req.activeUser.id),
				with: {
					userSettings: true,
					organiser: {
						with: {
							wallet: true,
						},
					},
					organizerPayoutAccount: true,
					accounts: {
						columns: {
							id: true,
							providerId: true,
							userId: true,
							createdAt: true,
							updatedAt: true,
						},
					},
				},
			});

			if (!currentUser) {
				const resError = await createActionResult<null>(
					false,
					null,
					'USER_NOT_FOUND',
					'User not found.',
				);
				this.setStatus(404);
				return resError;
			}

			// Step 3: Return the user's data
			const resData = await createActionResult<UserWithRelationship>(
				true,
				currentUser,
				undefined,
				'User data fetched successfully.',
			);

			this.setStatus(200);
			return resData;
		} catch (error: any) {
			this.log.error('Error fetching current user:', error);
			const resError = await createActionResult<null>(
				false,
				null,
				'FETCH_USER_ERROR',
				error.message || 'Failed to fetch user data.',
			);
			this.setStatus(500);
			return resError;
		}
	}

	/**
	 * @summary Retrieves a user by their ID.
	 *

	 * @returns {Promise<APIResponse<UserWithRelationship | null>>} A JSON response with the user's data on success, or an error.
	 *
	 * @step 1 Get the user ID from the request parameters.
	 * @step 2 Query the database for the user with the specified ID, including their related data.
	 * @step 3 Handle cases where the user is not found.
	 * @step 4 Return the user's data in a success response.
	 */
	@Get('{userId}')
	@SuccessResponse('200', 'User fetched successfully')
	@Security('bearer', ['admin', 'staff'])
	public async getUserById(
		@Path() userId: string,
	): Promise<APIResponse<UserWithRelationship | null>> {
		try {
			const { user } = schemas;
			// Step 1: Get user ID from parameters
			if (!userId) {
				const resError = await createActionResult<null>(
					false,
					null,
					'VALIDATION_ERROR',
					'User ID parameter is required.',
				);
				this.setStatus(400);
				return resError;
			}

			// Step 2: Query the database for the user with relations
			const fetchedUser = await DB.query.user.findFirst({
				where: eq(user.id, userId),
				with: {
					userSettings: true,
					organiser: true,
					accounts: {
						columns: {
							id: true,
							providerId: true,
							userId: true,
							createdAt: true,
							updatedAt: true,
						},
					},
				},
			});

			// Step 3: Handle user not found
			if (!fetchedUser) {
				const resError = await createActionResult<null>(
					false,
					null,
					'USER_NOT_FOUND',
					'User not found.',
				);
				this.setStatus(404);
				return resError;
			}

			// Step 4: Return user data
			const resData = await createActionResult<UserWithRelationship>(
				true,
				fetchedUser as UserWithRelationship,
				undefined,
				'User fetched successfully.',
			);
			this.setStatus(200);
			return resData;
		} catch (error: any) {
			this.log.error('Error fetching user by ID:', error);
			const resError = await createActionResult<null>(
				false,
				null,
				'FETCH_USER_ERROR',
				error.message || 'Failed to fetch user.',
			);
			this.setStatus(500);
			return resError;
		}
	}

	// /**
	//  * Retrieves a user by their email address.
	//  *

	//  * @returns {Promise<APIResponse<UserWithRelationship | null>>} A JSON response with the user's data on success, or an error.
	//  *
	//  * @step 1 Get the email from the request query.
	//  * @step 2 Query the database for the user with the specified email, including their related data.
	//  * @step 3 Handle cases where the user is not found.
	//  * @step 4 Return the user's data in a success response.
	//  */
	// @Get('{email}')
	// @SuccessResponse('200', 'User fetched successfully')
	// @Security('bearer', ['admin', 'staff'])
	// public async getUserByEmail(
	// 	@Path() email: string,
	// ): Promise<APIResponse<UserWithRelationship | null>> {
	// 	try {
	// 		const { user } = schemas;
	// 		// Step 1: Get email from query
	// 		if (!email) {
	// 			const resError = await createActionResult<null>(
	// 				false,
	// 				null,
	// 				'VALIDATION_ERROR',
	// 				'Email query parameter is required.',
	// 			);
	// 			this.setStatus(400);
	// 			return resError;
	// 		}

	// 		// Step 2: Query the database for the user with relations
	// 		const fetchedUser = await DB.query.user.findFirst({
	// 			where: eq(user.email, email),
	// 			with: {
	// 				userSettings: true,
	// 				organiser: true,
	// 				accounts: {
	// 					columns: {
	// 						id: true,
	// 						providerId: true,
	// 						userId: true,
	// 						createdAt: true,
	// 						updatedAt: true,
	// 					},
	// 				},
	// 			},
	// 		});

	// 		// Step 3: Handle user not found
	// 		if (!fetchedUser) {
	// 			const resError = await createActionResult<null>(
	// 				false,
	// 				null,
	// 				'USER_NOT_FOUND',
	// 				'User not found.',
	// 			);
	// 			this.setStatus(404);
	// 			return resError;
	// 		}

	// 		// Step 4: Return user data
	// 		const resData = await createActionResult<UserWithRelationship>(
	// 			true,
	// 			fetchedUser,
	// 			undefined,
	// 			'User fetched successfully.',
	// 		);
	// 		this.setStatus(200);

	// 		return resData;
	// 	} catch (error: any) {
	// 		this.log.error('Error fetching user by email:', error);
	// 		const resError = await createActionResult<null>(
	// 			false,
	// 			null,
	// 			'FETCH_USER_ERROR',
	// 			error.message || 'Failed to fetch user.',
	// 		);
	// 		this.setStatus(500);
	// 		return resError;
	// 	}
	// }

	/**
	 * @summary Retrieves all social accounts linked to a user.
	 *

	 * @returns {Promise<APIResponse<GetSSOAccounts[] | null>>} A JSON response with the list of social accounts.
	 *
	 * @step 1 Get the user ID from the request parameters.
	 * @step 2 Query the database for all accounts linked to the user, excluding password-based accounts.
	 * @step 3 Return the list of social accounts.
	 */
	@Get('{userId}/social-signup-option-accounts')
	@SuccessResponse('200', 'Social accounts fetched successfully')
	@Security('bearer', [])
	public async getUserSSOAccounts(
		@Path() userId: string,
	): Promise<APIResponse<GetSSOAccounts[] | null>> {
		try {
			const { account } = schemas;

			// Step 1: Get user ID from parameters
			if (!userId) {
				const resError = await createActionResult<null>(
					false,
					null,
					'VALIDATION_ERROR',
					'User ID parameter is required.',
				);
				this.setStatus(400);
				return resError;
			}

			// Step 2: Query the database for social accounts
			const ssoAccounts = await DB.select({
				id: account.id,
				providerId: account.providerId,
				accountId: account.accountId,
				userId: account.userId,
				createdAt: account.createdAt,
				updatedAt: account.updatedAt,
				// Exclude sensitive fields
				// password: account.password, // Exclude password field
				// accessToken: account.accessToken, // Exclude access token field
			})
				.from(account)
				.where(
					and(
						eq(account.userId, userId),
						// Exclude password-based accounts
						eq(account.providerId, 'google'),
						// Add other social providers here
					),
				);

			// Step 3: Handle case where no accounts are found create them
			if (ssoAccounts.length === 0) {
				const resError = await createActionResult<null>(
					false,
					null,
					'NO_ACCOUNTS_FOUND',
					'No SSO accounts found for this user.',
				);
				this.setStatus(404);
				return resError;
			}

			// Step 4: Return the list of social accounts
			const resData = await createActionResult(
				true,
				ssoAccounts,
				undefined,
				'Social accounts fetched successfully.',
			);
			this.setStatus(200);
			return resData;
		} catch (error: any) {
			this.log.error('Error fetching user SSO accounts:', error);
			const resError = await createActionResult<null>(
				false,
				null,
				'FETCH_SSO_ACCOUNTS_ERROR',
				error.message || 'Failed to fetch social accounts.',
			);
			this.setStatus(500);
			return resError;
		}
	}

	/**
	 * @summary Updates a user's profile information.
	 *

	 * @returns {Promise<APIResponse<User | null>>} A JSON response with the updated user data.
	 *
	 * @step 1 Validate the request body with a Zod schema.
	 * @step 2 Get the user ID from the authenticated user.
	 * @step 3 Update the user record in the database with the provided data.
	 * @step 4 Return the updated user record.
	 */
	@Put('{userId}')
	@SuccessResponse('200', 'Updated profile data successfully')
	@Security('bearer', [])
	public async updateUser(
		@Path() userId: string,
		@Body() requestBody: UpdateUserInputBody,
	): Promise<APIResponse<User | null>> {
		try {
			const { user } = schemas;
			// Step 1: Validate request body
			const validation = UpdateUserSchema.safeParse(requestBody);
			if (!validation.success) {
				const resError = await createActionResult<null>(
					false,
					null,
					'VALIDATION_ERROR',
					validation.error.issues
						.map((issue) => `${issue.message} for field/s [${issue.path.join(',')}]`)
						.join(', '),
				);
				this.setStatus(400);
				return resError;
			}

			// Step 2: Get user ID from authenticated user
			if (!userId) {
				const resError = await createActionResult(
					false,
					null,
					'UNAUTHORIZED',
					'User not authenticated.',
				);
				this.setStatus(401);
				return resError;
			}

			// Step 3: Update the user record
			const [updatedUser] = await DB.update(user)
				.set({ ...validation.data, updatedAt: new Date() })
				.where(eq(user.id, userId))
				.returning();

			if (!updatedUser) {
				const resError = await createActionResult(
					false,
					null,
					'USER_NOT_FOUND',
					'User not found or you do not have permission to update it.',
				);
				this.setStatus(404);
				return resError;
			}

			// Step 4: Return the updated user
			const resData = await createActionResult<User>(
				true,
				updatedUser,
				undefined,
				'User updated successfully.',
			);
			this.setStatus(200);
			return resData;
		} catch (error: any) {
			this.log.error('Error updating user:', error);
			const resError = await createActionResult<null>(
				false,
				null,
				'UPDATE_USER_ERROR',
				error.message || 'Failed to update user.',
			);
			this.setStatus(500);
			return resError;
		}
	}

	/**
	 * @summary Deletes a user account.
	 *

	 * @returns {Promise<APIResponse<null>>} A JSON response indicating success or failure.
	 *
	 * @step 1 Get the user ID from the authenticated user.
	 * @step 2 Start a database transaction to ensure all related data is deleted atomically.
	 * @step 3 Delete the user record, which will cascade to other related tables.
	 * @step 4 Clear authentication tokens.
	 * @step 5 Return a success response.
	 */
	@Delete('{userId}')
	@SuccessResponse('200', 'User deleted successfully')
	@Security('bearer', [])
	public async deleteUser(
		@Path() userId: string,
		@Request() req: AuthRequest,
	): Promise<APIResponse<null>> {
		try {
			const { user } = schemas;

			// Step 1: Get user ID from authenticated user
			if (!userId) {
				const resError = await createActionResult(
					false,
					null,
					'UNAUTHORIZED',
					'User not authenticated.',
				);
				this.setStatus(401);
				return resError;
			}

			// Step 2 & 3: Delete user record within a transaction
			await DB.transaction(async (tx) => {
				await tx.delete(user).where(eq(user.id, userId));
				// The Drizzle ORM relations handle cascading deletes, so no need for explicit deletion of sessions, accounts, etc.
			});

			// Step 4: Clear authentication tokens (assuming a clearAuthTokens helper exists)
			await clearAuthTokens(userId, req);

			// Step 5: Return a success response
			const resData = await createActionResult<null>(
				true,
				null,
				undefined,
				'User deleted successfully.',
			);
			this.setStatus(200);
			return resData;
		} catch (error: any) {
			this.log.error('Error deleting user:', error);
			const resError = await createActionResult<null>(
				false,
				null,
				'DELETE_USER_ERROR',
				error.message || 'Failed to delete user.',
			);
			this.setStatus(500);
			return resError;
		}
	}

	/**
	 * @summary Updates a user's settings.
	 *

	 * @returns {Promise<APIResponse<UserSettings | null>>} A JSON response with the updated user settings.
	 *
	 * @step 1 Validate the request body.
	 * @step 2 Get the user ID from the authenticated user.
	 * @step 3 Update the `userSettings` record.
	 * @step 4 Return the updated settings.
	 */
	@Put('{userId}/settings')
	@SuccessResponse('200', 'User settings updated successfully')
	@Security('bearer', [])
	public async updateUserSettings(
		@Path() userId: string,
		@Body() requestBody: UpdateUserSettingsInputBody,
	): Promise<APIResponse<UserSettings | null>> {
		try {
			const { userSettings } = schemas;

			// Step 1: Validate request body
			const validation = UpdateUserSettingsSchema.safeParse(requestBody);
			if (!validation.success) {
				const resError = await createActionResult(
					false,
					null,
					'VALIDATION_ERROR',
					validation.error.issues
						.map((issue) => `${issue.message} for field/s [${issue.path.join(',')}]`)
						.join(', '),
				);
				this.setStatus(400);
				return resError;
			}

			// Step 2: Get user ID from authenticated user
			if (!userId) {
				const resError = await createActionResult(
					false,
					null,
					'UNAUTHORIZED',
					'User not authenticated.',
				);
				this.setStatus(401);
				return resError;
			}

			// Step 3: Update user settings
			const [updatedSettings] = await DB.update(userSettings)
				.set({ ...validation.data, updatedAt: new Date() })
				.where(eq(userSettings.userId, userId))
				.returning();

			if (!updatedSettings) {
				const resError = await createActionResult(
					false,
					null,
					'USER_SETTINGS_NOT_FOUND',
					'User settings not found or you do not have permission to update them.',
				);
				this.setStatus(404);
				return resError;
			}

			// Step 4: Return the updated settings
			const resData = await createActionResult<UserSettings>(
				true,
				updatedSettings,
				undefined,
				'User settings updated successfully.',
			);
			this.setStatus(200);
			return resData;
		} catch (error: any) {
			this.log.error('Error updating user settings:', error);
			const resError = await createActionResult<null>(
				false,
				null,
				'UPDATE_SETTINGS_ERROR',
				error.message || 'Failed to update user settings.',
			);
			this.setStatus(500);
			return resError;
		}
	}

	/**
	 * @summary Retrieves a user's settings.
	 *

	 * @returns {Promise<APIResponse<UserSettings | null>>} A JSON response with the user's settings.
	 *
	 * @step 1 Get the user ID from the authenticated user.
	 * @step 2 Query the database for the user's settings.
	 * @step 3 Return the settings.
	 */
	@Get('{userId}/settings')
	@SuccessResponse('200', 'User settings fetched successfully')
	@Security('bearer', [])
	public async getUserSettings(
		@Path() userId: string,
	): Promise<APIResponse<UserSettings | null>> {
		try {
			const { userSettings } = schemas;

			// Step 1: Get user ID from authenticated user
			if (!userId) {
				const resError = await createActionResult<null>(
					false,
					null,
					'UNAUTHORIZED',
					'User not authenticated.',
				);
				this.setStatus(401);
				return resError;
			}

			// Step 2: Query for user settings
			const settings = await DB.query.userSettings.findFirst({
				where: eq(userSettings.userId, userId),
			});

			if (!settings) {
				const resError = await createActionResult<null>(
					false,
					null,
					'USER_SETTINGS_NOT_FOUND',
					'User settings not found.',
				);
				this.setStatus(404);
				return resError;
			}

			// Step 3: Return the settings
			const resData = await createActionResult(
				true,
				settings,
				undefined,
				'User settings fetched successfully.',
			);
			this.setStatus(200);
			return resData;
		} catch (error: any) {
			this.log.error('Error fetching user settings:', error);
			const resError = await createActionResult<null>(
				false,
				null,
				'FETCH_SETTINGS_ERROR',
				error.message || 'Failed to fetch user settings.',
			);
			this.setStatus(500);
			return resError;
		}
	}

	/**
	 * @summary Transforms an existing user into an organiser.
	 *

	 * @returns {Promise<APIResponse<OrganiserWithRelationoship | null>>} A JSON response with the new organiser details on success, or an error.
	 *
	 * @step 1 Validate the request body with the `BecomeOrganiserSchema`.
	 * @step 2 Get the user ID from the authenticated user and check if they are already an organiser.
	 * @step 3 Start a database transaction.
	 * @step 4 Within the transaction: update the user's role to 'hoster' and insert a new `organiser` record.
	 * @step 5 Return a success response with the updated user data.
	 */
	@Post('{userId}/become-organiser')
	@SuccessResponse('200', 'User successfully became an organiser')
	@Security('bearer', [])
	public async becomeOrganiser(
		@Path() userId: string,
		@Body() requestBody: BecomeOrganiserInputBody,
	): Promise<APIResponse<UserWithRelationship | null>> {
		try {
			// Step 1: Validate the request body
			const { organiser, user } = schemas;
			const validation = BecomeOrganiserSchema.safeParse(requestBody);

			if (!validation.success) {
				const resError = await createActionResult<null>(
					false,
					null,
					'VALIDATION_ERROR',
					validation.error.issues
						.map((issue) => `${issue.message} for field/s [${issue.path.join(',')}]`)
						.join(', '),
				);
				this.setStatus(400);
				return resError;
			}

			const organiserData = validation.data;
			const now = new Date();

			// Step 2: Get user and check if they are already an organiser
			if (!userId) {
				const resError = await createActionResult(
					false,
					null,
					'UNAUTHORIZED',
					'User not authenticated.',
				);
				this.setStatus(401);
				return resError;
			}

			const existingOrganiser = await DB.query.organiser.findFirst({
				where: eq(organiser.userId, userId),
			});

			if (existingOrganiser) {
				const resError = await createActionResult<null>(
					false,
					null,
					'ALREADY_ORGANISER',
					'User is already an organiser.',
				);
				this.setStatus(409);
				return resError;
			}

			// Step 3 & 4: Start a database transaction to update role and create organiser profile
			const { updatedUser, newOrganiser, orgWallet } = await DB.transaction(async (tx) => {
				const paystackRes = await createPaystackCustomer(
					organiserData.organisationName,
					organiserData.email,
					organiserData.phoneNumber,
				);

				if (!paystackRes) {
					throw new Error('There was an error creating the paystack customer');
				}

				const [updatedUser] = await tx
					.update(user)
					.set({
						role: organiserData.role || 'hoster',
						customerCode: paystackRes?.data.customer_code,
						updatedAt: now,
					})
					.where(eq(user.id, userId))
					.returning();

				const address = organiserData.address;
				const [newOrganiser] = await tx
					.insert(organiser)
					.values({
						...organiserData,
						userId: userId,
						address: address
							? `${address.street}, ${address.city}, ${address.state}, ${address.postalCode}, ${address.country}`
							: null,
						email: organiserData.email || updatedUser!.email,
						organisationName: organiserData.organisationName || updatedUser!.name,
						phoneNumber: organiserData.phoneNumber || '',
						phoneNumberVerified: organiserData.phoneNumberVerified,
						createdAt: now,
						updatedAt: now,
					})
					.returning();

				if (!newOrganiser) {
					throw new Error("There was na error switching to organiser account.")	
				}

				// Create organisers wallet
				const [orgWallet] = await tx
					.insert(schemas.organiserWallet)
					.values({
						organiserId: newOrganiser.id,
						grossRevenue: '0.00',
						payoutBalance: '0.00',
						createdAt: now,
						updatedAt: now,
					})
					.returning();

				return { updatedUser, newOrganiser, orgWallet };
			});

			const userSettings = await DB.query.userSettings.findFirst({
				where: eq(schemas.userSettings.userId, userId),
			});

			if (!userSettings) {
				const resError = await createActionResult<null>(
					false,
					null,
					'USER_SETTINGS_NOT_FOUND',
					'User settings not found.',
				);
				this.setStatus(404);
				return resError;
			}

			// Step 5: Return a success response
			if (!updatedUser || !newOrganiser) {
				const resError = await createActionResult<null>(
					false,
					null,
					'BECOME_ORGANISER_ERROR',
					'Failed to become an organiser.',
				);
				this.setStatus(500);
				return resError;
			}

			const resData = await createActionResult(
				true,
				{
					...updatedUser,
					organiser: { ...newOrganiser!, wallet: orgWallet! },
					userSettings,
				},
				undefined,
				'User successfully became an organiser.',
			);
			this.setStatus(200);
			return resData;
		} catch (error: any) {
			this.log.error('Error in becomeOrganiser:', error);
			const resError = await createActionResult<null>(
				false,
				null,
				'BECOME_ORGANISER_ERROR',
				error.message || 'Failed to become an organiser.',
			);
			this.setStatus(500);
			return resError;
		}
	}
}
