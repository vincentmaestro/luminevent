import { Request, Response, NextFunction } from 'express';
import { ZodObject, ZodError, treeifyError } from 'zod';
import { createActionResult } from '../db/helpers/withPagination';

/**
 * A generic function to create an Express middleware for validating requests using Zod.
 * This middleware validates the specified part of the request (body, query, or params)
 * against a given Zod schema.
 *
 * @param {ZodObject<any>} schema - The Zod schema to validate against.
 * @param {'body' | 'query' | 'params'} [source='body'] - The part of the request to validate.
 * @returns {(req: Request, res: Response, next: NextFunction) => Promise<void>} An Express middleware function.
 * * @example
 * ```typescript
 * import { Router } from 'express';
 * import { z } from 'zod';
 * import { validate } from './path/to/this/file';
 *
 * const userRouter = Router();
 *
 * const createUserSchema = z.object({
 * name: z.string().min(1),
 * email: z.string().email(),
 * });
 *
 * userRouter.post('/users', validate(createUserSchema, 'body'), (req, res) => {
 * // If validation passes, req.body is now type-safe according to createUserSchema
 * res.status(201).json({ message: 'User created successfully', data: req.body });
 * });
 *
 * export default userRouter;
 * ```
 */
export async function createValidator(
    schema: ZodObject<any>,
    source: 'body' | 'query' | 'params' = 'body'
) {
    return async function (req: Request, res: Response, next: NextFunction) {
        try {
            // Use 'async' to correctly handle Zod's `parseAsync`
            // and reassign the validated and type-safe data back to the request object.
            const validatedData = await schema.parseAsync(req[source]);
            req[source] = validatedData;
            return next();
        } catch (error) {
            if (error instanceof ZodError) {
                // Return a standardized 400 Bad Request response for validation errors.
                // The `error` object from Zod is handled here.
                const formattedErrors = treeifyError(error);
                const resError = await createActionResult(false, null, 'VALIDATION_ERROR', JSON.stringify(formattedErrors));
                return res.status(400).json({ ...resError });
            }
            // For any other non-Zod errors, return a 500 Internal Server Error.
            const resError = await createActionResult(false, null, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred during validation.');
            return res.status(500).json({ ...resError });
        }
    };
}