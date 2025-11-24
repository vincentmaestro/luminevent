import Joi from 'joi';

export const adminSchemas = {
	registerSchema: Joi.object({
		email: Joi.string().email().required().messages({
			'string.email': 'Please enter a valid email address.',
			'any.required': 'Email is required.',
		}),
		password: Joi.string()
			.min(8)
			.regex(/[A-Z]/)
			.regex(/[0-9]/)
			.regex(/[!@#$%^&*.]/)
			.required()
			.messages({
				'string.min': 'Password must be at least 8 characters long.',
				'string.pattern.base':
					'Password must contain at least one uppercase letter, one number, and one special character.',
				'any.required': 'Password is required.',
			}),
		name: Joi.string().min(1).required().messages({
			'string.min': 'Name is required.',
			'any.required': 'Name is required.',
		}),
		image: Joi.string().uri().optional(),
		role: Joi.string().valid('admin', 'staff', 'hoster', 'user').default('admin').optional(),
	}),
};
