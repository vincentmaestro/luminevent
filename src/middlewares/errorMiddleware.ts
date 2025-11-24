import { Request, Response } from 'express';
import { isCelebrateError } from 'celebrate';
import { ErrorRequestHandler, NextFunction } from 'express';
import logger from '../utils/logger'; // Assuming logger is configured as a function that takes a module name
import http from 'http';
import { HttpError } from '../types'; // Ensure HttpError is defined in src/types.ts
import { formatCelebrateError } from '../utils/celebrateErrorFormatter';
import { ValidateError } from 'tsoa';

// --- Error Handler Factory ---
/**
 * Creates a global error handling middleware for Express.js applications.
 * This handler centralizes error logging and response formatting,
 * differentiating based on error type (e.g., Celebrate, Unauthorized, 404, generic).
 *
 * @param {string} env - The current environment (e.g., 'development', 'production').
 * @returns {ErrorRequestHandler} An Express error handling middleware function.
 *
 * @example
 * ```typescript
 * // In src/index.ts:
 * import { createErrorHandler } from './middleware/errorHandler';
 * import { errors } from 'celebrate'; // For Celebrate errors
 *
 * // ... other middleware and routes ...
 *
 * // Celebrate error handler (must be placed before your custom error handler)
 * app.use(errors());
 *
 * // Global error handler (must be the last middleware)
 * app.use(createErrorHandler(process.env.NODE_ENV || 'development'));
 * ```
 */
export function createErrorHandler(env: string): ErrorRequestHandler {
	return (err: HttpError, req: Request, res: Response, next: NextFunction) => {
		const log = logger('ERROR_HANDLER'); // Get a logger instance for the error handler

		// Log the error based on its status
		if (err.status === 404) {
			log.warn(`404 Not Found: ${req.method} ${req.originalUrl}`);
		} else {
			// For other errors, log the full error details
			log.error(`Error: ${err.message}`, {
				stack: err.stack,
				url: req.originalUrl,
				method: req.method,
				// Add more context if available, e.g., req.body, req.params
			});
		}

		// Initialize response values
		let statusCode = err.status || err.statusCode || 500;
		let errorMessage = err.message || 'Internal Server Error';
		let errorDetails: { message?: string; errors?: any } = {};

		// Handle specific error types
		if (err.name === 'UnauthorizedError') {
			// Common for JWT errors (e.g., from express-jwt)
			statusCode = err.status || 401;
			errorMessage = http.STATUS_CODES[statusCode] || 'Unauthorized';
			errorDetails.message = err.message;
		} else if (err instanceof ValidateError) {
			console.warn(`Caught Validation Error for ${req.path}:`, err.fields);
			statusCode = 422; // Unprocessable Entity
			errorMessage = 'Validation Error';
			errorDetails = { message: 'Validation failed', errors: err.fields };
		} else if (isCelebrateError(err)) {
			// Handle Joi validation errors from Celebrate
			const formatted = formatCelebrateError(err);
			statusCode = formatted.statusCode;
			errorMessage = formatted.message;
			errorDetails = formatted.details;
		} else if (err.name === 'ValidationError' && (err as any).isJoi) {
			// Fallback for raw Joi errors (less common with Celebrate)
			statusCode = 400;
			errorMessage = http.STATUS_CODES[statusCode] || 'Bad Request';
			errorDetails.message = (err as any).details?.message || err.message;
		} else if (err.status) {
			// Handle other HTTP errors with a status code
			errorMessage = http.STATUS_CODES[err.status] || errorMessage;
			errorDetails.message = err.message;
		} else if (env === 'production') {
			// In production, hide sensitive error details for generic 500 errors
			errorMessage = 'Internal Server Error';
			errorDetails = {};
		}

		// Special handling for 404 errors (ensures consistent message)
		if (statusCode === 404) {
			errorMessage = 'Endpoint not found';
			errorDetails.errors = {
				message: `The requested resource '${req.path}' was not found on this server.`,
			};
		}

		// Send the standardized error response
		res.status(statusCode).json({
			error: {
				statusCode,
				message: errorMessage,
				details: errorDetails,
			},
		});

        next(err); // Call next with the error to ensure it can be handled by other error handlers if needed
	};
}
