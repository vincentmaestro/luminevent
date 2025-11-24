import Joi from 'joi';

import Utils from '../../utils';

export const userSchemas = {
	updateUserSchema: Joi.object({
		name: Joi.string().min(1).optional().messages({
			'string.min': 'Name must be at least 1 character long.',
		}),
		image: Joi.string().uri().optional(),
		role: Joi.string().valid('admin', 'staff', 'hoster', 'user').optional(),
	}),

	updateUserSettingsSchema: Joi.object({
		notification: Joi.object({
			email: Joi.boolean().optional(),
			sms: Joi.boolean().optional(),
			push: Joi.boolean().optional(),
		}).optional(),
		preferences: Joi.object({
			theme: Joi.string().valid('light', 'dark', 'system').optional(),
		}).optional(),
	}),

	id: Joi.string()
		.custom((value, helpers) => {
			if (!Utils.Validators.isValidObjectId(value)) {
				return helpers.error('any.invalid', {
					message: 'Invalid user ID format.',
				});
			}
			return value;
		})
		.required()
		.messages({
			'any.invalid': 'Invalid user ID format.',
			'any.required': 'User ID is required.',
		}),

	email: Joi.string().email().required().messages({
		'string.email': 'Please enter a valid email address.',
		'any.required': 'Email is required.',
	}),
};
