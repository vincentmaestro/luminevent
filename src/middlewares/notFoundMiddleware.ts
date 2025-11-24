import { Request, Response, NextFunction } from "express";
import { NotFoundOptions } from "../types";
import { CustomError } from "../utils/customError";
import winLogger from "../utils/logger";

/**
 * @deprecated
 * Enhanced 404 Not Found middleware with configurable options deprecated in favor of createErrorHandler
 *
 * @param options Configuration options for the middleware
 * @returns Middleware function that handles 404 errors
 *
 * @example
 * // Basic usage
 * app.use(notFound());
 *
 * // With options
 * app.use(notFound({
 *     log: true,
 *     includePath: true,
 *     logger: console.warn
 * }));
 */
export function notFound(options: NotFoundOptions = {}) {
    const {
        log = false,
        includePath = false,
        logger = winLogger("[NOT_FOUND]")
    } = options;

    return (req: Request, _res: Response, next: NextFunction) => {
        const errorMessage = includePath
            ? `Route not found: ${req.method} ${req.originalUrl}`
            : 'Route not found';

        if (log) {
            logger.info(`404 Not Found: ${req.method} ${req.originalUrl}`);
        }

        next(new CustomError(errorMessage, 404, {
            method: req.method,
            path: req.originalUrl
        }));
    };
}