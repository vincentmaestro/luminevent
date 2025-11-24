import config from '../../config';
import { User } from '../../db/schemas/usersAndOrganiser';
import { Request, Response } from 'express';
import Utils from '../../utils';

export const generateAuthTokens = async (userData: User, req: Request, _res?: Response) => {
	// Generate a new access token for the authenticated user.
	const accessToken = await Utils.AuthUtils.generateToken(
		userData,
		config.JWT_SECRET as string,
		60 * 60 * 1000,
	);
	// Generate a new refresh token for the authenticated user.
	const refreshToken = await Utils.AuthUtils.generateToken(
		{ userId: userData.id },
		config.JWT_SECRET as string,
	);

	// // Set the refresh token as an HTTP-only, secure, signed cookie in the response.
	// res.cookie('refreshToken', refreshToken, {
	//   httpOnly: true, // Prevents client-side JavaScript access.
	//   secure: config.NODE_ENV === 'production', // Only send over HTTPS in production.
	//   signed: true, // The cookie is signed to prevent tampering.
	//   sameSite: 'strict', // Provides protection against CSRF attacks.
	//   maxAge: 24 * 60 * 60 * 1000, // Cookie expires in 24 hours.
	//   path: '/', // prevent setting to default "/api" or another scope
	// });

	// Optionally, store the refresh token in Redis with a 24-hour expiry.
	await req.redisClient?.set(`refreshToken:${userData.id}`, refreshToken, {
		EX: 24 * 60 * 60 * 1000, // 24 hours
	});

	return {
		accessToken,
		refreshToken,
	};
};

export const clearAuthTokens = async (userId: string, req: Request, _res?: Response) => {
	const redisKey = `refreshToken:${userId}`;
	await req.redisClient?.del(redisKey);

	// Clear the refresh token cookie on the client
	// res.clearCookie('refreshToken', {
	//   httpOnly: true,
	//   secure: config.NODE_ENV === 'production',
	//   signed: true,
	//   sameSite: 'strict',
	//   path: '/',
	// });
	// Clear the active user property from the request object.
	req.activeUser = undefined;
};
