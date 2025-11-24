import { Request } from 'express';
import { RedisClientType } from 'redis';

export interface DBUser {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	image: string | null;
	role: 'admin' | 'staff' | 'hoster' | 'user';
	banned: boolean | null;
	lastLogin: Date;
	createdAt: Date;
	updatedAt: Date;
}

declare module 'express' {
	export interface Request {
		redisClient?: RedisClientType; // Assuming RedisClientType is imported from your Redis client module
		activeUser?: DBUser; // Or a more specific user type
	}
}

export interface AuthRequest extends Request { }
