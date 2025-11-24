import { NextFunction, Request, Response } from 'express';
import { RedisClientType } from 'redis';

export const createRedisMiddleware = (redisClient: RedisClientType) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    req.redisClient = redisClient;
    next();
  };
};
