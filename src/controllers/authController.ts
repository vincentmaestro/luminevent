// import tsoa from 'tsoa';
import { db as DB } from '../db/index';
import schemas from '../db/schemas/index';
import { and, eq } from 'drizzle-orm';
import Utils from '../utils';
import { createActionResult } from '../db/helpers/withPagination';
import {
	CreateUserSchema,
	EmailVericationSchema,
	RequestResetTokenSchema,
	ResetPasswordSchema,
	// CreateGoogleUserSchema,
	resendEmailVerificationSchema,
	LoginUserSchema,
} from './helpers/zod/userSchemas';
import { APIResponse } from '../types/response';
import config from '../config';
import {
	CreateUserInputBody,
	EmailVericationBodyInput,
	LoginUserInputBody,
	RequestResetTokenInput,
	ResetPasswordInputBody,
	User,
	UserWithRelationship,
} from '../types/user';
import logger, { Logger } from '../utils/logger';
import { AuthRequest } from '../types/express';
import { clearAuthTokens, generateAuthTokens } from './helpers/generators';
// import { addJobToQueue as addEmailJob } from '../workers/queue';
// @ts-ignore
import { sendPasswordResetEmail, sendUserVerificationEmail } from '../services/emailService';
import { Route, Tags, Controller, Post, Request, SuccessResponse, Body, Get } from 'tsoa';
import passport from './strategies/google.strategy';
import { Request as ExRequest } from 'express';

/**
 * Controller for handling all authentication-related operations.
 * This class encapsulates the logic for user login, registration, password management,
 * email verification, and social sign-on (Google). It uses Zod for validation, Drizzle ORM
 * for database interactions, and BullMQ for asynchronous email tasks.
 *
 * @class AuthController
 */
@Route('auth')
@Tags('Auth')
export class AuthController extends Controller {
	private log: Logger;

	/**
	 * Constructs the AuthController, initializing the logger and Redis client.
	 * All methods are bound to 'this' to ensure they can be used as Express middleware.
	 */
	constructor() {
		super();
		this.log = logger('[AUTH_CONTROLLER]');
	}

	/**
	 * Handles user authentication via email and password.
	 *
	 * @param {AuthRequest} req The Express request object containing user credentials.
	 * @param {Response} res The Express response object.
	 *
	 * @step 1 Validate request body using Zod schema.
	 * @step 2 Query the database for the user and their associated schemas.account.
	 * @step 3 Handle cases where the user or account is not found, or if a social login account is being used without a password.
	 * @step 4 Decrypt the stored password and compare it with the provided password.
	 * @step 5 Handle cases for unverified email or banned accounts. For unverified emails, a new verification token is generated and an email job is queued.
	 * @step 6 Generate a new JWT access token and refresh token, and set the refresh token in a secure cookie.
	 * @step 7 Attach the authenticated user to the request object and send a successful response.
	 */
	@Post('login')
	@SuccessResponse('200', 'User authenticated successfully')
	public async authenticateUser(
		@Request() req: AuthRequest,
		@Body() requestBody: LoginUserInputBody,
	): Promise<APIResponse<{ user: User; accessToken: string } | null>> {
		try {
			// Step 1: Validate request body
			const validation = LoginUserSchema.safeParse(requestBody);
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
			const { email, password } = validation.data;

			if (config.NODE_ENV !== 'production') {
				console.log('Password', password);
				console.log('Email', email);
			}

			// Step 2: Query the database for the user
			const authResponse = await DB.query.user.findFirst({
				where: eq(schemas.user.email, email),
				with: {
					userSettings: true, // Include user settings
				},
			});

			// Step 3: Handle user not found or social login without password
			if (!authResponse) {
				const resError = await createActionResult<null>(
					false,
					null,
					'USER_NOT_FOUND',
					'User not found. Please register or check your credentials.',
				);
				this.setStatus(404);
				return resError;
			}

			// Step 4: Compare passwords
			const accounts = await DB.query.account.findMany({
				where: eq(schemas.account.userId, authResponse.id),
			});

			if (accounts.length < 1) {
				const resError = await createActionResult<null>(
					false,
					null,
					'AUTHENTICATION_FAILED',
					'You do not have an authorized schemas.account.',
				);
				this.setStatus(401);
				return resError;
			}

			const account = accounts.find((acc) => acc.providerId === 'email_password');

			if (!account || !account.password) {
				const resError = await createActionResult<null>(
					false,
					null,
					'SOCIAL_LOGIN_NOT_SUPPORTED',
					'Social login accounts cannot be used for email/password authentication.',
				);
				this.setStatus(403);
				return resError;
			}

			console.log('Account found:', account);

			const verifiedPassword = await Utils.AuthUtils.comparePassword(
				password,
				account.password,
			);

			if (!verifiedPassword) {
				const resError = await createActionResult<null>(
					false,
					null,
					'INCORRECT_PASSWORD',
					'Incorrect email or password.',
				);
				this.setStatus(401);
				return resError;
			}

			// Step 5: Handle unverified email or banned account
			if (!authResponse.emailVerified) {
				const token = await Utils.AuthUtils.generateToken(
					{
						email: authResponse.email,
						id: authResponse.id,
						now: new Date().toISOString(),
					},
					config.JWT_SECRET as string,
					30 * 60 * 60,
				);

				// Store the token in Redis with a 30-minute expiration
				await req.redisClient?.set(`verifyEmail:${authResponse.id}`, token, {
					EX: 30 * 60, // 30 minutes
				});

				if (config.NODE_ENV !== 'production')
					console.log('Generated verification token:', token);

				// await addEmailJob('emailQueue', {
				// 	to: authResponse.email,
				// 	type: 'emailVerification',
				// 	token,
				// 	callbackUrl: config.EMAIL_VERIFICATION_URL,
				// });

				// !Deprecated: use the email queue instead
				await sendUserVerificationEmail(
					token,
					authResponse.email,
					config.EMAIL_VERIFICATION_URL,
				);

				const resError = await createActionResult<null>(
					false,
					null,
					'EMAIL_NOT_VERIFIED',
					'Email not verified. A new verification link has been sent.',
				);
				this.setStatus(403);
				return resError;
			}
			if (authResponse.banned) {
				const resError = await createActionResult<null>(
					false,
					null,
					'ACCOUNT_BANNED',
					'Your account has been banned. Contact support.',
				);
				this.setStatus(403);
				return resError;
			}

			// Step 6: Generate and set tokens
			const { accessToken } = await generateAuthTokens(authResponse, req);
			req.activeUser = authResponse;

			// Step 7: Send successful response
			const resData = await createActionResult(true, { user: authResponse, accessToken });
			this.setStatus(200);
			return resData;
		} catch (error: any) {
			this.log.error('Error authenticating user:', error);
			const resError = await createActionResult<null>(
				false,
				null,
				'AUTHENTICATION_ERROR',
				config.NODE_ENV === 'production' ? 'Internal error during login.' : error.message,
			);
			this.setStatus(500);
			return resError;
		}
	}

	/**
	 * Refreshes a user's access token using a valid refresh token.
	 *
	 * @param {AuthRequest} req The Express request object, which may contain a refresh token in cookies or Redis.
	 * @param {Response} res The Express response object.
	 *
	 * @step 1 Retrieve the refresh token from cookies or Redis. Clear invalid tokens.
	 * @step 2 Verify the token and extract the user ID.
	 * @step 3 If no valid token is found, return an error.
	 * @step 4 Find the user in the database using the extracted user ID.
	 * @step 5 If the user is not found or is banned, clear tokens and return an error.
	 * @step 6 Generate a new JWT access token and set a new refresh token.
	 * @step 7 Attach the user to the request and send a successful response with the new access token.
	 *
	 * @returns {Promise<APIResponse<{ user: User; accessToken: string } | null>>} Returns a promise that resolves to an API response containing the user and new access token.
	 */
	@Get('refresh-token')
	@SuccessResponse('200', 'Access token refreshed successfully')
	public async refreshAccessToken(
		@Request() req: AuthRequest,
	): Promise<APIResponse<{ user: User; accessToken: string } | null>> {
		try {
			// Step 1: Retrieve refresh token from cookies or Redis
			let refreshToken = req.signedCookies?.refreshToken || null;
			let userId: string | null = null;
			let payload: { userId: string } | null = null;

			// DEPRECATED from checking or the refresh token in the cookies for use of redis instead
			if (refreshToken) {
				try {
					payload = await Utils.AuthUtils.verifyToken<{ userId: string }>(
						refreshToken,
						config.JWT_SECRET as string,
					);
					userId = payload ? payload.userId : null;
				} catch (error) {
					this.log.warn('Invalid refresh token in cookie. Clearing it.');
					refreshToken = null;
				}
			}

			if (!refreshToken && req.activeUser?.id) {
				const redisKey = `refreshToken:${req.activeUser.id}`;
				const redisToken = await req.redisClient?.get(redisKey);
				if (redisToken) {
					try {
						payload = await Utils.AuthUtils.verifyToken<{ userId: string }>(
							redisToken,
							config.JWT_SECRET as string,
						);
						refreshToken = redisToken;
						userId = payload?.userId || null;
					} catch (error) {
						this.log.warn(
							'Invalid refresh token in Redis for active user. Clearing it.',
						);
						await req.redisClient?.del(redisKey);
					}
				}
			}

			// Step 2 & 3: Handle missing token or user ID
			if (!refreshToken || !userId) {
				const resError = await createActionResult<null>(
					false,
					null,
					'REFRESH_TOKEN_MISSING',
					'Refresh token is missing or invalid. Please log in again.',
				);
				this.setStatus(401);
				return resError;
			}

			// Step 4: Find user in database
			const dbUser = await DB.query.user.findFirst({
				where: eq(schemas.user.id, userId),
				with: {
					userSettings: true, // Include user settings
				},
			});

			// Step 5: Handle user not found or banned
			if (!dbUser) {
				await clearAuthTokens(userId, req);
				const resError = await createActionResult<null>(
					false,
					null,
					'USER_NOT_FOUND',
					'User associated with refresh token not found.',
				);
				this.setStatus(404);
				return resError;
			}
			if (dbUser.banned) {
				await clearAuthTokens(dbUser.id, req);
				const resError = await createActionResult<null>(
					false,
					null,
					'ACCOUNT_BANNED',
					'Access denied. Your account has been restricted.',
				);
				this.setStatus(403);
				return resError;
			}

			// Step 6: Generate new tokens
			const { accessToken } = await generateAuthTokens(dbUser, req);
			req.activeUser = dbUser;

			// Step 7: Send successful response
			const resData = await createActionResult(true, { user: dbUser, accessToken });
			this.setStatus(200);
			return resData;
		} catch (error: any) {
			this.log.error('Error refreshing access token:', error);
			const resError = await createActionResult<null>(
				false,
				null,
				'REFRESH_ACCESS_TOKEN_ERROR',
				error.message || 'Failed to refresh access token.',
			);
			this.setStatus(500);
			return resError;
		}
	}

	/**
	 * Logs out the current user by clearing all authentication tokens.
	 *
	 * @param {AuthRequest} req The Express request object.
	 * @param {Response} res The Express response object.
	 *
	 * @step 1 Clear all auth tokens (cookie and Redis).
	 * @step 2 Send a success response confirming logout.
	 */
	@Post('logout')
	@SuccessResponse('200', 'User logged out successfully')
	public async logout(
		@Request() req: AuthRequest,
	): Promise<APIResponse<{ message: string } | null>> {
		try {
			// Step 1: Clear all auth tokens
			if (req.activeUser) {
				await clearAuthTokens(req.activeUser.id, req);
			}

			if (!req.activeUser) {
				const resError = await createActionResult<null>(
					false,
					null,
					'NO_ACTIVE_USER',
					'No active user session found.',
				);
				this.setStatus(400);
				return resError;
			}

			// Step 2: Send success response
			const resData = await createActionResult(true, { message: 'Successfully Signed Out' });
			this.setStatus(200);
			return resData;
		} catch (error: any) {
			this.log.error('Error logging out:', error);
			const resError = await createActionResult<null>(
				false,
				null,
				'LOGOUT_ERROR',
				error.message || 'Failed to logout successfully.',
			);
			this.setStatus(500);
			return resError;
		}
	}

	/**
	 * Requests a password reset token for a given email.
	 *
	 * @param {AuthRequest} req The Express request object containing the user's email.
	 *
	 * @step 1 Validate the request body (email).
	 * @step 2 Look up the user by email in the database.
	 * @step 3 If the user is not found or is banned, send a generic success message to prevent email enumeration.
	 * @step 4 Generate a secure, encrypted password reset token.
	 * @step 5 Store the token in Redis with a 30-minute expiration.
	 * @step 6 Queue an email job to send the password reset link to the user.
	 * @step 7 Send a generic success response to the client.
	 */
	@Post('request-password-reset')
	@SuccessResponse('200', 'Password reset requested successfully')
	public async requestPasswordReset(
		@Body() requestBody: RequestResetTokenInput,
		@Request() req: AuthRequest,
	): Promise<APIResponse<{ message: string } | null>> {
		try {
			// Step 1: Validate request body
			const validation = RequestResetTokenSchema.safeParse(requestBody);
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
			const { email } = validation.data;

			// Step 2: Look up user by email
			const existingUser = await DB.query.user.findFirst({
				where: eq(schemas.user.email, email),
			});

			// Step 3: Handle user not found or banned (prevent enumeration)
			if (!existingUser || existingUser.banned) {
				const successResult = await createActionResult(
					true,
					// Leave this as it is, the essential part is to not reveal if the user exists or not
					{ message: `A reset link has been sent to your email.` },
				);
				this.setStatus(200);
				return successResult;
			}

			// Step 4: Generate a secure reset token
			const resetToken = await Utils.AuthUtils.generateToken(
				{
					email: existingUser.email,
					id: existingUser.id,
					now: new Date().toISOString(),
				},
				config.JWT_SECRET as string,
				30 * 60 * 1000, // Token valid for 30 minutes
			);
			config.NODE_ENV !== 'production' && console.log('Generated reset token: ', resetToken);

			// Step 5: Store the token in Redis with a 30-minute TTL
			await req.redisClient?.set(`resetPasswordToken:${resetToken}`, resetToken, {
				EX: 30 * 60,
			});

			// Step 6: Queue the password reset email job
			// await addEmailJob('emailQueue', {
			// 	to: existingUser.email,
			// 	type: 'passwordReset',
			// 	token: resetToken,
			// 	callbackUrl: config.EMAIL_RESET_URL,
			// });

			await sendPasswordResetEmail(resetToken, existingUser.email, config.EMAIL_RESET_URL);

			// Step 7: Send generic success response
			const successResult = await createActionResult(true, {
				message: `An email has beenn sent to your email: ${existingUser.email}`,
			});
			this.setStatus(200);
			return successResult;
		} catch (error: any) {
			this.log.error('Error requesting password reset:', error);
			const resError = await createActionResult<null>(
				false,
				null,
				'PASSWORD_RESET_REQUEST_ERROR',
				error.message || 'Failed to process password reset request',
			);
			this.setStatus(500);
			return resError;
		}
	}

	/**
	 * Resets a user's password using a valid token and a new password.
	 *
	 * @param {AuthRequest} req The Express request object containing the reset token and new password.
	 *
	 * @step 1 Validate request body (token and new password).
	 * @step 2 Check if the token exists in Redis. If not, it's invalid or expired.
	 * @step 3 Verify the token's payload to extract user details.
	 * @step 4 Check if the new password is the same as the old one to prevent redundant updates.
	 * @step 5 Encrypt the new password and update the user's account in the database.
	 * @step 6 Delete the used token from Redis.
	 * @step 7 Send a success response.
	 */
	@Post('reset-password')
	@SuccessResponse('200', 'Password reset successfully')
	public async resetPassword(
		@Body() requestBody: ResetPasswordInputBody,
		@Request() req: AuthRequest,
	): Promise<APIResponse<{ email: string; message: string } | null>> {
		try {
			// Step 1: Validate request body
			const validation = ResetPasswordSchema.safeParse(requestBody);
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
			const { token, newPassword } = validation.data;

			// Step 2: Check for token in Redis
			const tokenKey = `resetPasswordToken:${token}`;
			const storedToken = await req.redisClient?.get(tokenKey);
			if (!storedToken) {
				const resError = await createActionResult<null>(
					false,
					null,
					'INVALID_TOKEN',
					'The reset token is invalid or has expired.',
				);
				this.setStatus(400);
				return resError;
			}

			// Step 3: Verify token payload
			const tokenData = await Utils.AuthUtils.verifyToken<{
				email: string;
				id: string;
			}>(token, config.JWT_SECRET as string);
			if (!tokenData?.email || !tokenData?.id) {
				const resError = await createActionResult<null>(
					false,
					null,
					'INVALID_TOKEN',
					'The reset token is invalid or has expired.',
				);
				this.setStatus(400);
				return resError;
			}
			const { id: userId, email } = tokenData;

			// Step 4: Prevent password from being the same as the old one
			const [userAccount] = await DB.select({ password: schemas.account.password })
				.from(schemas.account)
				.where(eq(schemas.account.userId, userId));
			if (
				userAccount &&
				(await Utils.AuthUtils.comparePassword(newPassword, userAccount.password!))
			) {
				const resError = await createActionResult<null>(
					false,
					null,
					'NO_CHANGE_IN_PASSWORD',
					'New password cannot be the same as the old password.',
				);
				this.setStatus(409);
				return resError;
			}

			// Step 5: Encrypt and update password in the database
			const hashedPassword = await Utils.AuthUtils.hashPassword(newPassword);
			await DB.update(schemas.account)
				.set({ password: hashedPassword, updatedAt: new Date() })
				.where(eq(schemas.account.userId, userId));

			// Step 6: Remove token from Redis
			await req.redisClient?.del(tokenKey);

			// Step 7: Send success response
			const successResult = await createActionResult(true, {
				email,
				message: 'Password reset successfully.',
			});
			this.setStatus(200);
			return successResult;
		} catch (error: any) {
			this.log.error('Error resetting password:', error);
			const resError = await createActionResult<null>(
				false,
				null,
				'PASSWORD_RESET_ERROR',
				error.message || 'Failed to reset password.',
			);
			return resError;
		}
	}

	/**
	 * Creates a new user account with email and password, and sets up default user settings.
	 *
	 * @param {AuthRequest} req The Express request object containing user details.
	 *
	 * @step 1 Validate request body using Zod schema.
	 * @step 2 Check if a user with the same email already exists.
	 * @step 3 Start a database transaction to ensure all user-related records (user, account, settings) are created atomically.
	 * @step 4 Inside the transaction: encrypt the password, insert the user, insert the account, and insert default user settings.
	 * @step 5 Generate and store an email verification token in Redis.
	 * @step 6 Queue an email job to send the verification link to the new user.
	 * @step 7 Return the newly created user and their settings in the response.
	 */
	@Post('register')
	@SuccessResponse('201', 'User created successfully')
	public async createUser(
		@Body() requestBody: CreateUserInputBody,
		@Request() req: AuthRequest,
	): Promise<APIResponse<UserWithRelationship | null>> {
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

			// If a user with the same email already exists, return an error
			if (existingUser) {
				const resError = await createActionResult<null>(
					false,
					null,
					'USER_ALREADY_EXISTS',
					'A user with this email already exists.',
				);
				this.setStatus(400);
				return resError;
			}

			// Step 3 & 4: Start transaction and create all user records
			const { settings, newUser } = await DB.transaction(async (tx) => {
				const hashedPassword = await Utils.AuthUtils.hashPassword(userData.password);
				const [createdUser] = await tx
					.insert(schemas.user)
					.values({
						...userData,
						banned: false,
						lastLogin: now,
						createdAt: now,
						updatedAt: now,
					})
					.returning();

				if (!createdUser) {
					throw new Error('Failed to create user.');
				}

				await tx
					.insert(schemas.account)
					.values({
						userId: createdUser.id,
						password: hashedPassword,
						providerId: 'email_password',
						accountId: createdUser.id,
						createdAt: now,
						updatedAt: now,
					})
					.returning();

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
					30 * 60 * 60,
				);
				config.NODE_ENV !== 'production' &&
					console.log('Generated Verification Token:', verifyToken);

				const tokenKey = `verifyEmail:${createdUser.id}`;
				await req.redisClient?.set(tokenKey, verifyToken, { EX: 30 * 60 });

				// await addEmailJob('emailQueue', {
				// 	to: createdUser.email,
				// 	type: 'emailVerification',
				// 	token: verifyToken,
				// 	callbackUrl: config.EMAIL_VERIFICATION_URL,
				// });

				// !Deprecated: use the email queue instead
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
				{ ...newUser, userSettings: settings },
				undefined,
				'User created successfully. Please verify your email.',
			);
			this.setStatus(201);
			return resData;
		} catch (error: any) {
			this.log.error('Error creating user:', error);
			const resError = await createActionResult<null>(
				false,
				null,
				'CREATE_USER_ERROR',
				error.message || 'Failed to create user.',
			);
			this.setStatus(500);
			return resError;
		}
	}

	/**
	 * Verifies a user's email using a secure token.
	 *
	 * @param {AuthRequest} req The Express request object containing the verification token.
	 *
	 * @step 1 Validate the token from either the query or body.
	 * @step 2 Verify the token's signature and payload.
	 * @step 3 Check if the token is valid in Redis.
	 * @step 4 Look up the user by the ID and email from the token payload.
	 * @step 5 Handle cases where the user is not found or the email is already verified.
	 * @step 6 Update the user's `emailVerified` status in the database.
	 * @step 7 Remove the used token from Redis to prevent reuse.
	 * @step 8 Send a success response.
	 */
	@Post('verify-email')
	@SuccessResponse('200', 'Email verified successfully')
	public async verifyEmail(
		@Body() requestBody: EmailVericationBodyInput,
		@Request() req: AuthRequest,
	): Promise<APIResponse<UserWithRelationship | null>> {
		try {
			this.log.info('Verifying email with request body:', requestBody);
			// Step 1: Validate token
			const parseResult = EmailVericationSchema.safeParse(requestBody);
			if (!parseResult.success) {
				const resError = await createActionResult<null>(
					false,
					null,
					'VALIDATION_ERROR',
					parseResult.error.issues
						.map((issue) => `${issue.message} for field/s [${issue.path.join(',')}]`)
						.join(', '),
				);
				this.setStatus(400);
				return resError;
			}
			const { token } = parseResult.data;

			// Step 2 & 3: Verify token and check Redis
			const tokenPayload = await Utils.AuthUtils.verifyToken<{
				email: string;
				id: string;
				now: string;
			}>(token, config.JWT_SECRET as string);

			this.log.info(`Token Payload: ${JSON.stringify(tokenPayload)}`);

			const tokenKey = `verifyEmail:${tokenPayload?.id}`;
			const tokenInRedis = await req.redisClient?.get(tokenKey);

			this.log.info(
				`Token in Redis: ${tokenInRedis}, Token Payload: ${JSON.stringify(tokenPayload)}`,
			);

			if (!tokenPayload || !tokenInRedis) {
				const resError = await createActionResult<null>(
					false,
					null,
					'INVALID_TOKEN',
					'The verification token is invalid or has expired.',
				);
				this.setStatus(400);
				return resError;
			}

			// Step 4: Look up user
			const existingUser = await DB.query.user.findFirst({
				where: and(
					eq(schemas.user.email, tokenPayload.email),
					eq(schemas.user.id, tokenPayload.id),
				),
				with: { userSettings: true },
			});

			// Step 5: Handle user not found or already verified
			if (!existingUser) {
				const resError = await createActionResult<null>(
					false,
					null,
					'USER_NOT_FOUND',
					'User not found.',
				);
				this.setStatus(404);
				return resError;
			}
			if (existingUser.emailVerified) {
				const resError = await createActionResult<null>(
					false,
					null,
					'EMAIL_ALREADY_VERIFIED',
					'Email already verified.',
				);
				this.setStatus(409);
				return resError;
			}

			// Step 6: Update user status
			await DB.update(schemas.user)
				.set({ emailVerified: true })
				.where(eq(schemas.user.id, existingUser.id));

			// Step 7: Remove token from Redis
			await req.redisClient?.del(tokenKey);

			// Step 8: Send success response
			const resSuccess = await createActionResult(
				true,
				existingUser,
				'EMAIL_VERIFIED',
				'Email verified successfully.',
			);
			this.setStatus(200);
			return resSuccess;
		} catch (error: any) {
			this.log.error('Error verifying email:', error);
			const resError = await createActionResult<null>(
				false,
				null,
				'VERIFY_EMAIL_ERROR',
				error.message || 'Failed to verify email.',
			);
			this.setStatus(500);
			return resError;
		}
	}

	// /**
	//     * Handles the Google SSO callback, either logging in an existing user or creating a new one.
	//     *

	//     * @param {AuthRequest} req The Express request object populated by Passport with user profile data.
	//     * @param {Response} res The Express response object.
	//     *
	//     * @step 1 Extract and validate the user profile data from `req.user` (from Passport).
	//     * @step 2 Look up the user by email.
	//     * @step 3 If the user doesn't exist, create a new user, a linked Google account, and default user settings within a transaction.
	//     * @step 4 If the user exists, check for a linked Google account and create one if it doesn't exist.
	//     * @step 5 Handle cases where an existing user is banned.
	//     * @step 6 Generate a new JWT access token and set a refresh token cookie.
	//     * @step 7 Attach the user to the request object and send a successful response.
	//     */
	// @Post('google/callback')
	// @SuccessResponse('200', 'Google SSO callback handled successfully')
	// public async handleGoogleSSOCallback(
	// 	@Request() req: AuthRequest,
	// ): Promise<APIResponse<{ user: User; accessToken: string } | null>> {
	// 	try {
	// 		// Step 1: Extract and validate user profile
	// 		const profile = req.user as {
	// 			providerAccount: {
	// 				email: string;
	// 				name?: string;
	// 				avatar?: string;
	// 				googleId: string;
	// 			};
	// 		};
	// 		const parseResult = CreateGoogleUserSchema.safeParse({
	// 			email: profile?.providerAccount.email,
	// 			name: profile?.providerAccount.name || 'Google User',
	// 			avatar: profile?.providerAccount.avatar ?? null,
	// 			googleId: profile?.providerAccount.googleId,
	// 			emailVerified: true,
	// 			role: 'user',
	// 		});
	// 		if (!parseResult.success) {
	// 			const resError = await createActionResult<null>(
	// 				false,
	// 				null,
	// 				'VALIDATION_ERROR',
	// 				parseResult.error.issues
	// 					.map((issue) => `${issue.message} for field/s [${issue.path.join(',')}]`)
	// 					.join(', '),
	// 			);
	// 			this.setStatus(400);
	// 			return resError;
	// 		}
	// 		const { email, name, avatar, googleId, emailVerified, role } = parseResult.data;
	// 		const now = new Date();

	// 		// Step 2: Look up user by email
	// 		const existingUser = await DB.query.user.findFirst({
	// 			where: eq(schemas.user.email, email),
	// 		});

	// 		let finalUser: User | undefined = undefined;
	// 		// let settings;
	// 		const statusCode = existingUser ? 200 : 201;

	// 		if (!existingUser) {
	// 			// Step 3: Create new user if not found
	// 			const { newUser } = await DB.transaction(async (tx) => {
	// 				const [createdUser] = await tx
	// 					.insert(schemas.user)
	// 					.values({
	// 						email,
	// 						name,
	// 						image: avatar,
	// 						emailVerified,
	// 						role,
	// 						banned: false,
	// 					})
	// 					.returning();

	// 				if (!createdUser) {
	// 					throw new Error('Failed to create user.');
	// 				}

	// 				await tx.insert(schemas.account).values({
	// 					providerId: 'google',
	// 					accountId: googleId,
	// 					userId: createdUser.id,
	// 					createdAt: now,
	// 					updatedAt: now,
	// 				});
	// 				const [userSettingsCreated] = await tx
	// 					.insert(schemas.userSettings)
	// 					.values({
	// 						userId: createdUser.id,
	// 						notification: {
	// 							email: true,
	// 							sms: false,
	// 							push: true,
	// 							whatsapp: false,
	// 							telegram: false,
	// 						},
	// 					})
	// 					.returning();
	// 				return { newUser: createdUser, settings: userSettingsCreated };
	// 			});
	// 			finalUser = newUser;
	// 		} else {
	// 			// Step 4: Link or handle existing user
	// 			if (existingUser.banned) {
	// 				const resError = await createActionResult<null>(
	// 					false,
	// 					null,
	// 					'ACCOUNT_BANNED',
	// 					'Your account has been banned. Contact support.',
	// 				);
	// 				this.setStatus(403);
	// 				return resError;
	// 			}
	// 			if (!existingUser.emailVerified) {
	// 				await DB.update(schemas.user)
	// 					.set({ emailVerified: true })
	// 					.where(eq(schemas.user.id, existingUser.id));
	// 			}

	// 			const linkedAccount = await DB.query.account.findFirst({
	// 				where: and(
	// 					eq(schemas.account.userId, existingUser.id),
	// 					eq(schemas.account.providerId, 'google'),
	// 				),
	// 			});

	// 			if (!linkedAccount) {
	// 				await DB.insert(schemas.account).values({
	// 					providerId: 'google',
	// 					accountId: googleId,
	// 					userId: existingUser.id,
	// 					createdAt: now,
	// 					updatedAt: now,
	// 				});
	// 			}

	// 			finalUser = await DB.query.user.findFirst({
	// 				where: eq(schemas.user.id, existingUser.id),
	// 			});
	// 		}

	// 		// Step 6: Generate and set tokens
	// 		if (!finalUser) {
	// 			const resError = await createActionResult<null>(
	// 				false,
	// 				null,
	// 				'USER_CREATION_ERROR',
	// 				'Failed to create or retrieve user.',
	// 			);
	// 			this.setStatus(500);
	// 			return resError;
	// 		}
	// 		const { accessToken } = await generateAuthTokens(finalUser, req);
	// 		req.activeUser = finalUser;

	// 		// Step 7: Send successful response
	// 		const resData = await createActionResult<{
	// 			user: User;
	// 			accessToken: string;
	// 		}>(true, { user: finalUser, accessToken });
	// 		this.setStatus(statusCode);
	// 		return resData;
	// 	} catch (error: any) {
	// 		this.log.error('Google SSO Callback Error:', error);
	// 		const resError = await createActionResult<null>(
	// 			false,
	// 			null,
	// 			'GOOGLE_AUTH_ERROR',
	// 			error.message || 'Google SSO failed.',
	// 		);
	// 		this.setStatus(500);
	// 		return resError;
	// 	}
	// }

	/**
     * Resends an email verification link to a user.
     *

     * @param {AuthRequest} req The Express request object containing the user's email.
     *
     * @step 1 Validate the request body for a valid email.
     * @step 2 Look up the user and handle cases for user not found, already verified, or banned.
     * @step 3 Check if a token for this user already exists in Redis to prevent too many requests.
     * @step 4 If no token exists, generate a new one, store it in Redis with a 30-minute expiration, and queue an email job.
     * @step 5 Send a success response indicating the email has been sent.
     */
	@Post('resend-email-verification')
	@SuccessResponse('200', 'Verification email resent successfully')
	public async resendEmailVerification(
		@Request() req: AuthRequest,
		@Body() requestBody: RequestResetTokenInput,
	): Promise<APIResponse<{ message: string } | null>> {
		try {
			// Step 1: Validate request body
			const parseResult = resendEmailVerificationSchema.safeParse(requestBody);
			if (!parseResult.success) {
				const resError = await createActionResult<null>(
					false,
					null,
					'VALIDATION_ERROR',
					parseResult.error.issues
						.map((issue) => `${issue.message} for field/s [${issue.path.join(',')}]`)
						.join(', '),
				);
				this.setStatus(400);
				return resError;
			}
			const { email } = parseResult.data;

			// Step 2: Handle user not found, already verified, or banned
			const user = await DB.query.user.findFirst({
				where: eq(schemas.user.email, email),
			});
			if (!user) {
				const resError = await createActionResult<null>(
					false,
					null,
					'USER_NOT_FOUND',
					'No account found with this email.',
				);
				this.setStatus(404);
				return resError;
			}
			if (user.emailVerified) {
				const resError = await createActionResult<null>(
					false,
					null,
					'EMAIL_ALREADY_VERIFIED',
					'This email has already been verified.',
				);
				this.setStatus(400);
				return resError;
			}
			if (user.banned) {
				const resError = await createActionResult<null>(
					false,
					null,
					'ACCOUNT_BANNED',
					'Your account has been banned.',
				);
				this.setStatus(403);
				return resError;
			}

			// Step 3: Check for existing token to prevent spam
			const tokenKey = `verifyEmail:${user.id}`;
			const existingToken = await req.redisClient?.get(tokenKey);
			if (existingToken) {
				const resError = await createActionResult(
					false,
					null,
					'TOO_MANY_REQUESTS',
					'A verification email has already been sent. Please wait.',
				);
				this.setStatus(400);
				return resError;
			}

			// Step 4: Generate new token, store in Redis, and queue email job
			const token = await Utils.AuthUtils.generateToken(
				{ email: user.email, id: user.id, now: new Date().toISOString() },
				config.JWT_SECRET as string,
				30 * 60,
			);
			await req.redisClient?.set(tokenKey, token, { EX: 30 * 60 });
			// await addEmailJob('emailQueue', {
			// 	to: user.email,
			// 	type: 'emailVerification',
			// 	token,
			// 	callbackUrl: config.EMAIL_VERIFICATION_URL,
			// });

			await sendUserVerificationEmail(token, user.email, config.EMAIL_VERIFICATION_URL);

			// Step 5: Send success response
			const resSuccess = await createActionResult(true, {
				message: 'Verification email sent successfully.',
			});
			this.setStatus(200);
			return resSuccess;
		} catch (error: any) {
			this.log.error('Resend Email Verification Error:', error);
			const resError = await createActionResult<null>(
				false,
				null,
				'RESEND_VERIFICATION_FAILED',
				error.message || 'Could not send verification email.',
			);
			this.setStatus(500);
			return resError;
		}
	}

	/**
	 * Redirect to google
	 *
	 */
	@Get('/google')
	public async RedirectToGoogle(@Request() req: ExRequest) {
		console.log('google link');
		const res = req.res!;
		passport.authenticate('google', {
			scope: ['profile', 'email'],
			prompt: 'select_account', // Forces account selection
		})(req, res);
	}

	/**
	 * Callback url for google
	 *
	 */
	@Get('google/callback')
	public async GoogleCallback(@Request() req: ExRequest): Promise<void> {
		const res = req.res!;

		await new Promise<void>((resolve) => {
			passport.authenticate('google', async (err: any, authResult: any, info: any) => {
				try {
					if (err) {
						console.error('Google OAuth Error:', err);
						res.redirect(`${config.CLIENT_URL}/auth/error?message=oauth_error`);
						return resolve();
					}

					if (!authResult) {
						console.log('Google OAuth cancelled or failed:', info);
						res.redirect(`${config.CLIENT_URL}/auth/error?message=oauth_cancelled`);
						return resolve();
					}
					console.log('authResult', authResult);
					const { user, isNewUser } = authResult;
					console.log('user:', user);
					console.log('NewUser:', isNewUser);
					const { accessToken, refreshToken } = await generateAuthTokens(user, req);

					res.cookie('refreshToken', refreshToken, {
						httpOnly: true,
						secure: config.NODE_ENV === 'production',
						sameSite: 'strict',
						maxAge: 7 * 24 * 60 * 60 * 1000,
						path: '/',
					});

					const redirectUrl = new URL(`${config.CLIENT_URL}/auth/callback`);
					redirectUrl.searchParams.append('token', accessToken);
					redirectUrl.searchParams.append('userId', user.id);
					redirectUrl.searchParams.append('newUser', isNewUser.toString());
					if (user.name) redirectUrl.searchParams.append('name', user.name);
					if (user.email) redirectUrl.searchParams.append('email', user.email);
					if (user.image) redirectUrl.searchParams.append('avatar', user.image);

					console.log('Google OAuth Success - Redirecting to:', redirectUrl.toString());

					res.redirect(redirectUrl.toString());
					return resolve();
				} catch (error: any) {
					console.error('Token generation error:', error);
					res.redirect(`${config.CLIENT_URL}/auth/error?message=token_error`);
					return resolve();
				}
			})(req, res);
		});
	}

	/**
	 * Link to google
	 *
	 */
	@Get('google/link')
	public async LinkAccounttoGoogle(@Request() req: ExRequest) {
		// This would be used if user is already logged in and wants to link Google
		const res = req.res!;
		if (!req.activeUser) {
			return res.status(401).json({
				success: false,
				message: 'User must be authenticated to link accounts',
			});
		}

		return passport.authenticate('google', {
			scope: ['profile', 'email'],
			state: 'link_account', // Custom state to handle linking
		})(req, res);
	}
}
