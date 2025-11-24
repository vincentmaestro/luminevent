import { Request } from 'express';
import { AuthUtils } from '../utils/auth';
import logger from '../utils/logger';
import { createActionResult } from '../db/helpers/withPagination';
import { User } from '../db/schemas/usersAndOrganiser';
import config from '../config';

/**
 * A reusable function to check user roles.
 *
 * @param {User} activeUser - The authenticated user object.
 * @param {Array<string>} scopes - The roles required to access the resource.
 * @param {string} label - A label for logging purposes.
 * @returns {Promise<void>} - Resolves if the user has a valid role, otherwise rejects.
 */
const checkUserRoles = async (activeUser: User, scopes: string[], label: string): Promise<void> => {
	if (!scopes.includes(activeUser.role)) {
		const result = await createActionResult(
			false,
			null,
			'AUTHORIZATION_REQUIRED',
			'You do not have the right permission to view this resource.',
		);
		logger(`[${label.toUpperCase()}_CHECK]`).warn(
			`Authorization Required: Permission denied for ${label} resources.`,
		);
		return Promise.reject({ status: 401, message: result });
	}

	logger(`[${label.toUpperCase()}_CHECK]`).info(
		`${label} check passed for user: ${activeUser.name}`,
	);
};

/**
 * Tsoa's primary authentication function. It validates a bearer token and
 * enforces optional role-based access control.
 *
 * This function must resolve a user object on success or reject with an error on failure.
 * It's crucial to handle all errors by rejecting the Promise to allow Tsoa to manage the response.
 *
 * @param {Request} req - The Express request object.
 * @param {string} securityName - The name of the security scheme defined in tsoa.json (e.g., 'jwt').
 * @param {string[]} scopes - Optional array of roles (e.g., ['admin', 'staff']) required for access.
 * @returns {Promise<User>} - A promise that resolves with the User object or rejects with an error.
 */
export async function expressAuthentication(
	req: Request,
	securityName: string,
	scopes?: string[],
): Promise<User> {
	if (securityName !== 'bearer') {
		return Promise.reject(new Error(`Invalid security name: ${securityName}`));
	}

	const authHeader = req.headers['authorization'];
	const token = authHeader?.split(' ')[1];

	if (!token) {
		const result = await createActionResult(
			false,
			null,
			'AUTHENTICATION_REQUIRED',
			'Authentication token is required.',
		);
		logger('[AUTH_MIDDLEWARE]').warn('Authentication failed: No token provided.');
		return Promise.reject({ status: 401, message: result });
	}

	try {
		const decodedUser = await AuthUtils.verifyToken<User>(token, config.JWT_SECRET as string);

		if (!decodedUser) {
			const result = await createActionResult(
				false,
				null,
				'INVALID_TOKEN',
				'Invalid or expired authentication token.',
			);
			logger('[AUTH_MIDDLEWARE]').warn('Authentication failed: Invalid or expired token.');
			return Promise.reject({ status: 403, message: result });
		}

		if (!decodedUser.emailVerified) {
			const resError = await createActionResult<null>(
				false,
				null,
				'EMAIL_NOT_VERIFIED',
				'Email not verified. Check your email for the verification code/link',
			);
			return Promise.reject({ status: 403, message: resError });
		}

		if (decodedUser.banned) {
			logger('[AUTH_MIDDLEWARE]').warn(
				`Banned ${decodedUser.email}: User was banned from the platform.`,
			);
			const resError = await createActionResult<null>(
				false,
				null,
				'ACCOUNT_BANNED',
				'Your account has been banned. Contact support.',
			);
			return Promise.reject({ status: 403, message: resError });
		}

		// Attach the user to the request object for use in controllers.
		// Tsoa also returns this object directly.
		req.activeUser = decodedUser;

		// Enforce role-based access using scopes
		if (scopes && scopes.length > 0) {
			await checkUserRoles(decodedUser, scopes, 'scoped');
		}

		return decodedUser; // Authentication successful, return the user object
	} catch (error) {
		const result = await createActionResult(
			false,
			null,
			'INVALID_TOKEN',
			'Invalid or malformed authentication token.',
		);
		logger('[AUTH_MIDDLEWARE]').error(
			'Authentication failed: Token verification error.',
			error,
		);
		return Promise.reject({ status: 403, message: result });
	}
}
