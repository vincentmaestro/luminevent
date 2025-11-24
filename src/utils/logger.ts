import "dotenv/config"

import winston from "winston";
import TelegramLogger from "winston-telegram";
import DailyRotateFile from "winston-daily-rotate-file";
import config from '../config';
// @ts-ignore
const { combine, timestamp, json, errors, cli, colorize, printf } = winston.format;


/**
 * Configures and returns a Winston logger instance with daily file rotation.
 * Logs are formatted as JSON and include timestamps and error stack traces.
 * Exception and rejection handlers are configured to log to separate files.
 *
 * The logging level is determined by the LOG_LEVEL environment variable, defaulting to 'info'.
 * Log files are rotated daily, kept for 14 days, and have a maximum size of 5MB.
 *
 * @param {string} [serviceName] - Optional. The name of the service or module using the logger.
 * This will be included in the log metadata. Defaults to "web" if not provided.
 * @returns {winston.Logger} A configured Winston logger instance.
 *
 * @example
 * // Import the logger function
 * import { logger } from './path/to/your/logger';
 *
 * // Get a logger instance for a specific service
 * const myServiceLogger = logger('UserService');
 *
 * // Use the logger to log messages
 * myServiceLogger.info('User created successfully', { userId: 123 });
 * myServiceLogger.error('Failed to fetch user data', { error: err.message });
 *
 * @example
 * // Get a logger instance with the default service name ("web")
 * const defaultLogger = logger();
 * defaultLogger.warn('Something unusual happened');
 */
export default function logger(serviceName?: string): winston.Logger {
    const isProduction = config.NODE_ENV === "production";
    const service = serviceName || (isProduction ? "api" : "web");
    const level = isProduction ? "info" : "debug";

    // Base logger configuration
    const loggerConfig: winston.LoggerOptions = {
        exitOnError: false,
        level,
        defaultMeta: { service },
        format: combine(
            errors({ stack: true }),
            timestamp({ format: "hh:mm" }),
            isProduction ? json() : combine(
                colorize(),
                printf(info => {
                    const stack = info.stack ? `\n${info.stack}` : '';
                    return `[WINSTON][${info.timestamp}] [${info.level}]: ${info.message}${stack}`;
                })
            ),
        ),
        transports: [
            new winston.transports.Console()
        ],
        exceptionHandlers: [
            new winston.transports.File({ filename: 'logs/exception.log' }),
        ],
        rejectionHandlers: [
            new winston.transports.File({ filename: 'logs/rejections.log' }),
        ],
    };

    // Production-specific configurations
    if (isProduction) {
        const fileRotateTransport = new DailyRotateFile({
            filename: 'log-%DATE%.log',
            datePattern: "YYYY-MM-DD",
            maxFiles: "90d",
            maxSize: "5mb"
        });

        // Ensure transports is always an array
        if (!Array.isArray(loggerConfig.transports)) {
            loggerConfig.transports = loggerConfig.transports ? [loggerConfig.transports] : [];
        }
        loggerConfig.transports.push(fileRotateTransport);

        // Add Telegram transport if configured
        if (config.TELEGRAM_TOKEN && config.TELEGRAM_ADMIN) {
            try {
                const telegramTransport = new TelegramLogger({
                    token: config.TELEGRAM_TOKEN,
                    chatId: Number(config.TELEGRAM_ADMIN),
                    level: "error",
                    unique: true,
                    handleExceptions: true
                });
                loggerConfig.transports.push(telegramTransport);
            } catch (error) {
                console.error('Failed to initialize Telegram logger:', error);
            }
        } else {
            console.info('[WINSTON] INFO - Running without Telegram transport');
        }
    }

    const log = winston.createLogger(loggerConfig);

    // !DEPRECATED Development-specific overrides
    // if (!isProduction) {
    //     log.add(new winston.transports.Console({
    //         format: combine(
    //             cli(),
    //             colorize(),
    //             printf(info => {
    //                 const stack = info.stack ? `\n${info.stack}` : '';
    //                 return `[DEV][${info.timestamp}] ${info.level}: ${info.message}${stack}`;
    //             })
    //         )
    //     }));
    // }

    return log;
}

export type Logger = winston.Logger