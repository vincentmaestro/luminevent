import { createClient, type RedisClientType } from 'redis';
import logger from '../utils/logger'; // Assuming you have a logger utility
import config from '../config'; // Assuming your config file exports the necessary configuration

let redisClient: RedisClientType | null = null;

/**
 * Initializes the Redis client with the provided configuration.
 * @param {string} url - The Redis connection URL.
 * @returns {Promise<RedisClientType>} The initialized Redis client.
 */
export async function initializeRedisClient(): Promise<RedisClientType> {
    if (!config.REDIS_URL) {
        logger("[REDIS_CLIENT]").error('Redis connection URL is not provided.');
        throw new Error('Redis connection URL is required.');
    }

    if (redisClient) {
        logger("[REDIS_CLIENT]").warn('Redis client is already initialized.');
        return redisClient;
    }

    try {
        redisClient = createClient({ url: config.REDIS_URL });
        redisClient.on('connect', () => {
          logger("[REDIS_CLIENT]").info('Redis client connecting...');
        });

        redisClient.on('ready', () => {
          logger("[REDIS_CLIENT]").info('Redis client connected successfully.');
        });

        redisClient.on('error', (err) => {
          logger("[REDIS_CLIENT]").error('Redis client error:', err);
        });

        redisClient.on('reconnecting', () => {
          logger("[REDIS_CLIENT]").info('Redis client reconnecting...');
        });

        redisClient.on('end', () => {
          logger("[REDIS_CLIENT]").info('Redis client disconnected.');
        });

        await redisClient.connect();
        return redisClient;
    } catch (error) {
        logger("[REDIS_CLIENT]").error('Failed to connect to Redis:', error);
        throw error;
    }
}