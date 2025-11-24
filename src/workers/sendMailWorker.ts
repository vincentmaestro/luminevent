// src/queue/emailWorker.ts

import { Job, Worker } from 'bullmq';
// @ts-ignore
import { EMAIL_QUEUE_NAME, emailQueue } from './queue';
import {
	sendPasswordResetEmail,
	sendTransactionalEmail,
	sendUserVerificationEmail,
} from '../services/emailService'; // Import your functions
import logger from '../utils/logger';
import { EmailJobData } from '../types';
import { luminQueueOptions } from '.';

/**
 * BullMQ Worker responsible for processing email jobs.
 * It listens to the `emailQueue`, determines the email type from the job data,
 * and calls the appropriate email service function.
 *
 * @param {Job<EmailJobData>} job The BullMQ job object containing the email task data.
 * @throws {Error} Throws an error if the job type is unknown or if the email fails to send.
 * * @example
 * ```typescript
 * // Example of adding a password reset job to the queue
 * import { addEmailJob } from './queue/emailQueue';
 *
 * await addEmailJob("emailQueue", {
 * type: 'passwordReset',
 * to: 'user@example.com',
 * token: 'xyz123token',
 * callbackUrl: '[https://app.example.com/reset-password](https://app.example.com/reset-password)'
 * });
 *
 * // Example of adding an email verification job
 * await addEmailJob("emailQueue", {
 * type: 'emailVerification',
 * to: 'newuser@example.com',
 * token: 'abc456token',
 * callbackUrl: '[https://app.example.com/verify-email](https://app.example.com/verify-email)'
 * });
 *
 * // Example of adding a generic transactional email job
 * await addEmailJob("emailQueue", {
 * type: 'transactional',
 * to: 'admin@example.com',
 * subject: 'New User Registration',
 * body: 'A new user has registered on your platform.'
 * });
 * ```
 */
const emailWorker =
	new Worker<EmailJobData>(
		EMAIL_QUEUE_NAME,
		async (job: Job<EmailJobData>) => {
			logger('[EMAIL_WORKER]').info(`Processing job ${job.id} of type '${job.name}'`);

			const { type, to, ...rest } = job.data;

			try {
				switch (type) {
					case 'passwordReset':
						await sendPasswordResetEmail(rest.token!, to, rest.callbackUrl!);
						logger('[EMAIL_WORKER]').info(
							`Successfully sent password reset email to ${to}`,
						);
						break;
					case 'emailVerification':
						await sendUserVerificationEmail(rest.token!, to, rest.callbackUrl!);
						logger('[EMAIL_WORKER]').info(
							`Successfully sent user verification email to ${to}`,
						);
						break;
					case 'transactional':
						await sendTransactionalEmail(job.data);
						logger('[EMAIL_WORKER]').info(
							`Successfully sent transactional email to ${to}`,
						);
						break;
					default:
						logger('[EMAIL_WORKER]').warn(
							`Unknown job type: '${job.name}' for job ${job.id}`,
						);
						// Throw an error to mark the job as failed
						throw new Error(`Unknown job type: ${job.name}`);
				}
			} catch (error: any) {
				logger('[EMAIL_WORKER]').error(
					`Job ${job.id} failed: ${error.message || 'No Error Message'}`,
				);
				// The worker automatically retries the job based on the queue's defaultJobOptions
				throw error; // Re-throw the error to ensure BullMQ marks the job as failed
			}
		},
		// @ts-ignore
		{ connection: luminQueueOptions!.connection },
	);

// Handle worker events for better monitoring
emailWorker &&
	emailWorker.on('ready', () => {
		logger('[EMAIL_WORKER]').info('Email worker is ready and waiting for jobs.');
	});

emailWorker &&
	emailWorker.on('completed', (job) => {
		logger('[EMAIL_WORKER]').info(`Job ${job.id} has completed.`);
	});

emailWorker &&
	emailWorker.on('failed', (job, err) => {
		logger('[EMAIL_WORKER]').error(`Job ${job?.id} failed with error: ${err.message}`);
	});

emailWorker &&
	emailWorker.on('error', (err) => {
		logger('[EMAIL_WORKER]').error(`Worker error: ${err.message}`);
	});

export default emailWorker;
