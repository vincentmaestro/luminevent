import 'reflect-metadata';
import express, { Response, Request } from 'express';
import swaggerUi from 'swagger-ui-express';
import cookieParser from 'cookie-parser';
import config from './config';
import logger from './utils/logger';
import cors from 'cors';
import methodOverride from 'method-override';
import helmet from 'helmet';
import { createErrorHandler } from './middlewares/errorMiddleware';
import { RegisterRoutes } from '../build/routes';
import { errors } from 'celebrate';
import { initializeRedisClient } from './redis/client';
import { RedisClientType } from 'redis';
import { createRedisMiddleware } from './middlewares/redisMiddleware';
import mail from '@sendgrid/mail';
import './controllers/strategies/google.strategy';

// --- Max Listeners Fix ---
// This line increases the maximum number of event listeners for the 'process' object.
// It's common to set this higher (or to 0 for no limit) in development environments
// when using tools like nodemon which can cause listeners to accumulate across restarts.
config.NODE_ENV !== 'production' && process.setMaxListeners(0); // Set to 0 for unlimited listeners, or a higher number like 20 or 50.

// --- Server Initialization ---
async function initializeServer() {
	const log = logger('[SERVER]');
	const app = express();
	let redisClient: RedisClientType | null = null;

	// --- Configuration ---
	// --- Server Startup ---
	const server = app
		.listen(config.PORT, () => {
			log.info(`
################################################
🛡️  Server listening on port: ${config.PORT} 🛡️
################################################
    `);
			log.info(`
################################################
🛡️  Node Enviroment: ${config.NODE_ENV} 🛡️
################################################
    `);
			log.info(`
################################################
🛡️  Approved Endpoints 🛡️
################################################
    `);
			log.info(`- GET /status - Health check`);
			log.info(`- GET / - Root endpoint`);
			log.info(`- GET /api/v1/docs - Swagger Docs`);
			log.info(`- POST /api/v1/auth - Auth Endpoints Base Routes`);
			log.info(`- POST /api/v1/admin - Admin Endpoints Base Routes`);
			log.info(`- POST /api/v1/users - User Endpoints Base Routes`);
			log.info(`- POST /api/v1/organiser/ - Organizer Endpoints Base Routes`);
			log.info(`- POST /api/v1/events/ - Events Endpoints Base Routes`);
			// Add more routes here as you implement them
		})
		.on('error', (err) => {
			log.error(`Error starting server: ${err.message}`);
			process.exit(1); // Exit the process if the server fails to start
		});

	try {
		redisClient = await initializeRedisClient();
		app.use(createRedisMiddleware(redisClient));
		logger('[REDIS_CLIENT]').info('Redis is Initialized and connected.');
	} catch (err) {
		logger('[REDIS_CLIENT]').error('Failed to initialize Redis connection:', err);
		// Depending on your application requirements, you might want to:
		// 1. Retry the connection
		// 2. Exit the process if Redis is critical
		// 3. Continue with limited functionality
	}

	// --- SendGrid Email Service Initialization ---
	try {
		mail.setApiKey(config.SENDGRID_API_KEY as string);
		logger('[SENDGRID]').info('SendGrid Email Service Initialized.');
	} catch (error) {
		logger('[SENDGRID]').error('Failed to initialize SendGrid:', error);
		// Handle the error as needed, e.g., exit the process or continue with limited functionality
	}

	// --- Middleware Registration ---
	// app.enable('trust proxy');

	// --- Express Middleware ---
	app.use(
		cors({
			origin: config.ALLOWED_ORIGINS, //!important - Adjust as needed for production (use the frontend URL)
			methods: ['GET', 'PUT', 'PATCH', 'POST', 'DELETE'],
			credentials: true,
			preflightContinue: false,
			optionsSuccessStatus: 204,
			maxAge: 86400, // Cache preflight response for 24 hours
		}),
	);
	app.use(cookieParser(config.COOKIE_SECRET));
	app.use(methodOverride());

	// Body parsers for various content types
	app.use(express.urlencoded({ extended: true, limit: '100mb' }));
	app.use(express.json({ limit: '100mb' }));
	app.use(express.raw({ type: 'application/octet-stream', limit: '100mb' }));
	app.use(express.text({ type: 'text/plain', limit: '100mb' }));
	app.use(express.static('public', { maxAge: '1d' })); // Serve static files from the "public" directory
	app.use(
		helmet({
			dnsPrefetchControl: { allow: true },
			hidePoweredBy: true,
			xssFilter: true,
		}),
	);

	// --- Non Authenticated Routes --- //
	// --- Health Check Routes ---
	app.get('/health', async (_req: Request, res: Response) => {
		// Made async
		const redisHealth = redisClient
			? await redisClient
					.ping()
					.then(() => ({ isReady: true }))
					.catch(() => ({ isReady: false }))
			: { isReady: false };

		return res.status(200).json({
			status: 'healthy',
			uptime: process.uptime(),
			environment: config.NODE_ENV || 'development',
			timestamp: new Date().toISOString(),
			version: process.env.npm_package_version || '1.0.0',
			redis: { connected: redisHealth.isReady },
		});
	});

	app.get('/', (_req: Request, res: Response) => {
		return res.status(200).send('Luminevent Backend is running!');
	});

	// --- TSOA Routes ---
	RegisterRoutes(app);

	// --- Swagger Documentation ---
	app.use('/api/v1/docs', swaggerUi.serve, async (_req: Request, res: Response) => {
		return res.send(swaggerUi.generateHTML(await import('../docs/swagger.json')));
	});

	app.use(errors());
	app.use(createErrorHandler(config.NODE_ENV));

	// --- Graceful Shutdown Handler ---
	function handleShutdown(signal: string) {
		return async () => {
			log.info(`Received ${signal}. Initiating graceful shutdown...`);

			try {
				await new Promise<void>((resolve, reject) => {
					server.close((err) => {
						if (err) {
							reject(err);
							return;
						}
						resolve();
					});

					setTimeout(() => {
						reject(new Error('Shutdown timeout exceeded'));
					}, 10000);
				});

				// 2. Close Redis connection
				if (redisClient && redisClient.isOpen) {
					log.info(`Received ${signal}. Closing Redis connection...`);
					redisClient.destroy();
					log.info('Redis client disconnected.');
				}

				log.info('Server shut down successfully');
				process.exit(0);
			} catch (err) {
				log.error('Error during shutdown:', err);
				process.exit(1);
			}
		};
	}

	// --- Process Event Handlers ---
	process.on('SIGTERM', handleShutdown('SIGTERM'));
	process.on('SIGINT', handleShutdown('SIGINT'));
	process.on('unhandledRejection', (reason, promise) => {
		log.error('Unhandled Rejection at:', promise, 'reason:', reason);
	});
	process.on('uncaughtException', (error) => {
		log.error('Uncaught Exception:', error);
		handleShutdown('uncaughtException')().catch(() => process.exit(1));
	});

	return server;
}

export default initializeServer;
