import { Response } from 'express';

export class CustomError extends Error {
    message: string = '';
    statusCode: number = 500;
    details?: any;
    constructor(message: string, statusCode: number, details?: any) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        this.name = 'CustomError';
    }
}

export const handleCustomError = (err: CustomError, res: Response) => {
    res.status(err.statusCode).json({
        error: {
            message: err.message,
            statusCode: err.statusCode
        }
    });
};