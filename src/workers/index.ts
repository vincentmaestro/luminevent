import config from '../config';
import emailWorker from './sendMailWorker';
import logger from '../utils/logger';
import { QueueOptions } from 'bullmq';

export default {
	emailWorker,
};

// Constants
const JOB_CLEANUP_AGE_MS = 24 * 60 * 60 * 1000; // 1 day
const JOB_CLEANUP_LIMIT = 4;
const DEFAULT_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

// Validate redis configuration
export const validateQueueRedisConfig = () => {
	if (!config.REDIS_URL) {
		logger('[QUEUE]').error('REDIS_URL is not defined in config');
		throw new Error('Redis configuration is required for queue');
	}
};

// Queue configuration
export const luminQueueOptions = {
	connection: {
		url: config.REDIS_URL,
		maxRedirections: 5,
	},
	defaultJobOptions: {
		attempts: DEFAULT_RETRY_ATTEMPTS,
		priority: 1, // Default priority for email jobs
		stackTraceLimit: 10, // Limit stack trace to 10 lines
		backoff: {
			type: 'exponential',
			delay: INITIAL_RETRY_DELAY_MS,
		},
		removeOnComplete: {
			age: 1000, // 1 hour
			count: 100, // Keep the last 100 completed jobs
		},
		removeOnFail: {
			age: JOB_CLEANUP_AGE_MS, // 7 days
			count: JOB_CLEANUP_LIMIT, // Keep the last 1000 failed jobs
		},
	},
} satisfies QueueOptions;
