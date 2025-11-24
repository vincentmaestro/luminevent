import 'dotenv/config';

export default {
	NODE_ENV: process.env.NODE_ENV || 'development',
	PORT: process.env.PORT ? Number(process.env.PORT) : 3000,
	CORS_ORIGIN: process.env.CORS_ORIGIN?.split(',') || [
		'http://localhost:5173',
		'http://localhost:3000',
	],

	// Logger reporting
	TELEGRAM_TOKEN: process.env.TG_TOKEN || '',
	TELEGRAM_ADMIN: process.env.TG_ADMIN || '',

	// Authentication Configs
	SALT_ROUNDS: Number(process.env.SALT_ROUNDS) || 10,
	JWT_SECRET: process.env.JWT_SECRET,
	EMAIL_SECRET: process.env.EMAIL_SECRET,
	REFRESH_SECRET: process.env.REFRESH_SECRET,
	COOKIE_SECRET: process.env.COOKIE_SECRET,
	PASSWORD_SECRET: process.env.PASSWORD_SECRET,
	ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS
		? process.env
				.ALLOWED_ORIGINS!.split(',')
				.concat(['http://localhost:3000', 'http://localhost:5173'])
		: ['http://localhost:3000', 'http://localhost:5173'],
	// Databases
	DATABASE_URL: process.env.DATABASE_URL || 'DATABASE_URL',
	REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

	// Email Configs
	SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
	FROM_EMAIL: process.env.FROM_EMAIL || 'Account LuminEvent <noreply@luminevent.com>',
	EMAIL_VERIFICATION_URL: process.env.EMAIL_VERIFICATION_URL,
	EMAIL_RESET_URL: process.env.EMAIL_RESET_URL,
	EMAIL_USER: process.env.EMAIL_USER || 'luminmaster',
	EMAIL_PASSWORD: process.env.EMAIL_PASSWORD || 'luminmaster_password',

	// Google Configs
	GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || 'GOOGLE_CLIENT_SECRET',
	GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || 'GOOGLE_CLIENT_ID',
	GOOGLE_CLIENT_CALLBACK_URL: process.env.GOOGLE_CLIENT_CALLBACK_URL,

	CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
	API_URL: process.env.API_URL!,

	// Payment Gateways
	PAYSTACK_SK: process.env.PAYSTACK_SK || 'sk_test_31d409da24a5918fa445522c47d24ee21cb8378d',
	PAYSTACK_PK: process.env.PAYSTACK_PK || 'pk_test_e6a7ecfa2a199ce59f6b4aee90a3e2b84d18abf4',
};
