import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { eq } from 'drizzle-orm';
import { db as DB } from '../../db/index';
import schemas from '../../db/schemas';
import config from '../../config';

// Configure Google OAuth Strategy
passport.use(
	new GoogleStrategy(
		{
			clientID: config.GOOGLE_CLIENT_ID!,
			clientSecret: config.GOOGLE_CLIENT_SECRET!,
			callbackURL: config.GOOGLE_CLIENT_CALLBACK_URL,
			scope: ['profile', 'email'],
		},
		async (accessToken, refreshToken, profile, done) => {
			console.log('>>> Inside MY Google verify callback');
			try {
				console.log('Google OAuth Profile:', profile);

				// Step 1: Check if user already exists by email
				let user = await DB.query.user.findFirst({
					where: eq(schemas.user.email, profile.emails?.[0]?.value || ''),
					with: {
						accounts: true,
						userSettings: true,
					},
				});

				let isNewUser = false;

				if (!user) {
					// Step 2: Create new user if doesn't exist
					const [createdUser] = await DB.insert(schemas.user)
						.values({
							name:
								profile.displayName ||
								profile.name?.givenName + ' ' + profile.name?.familyName ||
								'Google User',
							email: profile.emails?.[0]?.value || '',
							emailVerified: profile.emails?.[0]?.verified || true, // Google emails are typically verified
							image: profile.photos?.[0]?.value || null,
							role: 'user',
							banned: false,
							customerCode: null, // You can generate this if needed
							lastLogin: new Date(),
							createdAt: new Date(),
							updatedAt: new Date(),
						})
						.returning();

					isNewUser = true;

					if (!createdUser) {
						throw new Error('something went wrong!');
					}

					// Step 3: Create default user settings for new user
					await DB.insert(schemas.userSettings).values({
						userId: createdUser.id,
						notification: {
							email: { enabled: true, marketing: false, securityAlerts: true },
							sms: { enabled: false, promotions: false },
							whatsapp: { enabled: false, updates: true },
							push: { enabled: true, reminders: true, alerts: false },
							telegram: { enabled: true, alerts: true, updates: false },
						},
						preference: 'system',
						createdAt: new Date(),
						updatedAt: new Date(),
					});

					// Step 4: Fetch the newly created user with relations
					user = await DB.query.user.findFirst({
						where: eq(schemas.user.id, createdUser.id),
						with: {
							accounts: true,
							userSettings: true,
						},
					});

					console.log('Created new user with settings:', createdUser.id);
				} else {
					// Step 5: Update last login for existing user
					await DB.update(schemas.user)
						.set({
							lastLogin: new Date(),
							updatedAt: new Date(),
						})
						.where(eq(schemas.user.id, user.id));
				}

				// Ensure we have the user with all relations
				if (!user) {
					throw new Error('Failed to create or retrieve user');
				}

				// Step 6: Check if Google account already linked
				const existingAccounts = await DB.query.account.findMany({
					where: eq(schemas.account.userId, user.id),
				});

				let existingAccount = existingAccounts.find((acc) => acc.providerId === 'google');

				if (!existingAccount) {
					// Step 7: Create Google account record
					await DB.insert(schemas.account).values({
						accountId: profile.id,
						providerId: 'google',
						userId: user.id,
						accessToken: accessToken,
						refreshToken: refreshToken || null,
						idToken: null, // You can store ID token if needed
						accessTokenExpiresAt: null, // Set expiration if available
						refreshTokenExpiresAt: null,
						scope: 'profile email',
						password: null, // OAuth accounts don't have passwords
						createdAt: new Date(),
						updatedAt: new Date(),
					});

					console.log('Created Google account link for user:', user.id);
				} else {
					// Step 8: Update existing Google account tokens
					await DB.update(schemas.account)
						.set({
							accessToken: accessToken,
							refreshToken: refreshToken || existingAccount.refreshToken,
							updatedAt: new Date(),
						})
						.where(eq(schemas.account.id, existingAccount.id));

					console.log('Updated Google account tokens for user:', user.id);
				}

				// Step 9: Return user with account info (refetch to ensure all relations are included)
				const userWithAccounts = await DB.query.user.findFirst({
					where: eq(schemas.user.id, user.id),
					with: {
						accounts: true,
						userSettings: true,
					},
				});

				if (!userWithAccounts) {
					throw new Error('Failed to retrieve user with accounts');
				}

				return done(null, { user: userWithAccounts, isNewUser });
			} catch (error) {
				console.error('Google OAuth Error:', error);
				return done(error, undefined);
			}
		},
	),
);

export default passport;

// // Routes for Google OAuth
// export const googleAuthRoutes = {
// 	// Initiate Google OAuth
// 	initiateAuth: passport.authenticate('google', {
// 		scope: ['profile', 'email'],
// 		prompt: 'select_account', // Forces account selection
// 	}),

// 	// Handle Google OAuth callback
// 	handleCallback: async (req: any, res: any, next: any) => {
// 		passport.authenticate('google', async (err: any, authResult: any, info: any) => {
// 			try {
// 				if (err) {
// 					console.error('Google OAuth Error:', err);
// 					return res.redirect(`${config.CLIENT_URL}/auth/error?message=oauth_error`);
// 				}

// 				if (!authResult) {
// 					console.log('Google OAuth cancelled or failed:', info);
// 					return res.redirect(`${config.CLIENT_URL}/auth/error?message=oauth_cancelled`);
// 				}

// 				const { user, isNewUser } = authResult;

// 				// Generate JWT tokens using your existing function
// 				const { accessToken, refreshToken } = await generateAuthTokens(user, req);

// 				// Set refresh token in HTTP-only cookie (following your login pattern)
// 				res.cookie('refreshToken', refreshToken, {
// 					httpOnly: true,
// 					secure: config.NODE_ENV === 'production',
// 					sameSite: 'strict',
// 					maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
// 					path: '/',
// 				});

// 				// Redirect with access token and user info
// 				const redirectUrl = new URL(`${config.CLIENT_URL}/auth/callback`);
// 				redirectUrl.searchParams.append('token', accessToken);
// 				redirectUrl.searchParams.append('userId', user.id);
// 				redirectUrl.searchParams.append('newUser', isNewUser.toString());

// 				// Optional: Add user info to URL (be careful with URL length limits)
// 				if (user.name) redirectUrl.searchParams.append('name', user.name);
// 				if (user.email) redirectUrl.searchParams.append('email', user.email);
// 				if (user.image) redirectUrl.searchParams.append('avatar', user.image);

// 				console.log('Google OAuth Success - Redirecting to:', redirectUrl.toString());

// 				return res.redirect(redirectUrl.toString());
// 			} catch (error: any) {
// 				console.error('Token generation error:', error);
// 				return res.redirect(`${config.CLIENT_URL}/auth/error?message=token_error`);
// 			}
// 		})(req, res, next);
// 	},

// 	linkAccount: async (req: any, res: any) => {
// 		// This would be used if user is already logged in and wants to link Google
// 		if (!req.activeUser) {
// 			return res.status(401).json({
// 				success: false,
// 				message: 'User must be authenticated to link accounts',
// 			});
// 		}

// 		// Store the user ID in session to link after OAuth
// 		req.session.linkUserId = req.activeUser.id;

// 		return passport.authenticate('google', {
// 			scope: ['profile', 'email'],
// 			state: 'link_account', // Custom state to handle linking
// 		})(req, res);
// 	},
// };

// Express route setup example
/*
// In your routes file:
import express from 'express';
import { googleAuthRoutes } from './auth/google-oauth';

const router = express.Router();

// Start Google OAuth
router.get('/auth/google', googleAuthRoutes.initiateAuth);

// Google OAuth callback
router.get('/auth/google/callback', googleAuthRoutes.handleCallback);

// Optional: Link Google to existing account
router.get('/auth/google/link', googleAuthRoutes.linkAccount);

export default router;
*/
