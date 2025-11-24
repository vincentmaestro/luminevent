// src/services/emailQueue.ts
import { Queue, Job } from 'bullmq';
import logger from '../utils/logger';
import { luminQueueOptions, validateQueueRedisConfig } from '.';

export const EMAIL_QUEUE_NAME = 'emailQueue';

// Initialize queue
validateQueueRedisConfig;
export const emailQueue = new Queue(EMAIL_QUEUE_NAME, luminQueueOptions);
logger('emailQueue').info(`Initialized queue '${EMAIL_QUEUE_NAME}'`);

/**
 * Adds an email job to the queue for asynchronous processing
 * @param {EmailJobData} data - Email job data
 * @param {string} [jobId] - Optional custom job ID
 * @returns {Promise<Job>} BullMQ Job instance
 * @throws {Error} If job cannot be added to the queue
 */
export async function addJobToQueue<EmailJobData>(
	jobName: string,
	data: EmailJobData,
	jobId?: string,
): Promise<Job<EmailJobData>> {
	try {
		if (!emailQueue) {
			throw new Error('Email queue is not initialized');
		}

		// Clean completed jobs
		await emailQueue.clean(0, 100, 'completed').then(() => {
			logger('emailQueue').info(`Cleaned up completed jobs in queue '${jobName}'`);
		});

		// clean failed email jobs
		await emailQueue.clean(0, 5, 'failed').then(async () => {
			logger('emailQueue').info(`Cleaned up failed jobs in queue '${jobName}'`);
		});

		// Clean paused jobs
		// Note: This is optional and can be removed if you don't want to clean paused
		// jobs. It is included here to ensure that the queue remains clean.
		await emailQueue.clean(0, 20, 'paused').then(async () => {
			logger('emailQueue').info(`Cleaned up failed jobs in queue '${jobName}'`);
		});

		// Add job to the queue
		logger('emailQueue').info(
			`Adding job '${jobName}' to queue with data: ${JSON.stringify(data)}`,
		);
		const job = await emailQueue.add(jobName, data, { jobId });
		logJobAdded(jobName, job, data);
		return job;
	} catch (error) {
		logJobAddError(jobName, error, data);
		throw error;
	}
}

// Helper functions for logging
function logJobAdded<T>(jobName: string, job: Job, data: T) {
	// Constructing the optional part of the log message to ascertain if it is an email job to add the email recipient info
	const recipientInfo =
		jobName === EMAIL_QUEUE_NAME && typeof (data as any).to === 'string'
			? ` for ${(data as any).to}`
			: '';

	// Log the message with the recipient information appended
	logger('emailQueue').info(`Added ${jobName} job with ID: ${job.id} to queue${recipientInfo}`);
}

function logJobAddError<T>(jobName: string, error: unknown, data: T) {
	// Constructing the optional part of the log message to ascertain if it is an email job to add the email recipient info
	const recipientInfo =
		jobName === EMAIL_QUEUE_NAME && typeof (data as any).to === 'string'
			? ` for ${(data as any).to}`
			: '';

	logger('emailQueue').error(`Failed to add ${jobName} job ${recipientInfo}: ${error}`);
}
