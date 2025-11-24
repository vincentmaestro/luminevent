// src/utils/celebrateErrorFormatter.ts
import { CelebrateError, isCelebrateError } from 'celebrate';
import { ValidationError } from 'joi';

interface FormattedError {
    statusCode: number;
    message: string;
    details: Record<string, unknown>;
}

/**
 * Formats Celebrate validation errors into a consistent error response format
 * @param error The Celebrate error object
 * @returns Formatted error response
 */
export function formatCelebrateError(error: CelebrateError): FormattedError {
    // Default error response
    const formattedError: FormattedError = {
        statusCode: 400,
        message: 'Validation failed',
        details: {}
    };

    // Extract Joi validation details from Celebrate error
    for (const [segment, joiError] of error.details.entries()) {
        if (joiError instanceof ValidationError) {
            formattedError.details[segment] = {
                message: joiError.message,
                // Include validation details if available
                ...(joiError.details && {
                    validation: joiError.details.map(detail => ({
                        message: detail.message,
                        path: detail.path,
                        type: detail.type,
                        context: detail.context
                    }))
                })
            };
        }
    }

    return formattedError;
}

/**
 * Checks if an error is a Celebrate error and formats it if true
 * @param error Any error object
 * @returns Formatted error if it's a Celebrate error, otherwise null
 */
export function handleCelebrateError(error: unknown): FormattedError | null {
    if (isCelebrateError(error)) {
        return formatCelebrateError(error);
    }
    return null;
}


/**
 * Extracts the first validation error message from a Celebrate error
 */
export function getFirstCelebrateErrorMessage(error: CelebrateError): string {
    for (const [, joiError] of error.details.entries()) {
        if (joiError instanceof ValidationError && joiError.details.length > 0) {
            return joiError.details[0]?.message || "Validation failed";
        }
    }
    return 'Validation failed';
}

/**
 * Gets all validation error messages as a flat array
 */
export function getAllCelebrateErrorMessages(error: CelebrateError): string[] {
    const messages: string[] = [];
    for (const [, joiError] of error.details.entries()) {
        if (joiError instanceof ValidationError) {
            messages.push(...joiError.details.map(d => d.message));
        }
    }
    return messages;
}