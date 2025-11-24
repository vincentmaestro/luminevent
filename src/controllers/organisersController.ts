import {
	Route,
	Tags,
	Controller,
	Post,
	Request,
	SuccessResponse,
	Body,
	Put,
	Delete,
	Path,
	Security,
	Get,
} from 'tsoa';
import { db as DB } from '../db';
import { createActionResult } from '../db/helpers/withPagination';
import {
	AddSocialAccountInputBody,
	CreateOrganiserInputBody,
	OrganiserWithRelationship,
	OrganiserSocialAccount,
	UpdateOrganiserInputBody,
	Organiser,
	CreateOrganizerPayoutAccountDTO,
	OrganizerPayoutAccount,
	UpdateOrganizerPayoutAccountDTO,
} from '../types/user';
import { APIResponse } from '../types/response';
import { AuthRequest } from '../types/express';
import schemas from '../db/schemas';
import logger, { Logger } from '../utils/logger';
import { and, eq } from 'drizzle-orm';
import Utils from '../utils';
import { Utils as Formatter } from '../utils/formatter';

import config from '../config';
// import { addJobToQueue as addEmailJob } from '../workers/queue';
import { sendUserVerificationEmail } from '../services/emailService';
import {
	AddSocialAccountSchema,
	CreateOrganiserSchema,
	CreateOrganizerPayoutAccountSchema,
	UpdateOrganiserSchema,
	UpdateOrganizerPayoutAccountSchema,
	UpdateSocialAccountSchema,
} from './helpers/zod/userSchemas';
import {
	bankCodes,
	createPaystackCustomer,
	createPaystackSubaccount,
	verifyBankAccountNumber,
} from '../utils/paystack';
import { Validators } from '../utils/validators';

/**
 * Controller for handling organiser-related operations.
 * This includes creating new organisers, managing their profiles,
 * and handling related user settings.
 *
 * @class OrganiserController
 */
@Route('organiser')
@Tags('Organiser')
export class OrganiserController extends Controller {
	private log: Logger;

	constructor() {
		super();
		this.log = logger('[ORGANISER_CONTROLLER]'); // Corrected the logger tag
	}

	/**
	 * Creates a new organiser account, which also involves creating a new user
	 * and initializing their user settings and organiser profile.
	 *
	 * @param {AuthRequest} req The Express AuthRequest object containing organiser and user data in the body.
	 * @returns {Promise<APIResponse<OrganiserWithRelationship | null>>} A JSON response with the new organiser details on success, or an error.
	 *
	 * @step 1 Validate the request body against the `CreateOrganiserSchema`.
	 * @step 2 Check if a user with the provided email already exists.
	 * @step 3 Start a database transaction to ensure atomicity for user, account, settings, and organiser profile creation.
	 * @step 4 Inside the transaction: encrypt the password, insert the new user (with the 'organiser' role), create the credential account, set default user settings, and insert the organiser profile.
	 * @step 5 Generate and store an email verification token in Redis.
	 * @step 6 Queue an email job to send the verification link to the new organiser.
	 * @step 7 Return a success response with the newly created organiser and their related data.
	 */
	@Post()
	@SuccessResponse('201', 'Organiser created successfully')
	public async createOrganiser(
		@Body() requestBody: CreateOrganiserInputBody,
		@Request() req: AuthRequest,
	): Promise<APIResponse<OrganiserWithRelationship | null>> {
		try {
			// Step 1: Validate the request body
			const { userSettings, organiser, user, account } = schemas;
			const validation = CreateOrganiserSchema.safeParse(requestBody);

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

			const userData = validation.data;
			const now = new Date();

			// Step 2: Check for existing user
			const existingUser = await DB.query.user.findFirst({
				where: eq(user.email, userData.email),
			});

			if (existingUser) {
				const resError = await createActionResult<null>(
					false,
					null,
					'USER_ALREADY_EXISTS',
					'A user with this email already exists',
				);
				this.setStatus(409);
				return resError;
			}

			// Step 3 & 4: Begin transaction and create all related records
			const {
				newUser,
				settings,
				organizer: newOrganiser,
				orgWallet,
			} = await DB.transaction(async (tx) => {
				const hashedPassword = await Utils.AuthUtils.hashPassword(userData.password);

				const paystackRes = await createPaystackCustomer(
					userData.organisationName,
					userData.email,
					userData.phoneNumber,
				);

				if (!paystackRes) {
					throw new Error("There was an error creating the paystack customer");
				}

				const [createdUser] = await tx
					.insert(user)
					.values({
						email: userData.email,
						name: userData.organisationName,
						role: 'hoster', // Enforce 'hoster' role for organizers
						banned: false,
						lastLogin: now,
						createdAt: now,
						updatedAt: now,
						customerCode: paystackRes.data.customer_code,
					})
					.returning();

				if (!createdUser) {
					throw new Error('Failed to create user.');
				}
				// Create the account for the user
				await tx.insert(account).values({
					userId: createdUser.id,
					password: hashedPassword,
					providerId: 'email_password',
					accountId: createdUser.id,
					createdAt: now,
					updatedAt: now,
				});

				// Create user settings with default values
				const userSettingsData = {
					userId: createdUser.id,
					notification: {
						email: true,
						sms: false,
						push: true,
						whatsapp: false,
						telegram: false,
					},
				};

				const [settings] = await tx
					.insert(userSettings)
					.values(userSettingsData)
					.returning();

				const organiserDetail = userData;
				const address = organiserDetail.address;

				const [organizer] = await tx
					.insert(organiser)
					.values({
						email: organiserDetail.email,
						organisationName: organiserDetail.organisationName,
						phoneNumber: organiserDetail.phoneNumber || '',
						phoneNumberVerified: organiserDetail.phoneNumberVerified,
						userId: createdUser.id,
						address: address
							? `${address.street}, ${address.city}, ${address.state}, ${address.postalCode}, ${address.country}`
							: null,
						bio: organiserDetail.bio,
						logo: organiserDetail.logo,
						website: organiserDetail.website,
						createdAt: now,
						updatedAt: now,
					})
					.returning();

				if (!organizer) {
					throw new Error('Failed to create organiser.');
				}

				// Create organisers wallet
				const [orgWallet] = await tx
					.insert(schemas.organiserWallet)
					.values({
						organiserId: organizer.id,
						grossRevenue: '0.00',
						payoutBalance: '0.00',
						createdAt: now,
						updatedAt: now,
					})
					.returning();

				const verifyToken = await Utils.AuthUtils.generateToken(
					{
						email: createdUser.email,
						id: createdUser.id,
						now: now.toISOString(),
					},
					config.JWT_SECRET as string,
					30 * 60,
				);
				const tokenKey = `verifyEmail:${createdUser.id}`;

				await req.redisClient?.set(tokenKey, verifyToken, { EX: 30 * 60 });

				// await addEmailJob('EMAIL_QUEUE', {
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

				return { newUser: createdUser, settings, organizer, orgWallet };
			});

			// Step 5: Confirm the creation of the organiser
			if (!newUser || !settings || !newOrganiser) {
				const resError = await createActionResult<null>(
					false,
					null,
					'CREATE_ORGANISER_ERROR',
					'Failed to create organiser. Please try again later.',
				);

				this.setStatus(500);
				return resError;
			}

			// Step 6: Return success response
			const resData = await createActionResult<OrganiserWithRelationship>(
				true,
				{
					...newUser,
					userSettings: settings,
					organiser: newOrganiser,
					wallet: orgWallet!,
				},
				undefined,
				'Organiser created successfully. Please verify your email.',
			);
			this.setStatus(201);
			return resData;
		} catch (error: any) {
			this.log.error('Error creating organiser:', error);
			const resError = await createActionResult<null>(
				false,
				null,
				'CREATE_ORGANISER_ERROR',
				error.message || 'Failed to create organiser.',
			);
			this.setStatus(500);
			return resError;
		}
	}

	/**
	 * @summary Updates an organiser's extra details.
	 * @param organiserId The ID of the organiser to update.
	 * @param body The data to update.
	 * @returns The updated organiser record.
	 */
	@Put('{userId}')
	@SuccessResponse('200', 'Organiser details updated successfully')
	@Security('bearer', ['admin', 'staff', 'hoster'])
	public async updateOrganiserDetails(
		@Path() userId: string,
		@Body() body: UpdateOrganiserInputBody,
		@Request() req: AuthRequest, // Use the authenticated request to get the current user ID
	): Promise<APIResponse<Organiser | null>> {
		try {
			const normOrganiserId = Formatter.normalizeUuid(userId);
			if (!normOrganiserId) {
				this.setStatus(400);
				return createActionResult<null>(
					false,
					null,
					'INVALID_ID',
					'Organiser ID is invalid.',
				);
			}

			// Step 1: Check if the authenticated user has permission to update this organiser.
			// This is a critical security step. Ensure the authenticated user ID matches the organiser ID.
			if (req.activeUser?.id !== normOrganiserId) {
				this.setStatus(403);
				return createActionResult<null>(
					false,
					null,
					'FORBIDDEN',
					'You do not have permission to update this organiser.',
				);
			}

			// Step 2: Validate the request body (optional, but recommended).
			// A zod schema for this would be beneficial, similar to the `createOrganiser` function.
			const validated = UpdateOrganiserSchema.safeParse(body);

			if (!validated.success) {
				const resError = createActionResult<null>(
					false,
					null,
					'VALIDATION_ERROR',
					Formatter.formatZodErrors(validated.error.issues),
				);
				this.setStatus(400);
				return resError;
			}

			// Step 3: Check if the organiser exists.
			const existingOrganiser = await DB.query.organiser.findFirst({
				where: eq(schemas.organiser.userId, normOrganiserId),
			});

			if (!existingOrganiser) {
				this.setStatus(404);
				return createActionResult<null>(
					false,
					null,
					'ORGANISER_NOT_FOUND',
					'Organiser not found.',
				);
			}

			const now = new Date();
			const address = validated.data.address;
			// Step 4: Update the organiser's details.
			const [updatedOrganiser] = await DB.update(schemas.organiser)
				.set({
					...validated.data,
					address: address
						? `${address.street}, ${address.city}, ${address.state}, ${address.postalCode}, ${address.country}`
						: existingOrganiser.address,
					updatedAt: now,
				})
				.where(eq(schemas.organiser.userId, normOrganiserId))
				.returning();

			if (!updatedOrganiser) {
				throw new Error('Failed to update organiser details.');
			}

			this.setStatus(200);
			return createActionResult(
				true,
				updatedOrganiser,
				'UPDATE_SUCCESS',
				'Organiser details updated successfully.',
			);
		} catch (error: any) {
			this.log.error('Error updating organiser details:', error);
			const status = error.message.includes('not found') ? 404 : 500;
			this.setStatus(status);
			return createActionResult<null>(
				false,
				null,
				'UPDATE_ORGANISER_ERROR',
				error.message || 'Something went wrong.',
			);
		}
	}

	/**
	 * Adds a social account to an organiser.
	 *

	 * @param {AuthRequest} req The Express request object with social account data and organiser ID.
	 * @returns {Promise<APIResponse<OrganiserSocialAccount | null>>} A JSON response with the new social account details.
	 *
	 * @step 1 Validate the request body with the `AddSocialAccountSchema`.
	 * @step 2 Check if the user is authenticated and is an organiser.
	 * @step 3 Insert the new social account into the `organiserSocialAccount` table.
	 * @step 4 Return the created social account.
	 */
	@Post('{userId}/social-accounts')
	@SuccessResponse('201', 'Organiser social account added successfully')
	@Security('bearer', ['admin', 'staff', 'hoster'])
	public async addOrganiserSocialAccount(
		@Path() userId: string,
		@Body() requestBody: AddSocialAccountInputBody,
	): Promise<APIResponse<OrganiserSocialAccount | null>> {
		try {
			const { organiserSocialAccounts, organiser } = schemas;
			const validation = AddSocialAccountSchema.safeParse(requestBody);
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
			if (!existingOrganiser) {
				const resError = await createActionResult(
					false,
					null,
					'FORBIDDEN',
					'User is not an organiser.',
				);
				this.setStatus(403);
				return resError;
			}

			const now = new Date();
			const [newAccount] = await DB.insert(organiserSocialAccounts)
				.values({
					organiserId: existingOrganiser.id,
					platform: validation.data.platform,
					url: validation.data.url,
					createdAt: now,
					updatedAt: now,
				})
				.returning();

			const resData = await createActionResult<OrganiserSocialAccount>(
				true,
				newAccount,
				undefined,
				'Organiser social account added successfully.',
			);
			this.setStatus(201);
			return resData;
		} catch (error: any) {
			this.log.error('Error adding organiser social account:', error);
			const resError = await createActionResult<null>(
				false,
				null,
				'ADD_ORGANISER_SOCIAL_ACCOUNT_ERROR',
				error.message || 'Failed to add organiser social account.',
			);
			this.setStatus(500);
			return resError;
		}
	}

	/**
	 * @summary Fetches social accounts for an organiser.
	 *

	 * @returns {Promise<APIResponse<OrganiserSocialAccount | null>>} A JSON response with the new social account details.
	 *
	 * @step 1 Validate the request body with the `AddSocialAccountSchema`.
	 * @step 2 Check if the user is authenticated and is an organiser.
	 * @step 3 Insert the new social account into the `organiserSocialAccount` table.
	 * @step 4 Return the created social account.
	 */
	@Get('{userId}/social-accounts')
	@SuccessResponse('200', 'Fetched Organiser social account successfully')
	@Security('bearer', ['admin', 'staff', 'hoster'])
	public async fetchOrganiserSocialAccount(
		@Path() userId: string,
	): Promise<APIResponse<OrganiserSocialAccount[] | null>> {
		try {
			const { organiserSocialAccounts, organiser } = schemas;

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
			if (!existingOrganiser) {
				const resError = await createActionResult(
					false,
					null,
					'FORBIDDEN',
					'User is not an organiser.',
				);
				this.setStatus(403);
				return resError;
			}

			const socials = await DB.query.organiserSocialAccounts.findMany({
				where: eq(organiserSocialAccounts.organiserId, existingOrganiser.id),
			});

			const resData = await createActionResult(
				true,
				socials,
				undefined,
				'Organiser social account added successfully.',
			);
			this.setStatus(201);
			return resData;
		} catch (error: any) {
			this.log.error('Error adding organiser social account:', error);
			const resError = await createActionResult<null>(
				false,
				null,
				'ADD_ORGANISER_SOCIAL_ACCOUNT_ERROR',
				error.message || 'Failed to add organiser social account.',
			);
			this.setStatus(500);
			return resError;
		}
	}

	/**
	 * Updates a social account linked to an organiser.
	 *

	 * @param {string} accountId The ID of the social account to update.
	 * @returns {Promise<<APIResponse<OrganiserSocialAccount | null>>>} A JSON response with the updated social account details.
	 *
	 * @step 1 Validate the request body.
	 * @step 2 Check if the user is authenticated and the owner of the account.
	 * @step 3 Update the social account record in the `organiserSocialAccount` table.
	 * @step 4 Return the updated social account.
	 */
	@Put('{userId}/social-accounts/{accountId}')
	@SuccessResponse('200', 'Organiser social account updated successfully')
	@Security('bearer', ['hoster'])
	public async updateOrganiserSocialAccount(
		@Path() accountId: string,
		@Path() userId: string,
		@Body() requestBody: AddSocialAccountInputBody,
	): Promise<APIResponse<OrganiserSocialAccount | null>> {
		try {
			const { organiserSocialAccounts, organiser } = schemas;
			const validation = UpdateSocialAccountSchema.safeParse(requestBody);
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
			if (!existingOrganiser) {
				const resError = await createActionResult(
					false,
					null,
					'FORBIDDEN',
					'User is not an organiser.',
				);
				this.setStatus(403);
				return resError;
			}

			const [updatedAccount] = await DB.update(organiserSocialAccounts)
				.set({
					...validation.data,
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(organiserSocialAccounts.id, accountId),
						eq(organiserSocialAccounts.organiserId, existingOrganiser.id),
					),
				)
				.returning();

			if (!updatedAccount) {
				const resError = await createActionResult(
					false,
					null,
					'ACCOUNT_NOT_FOUND',
					'Social account not found or you do not have permission to update it.',
				);
				this.setStatus(404);
				return resError;
			}

			const resData = await createActionResult<OrganiserSocialAccount>(
				true,
				updatedAccount,
				undefined,
				'Organiser social account updated successfully.',
			);
			this.setStatus(200);
			return resData;
		} catch (error: any) {
			this.log.error('Error updating organiser social account:', error);
			const resError = await createActionResult<null>(
				false,
				null,
				'UPDATE_ORGANISER_SOCIAL_ACCOUNT_ERROR',
				error.message || 'Failed to update organiser social account.',
			);
			this.setStatus(500);
			return resError;
		}
	}

	/**
	 * Removes a social account linked to an organiser.
	 *

	 * @param {AuthRequest} req The Express request object with the account ID to be removed.
	 * @param {string} accountId The ID of the social account to remove.
	 * @returns {Promise<Response>} A JSON response indicating success.
	 *
	 * @step 1 Check if the user is authenticated and the owner of the account.
	 * @step 2 Delete the social account record from the `organiserSocialAccount` table.
	 * @step 3 Return a success response.
	 */
	@Delete('{userId}/social-accounts/{accountId}')
	@SuccessResponse('200', 'Organiser social account removed successfully')
	@Security('bearer', ['admin', 'hoster'])
	public async removeOrganiserSocialAccount(
		@Path() accountId: string,
		@Path() userId: string,
	): Promise<APIResponse<null>> {
		try {
			const { organiserSocialAccounts, organiser } = schemas;
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
			if (!existingOrganiser) {
				const resError = await createActionResult(
					false,
					null,
					'FORBIDDEN',
					'User is not an organiser.',
				);
				this.setStatus(403);
				return resError;
			}

			const result = await DB.delete(organiserSocialAccounts).where(
				and(
					eq(organiserSocialAccounts.id, accountId),
					eq(organiserSocialAccounts.organiserId, existingOrganiser.id),
				),
			);

			if (result.rowCount === 0) {
				const resError = await createActionResult(
					false,
					null,
					'ACCOUNT_NOT_FOUND',
					'Social account not found or you do not have permission to delete it.',
				);
				this.setStatus(404);
				return resError;
			}

			const resData = await createActionResult<null>(
				true,
				null,
				undefined,
				'Organiser social account removed successfully.',
			);
			this.setStatus(200);
			return resData;
		} catch (error: any) {
			this.log.error('Error removing organiser social account:', error);
			const resError = await createActionResult<null>(
				false,
				null,
				'REMOVE_ORGANISER_SOCIAL_ACCOUNT_ERROR',
				error.message || 'Failed to remove organiser social account.',
			);
			this.setStatus(500);
			return resError;
		}
	}

	/**
	 * @summary Creates a new payout account for the authenticated user.
	 * @param body The data for the new payout account.
	 * @param req The authenticated request.
	 * @returns The created payout account record.
	 */
	@Post('{userId}/payout-account')
	@SuccessResponse('201', 'Payout account created successfully')
	@Security('bearer', ['hoster'])
	public async createPayoutAccount(
		@Path() userId: string,
		@Body() body: CreateOrganizerPayoutAccountDTO,
	): Promise<APIResponse<OrganizerPayoutAccount | null>> {
		try {
			const validation = CreateOrganizerPayoutAccountSchema.safeParse(body);
			if (!validation.success) {
				this.setStatus(400);
				return createActionResult<null>(
					false,
					null,
					'VALIDATION_ERROR',
					validation.error.issues
						.map((i) => `${i.message} for field/s [${i.path.join(',')}]`)
						.join(', '),
				);
			}

			const bank = bankCodes.find(
				(b) => b.name.toLowerCase() === validation.data.bankName.toLowerCase(),
			);

			if (!bank) {
				this.setStatus(403);
				return createActionResult<null>(
					false,
					null,
					'UNSUPPORTED_BANK_ACCOUNT',
					'Payout bank is unsupported at the moment.',
				);
			}

			const org = await DB.query.organiser.findFirst({
				where: eq(schemas.organiser.userId, userId),
				with: {
					user: true,
				},
			});

			if (!org) {
				this.setStatus(403);
				return createActionResult<null>(
					false,
					null,
					'ORGANISER_NOT_FOUND',
					'Organiser account not found.',
				);
			}

			const validBankAccount = await Validators.checkNameSimilarity(
				validation.data.bankName,
				org.user.name,
				org.organisationName,
			);

			if (!validBankAccount) {
				this.setStatus(403);
				return createActionResult<null>(
					false,
					null,
					'INVALID_BANK_ACCOUNT_NAME',
					'Your bank account name must be related to thier organiser name.',
				);
			}

			const validAccNo = await verifyBankAccountNumber(
				Number(bank.code),
				validation.data.bankAccountNumber,
			);

			if (!validAccNo!.status) {
				this.setStatus(403);
				return createActionResult<null>(
					false,
					null,
					'INVALID_BANK_ACCOUNT_NUMBER',
					'The bank account number provided is invalid.',
				);
			}
			const existingAccount = await DB.query.organizerPayoutAccount.findFirst({
				where: and(
					eq(schemas.organizerPayoutAccount.userId, userId),
					eq(schemas.organizerPayoutAccount.verified, true),
				),
			});

			if (!existingAccount) {
				throw new Error('Payout Account not found');
			}

			if (existingAccount) {
				this.setStatus(409);
				return createActionResult<null>(
					false,
					null,
					'ACCOUNT_ALREADY_EXISTS',
					'Payout account already exists for this user.',
				);
			}

			const subAccount = await createPaystackSubaccount(
				validation.data.bankAccountName,
				bank.code,
				validation.data.bankAccountNumber,
				5,
			);

			if (!subAccount) {
				this.setStatus(409);
				return createActionResult<null>(
					false,
					null,
					'ACCOUNT_ALREADY_EXISTS',
					'Payout account already exists for this user.',
				);
			}

			const now = new Date();
			const [newAccount] = await DB.insert(schemas.organizerPayoutAccount)
				.values({
					...validation.data,
					bankRoutingNumber: validation.data.bankRoutingNumber || '',
					paystackSubAccountCode: subAccount?.data.subaccount_code,
					userId: userId,
					createdAt: now,
					updatedAt: now,
				})
				.returning();

			if (!newAccount) {
				this.setStatus(400);
				return createActionResult<null>(
					false,
					null,
					'ERROR_CREATING_ACCOUNT',
					'There was an error creating the payout account.',
				);
			}

			this.setStatus(201);
			return createActionResult(
				true,
				newAccount,
				'CREATE_SUCCESS',
				'Payout account created successfully.',
			);
		} catch (error: any) {
			this.log.error('Error creating payout account:', error);
			this.setStatus(500);
			return createActionResult<null>(
				false,
				null,
				'CREATE_PAYOUT_ACCOUNT_ERROR',
				error.message || 'Something went wrong.',
			);
		}
	}

	/**
	 * @summary Updates an existing payout account for the authenticated user.
	 * @param body The data to update.
	 * @param userId The user id.
	 * @returns The updated payout account record.
	 */
	@Put('{userId}/payout-account')
	@SuccessResponse('200', 'Payout account updated successfully')
	@Security('bearer', ['hoster'])
	public async updatePayoutAccount(
		@Body() body: UpdateOrganizerPayoutAccountDTO,
		@Path() userId: string,
	): Promise<APIResponse<OrganizerPayoutAccount | null>> {
		try {
			const validation = UpdateOrganizerPayoutAccountSchema.safeParse(body);
			if (!validation.success) {
				this.setStatus(400);
				return createActionResult<null>(
					false,
					null,
					'VALIDATION_ERROR',
					validation.error.issues
						.map((i) => `${i.message} for field/s [${i.path.join(',')}]`)
						.join(', '),
				);
			}

			const existingAccount = await DB.query.organizerPayoutAccount.findFirst({
				where: eq(schemas.organizerPayoutAccount.userId, userId),
			});

			if (!existingAccount) {
				this.setStatus(404);
				return createActionResult<null>(
					false,
					null,
					'ACCOUNT_NOT_FOUND',
					'Payout account not found. Please create one first.',
				);
			}

			const now = new Date();
			const [updatedAccount] = await DB.update(schemas.organizerPayoutAccount)
				.set({ ...validation.data, updatedAt: now })
				.where(eq(schemas.organizerPayoutAccount.userId, userId))
				.returning();

			this.setStatus(200);
			return createActionResult(
				true,
				updatedAccount,
				'UPDATE_SUCCESS',
				'Payout account updated successfully.',
			);
		} catch (error: any) {
			this.log.error('Error updating payout account:', error);
			this.setStatus(500);
			return createActionResult<null>(
				false,
				null,
				'UPDATE_ACCOUNT_ERROR',
				error.message || 'Something went wrong.',
			);
		}
	}
}
