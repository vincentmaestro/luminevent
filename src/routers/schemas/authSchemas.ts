import Joi from 'joi';
import Utils from '../../utils';

export const authSchemas = {
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
		role: Joi.string().valid('admin', 'staff', 'hoster', 'user').default('user').optional(),
	}),

	loginSchema: Joi.object({
		email: Joi.string().email().required().messages({
			'string.email': 'Please enter a valid email address.',
			'any.required': 'Email is required.',
		}),
		password: Joi.string().required().messages({
			'any.required': 'Password is required.',
		}),
	}),

	changePasswordSchema: Joi.object({
		oldPassword: Joi.string().required(),
		newPassword: Joi.string()
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
			})
			.custom(async (value, helpers) => {
				// Custom validation for common passwords
				if (Utils.AuthUtils.isCommonPassword(value)) {
					return helpers.error('any.custom', {
						message: 'Password is too common and easily guessable.',
					});
				}

				// Custom validation for password similarity
				const oldPassword = helpers.state.ancestors[0].oldPassword;
				if (oldPassword) {
					const similarityThreshold = 0.7;
					const similarity = await Utils.AuthUtils.calculatePasswordSimilarity(
						value,
						oldPassword,
					);
					if (similarity >= similarityThreshold) {
						return helpers.error('any.custom', {
							message:
								'New password must be significantly different from your old password.',
						});
					}
				}

				return value; // Return the value if validation passes
			}),
	}),

	userSettingsSchema: Joi.object({
		userId: Joi.string().uuid().optional(),
		notification: Joi.object({
			email: Joi.boolean().default(true),
			sms: Joi.boolean().default(false),
			push: Joi.boolean().default(true),
		}).default({
			email: true,
			sms: false,
			push: true,
		}),
		preferences: Joi.object({
			theme: Joi.string().valid('light', 'dark', 'system').default('light'),
		}).default({
			theme: 'light',
		}),
	}).optional(),

	resetPasswordSchema: Joi.object({
		token: Joi.string().min(1).required(),
		newPassword: Joi.string()
			.min(8)
			.regex(/[A-Z]/)
			.regex(/[0-9]/)
			.regex(/[!@#$%^&*.]/)
			.required(),
	}),

	paginatedDataParamSchema: Joi.object({
		pagesize: Joi.number().integer().min(1).default(20),
		cursor: Joi.date()
			.iso()
			.optional()
			.default(() => {
				const date = new Date();
				date.setFullYear(date.getFullYear() - 10);
				date.setDate(date.getDate() - 1);
				return date;
			}),
	}).optional(),

	emailVerificationSchema: Joi.object({
		token: Joi.string().required().messages({
			'any.required': 'Token required',
		}),
	}),

	createGoogleUserSchema: Joi.object({
		email: Joi.string().email().required().messages({
			'string.email': 'Please enter a valid email address.',
			'any.required': 'Email is required.',
		}),
		name: Joi.string().min(1).required().messages({
			'string.min': 'Name is required.',
			'any.required': 'Name is required.',
		}),
		avatar: Joi.string().uri().optional().allow(null),
		emailVerified: Joi.boolean().default(true),
		role: Joi.string().valid('admin', 'staff', 'hoster', 'user').default('user'),
		googleId: Joi.string().min(1).required(),
	}),

	requestResetPasswordSchema: Joi.object({
		email: Joi.string().email().required().messages({
			'string.email': 'Please enter a valid email address.',
			'any.required': 'Email is required.',
		}),
	}),

	resendEmailVerificationSchema: Joi.object({
		email: Joi.string().email().required().messages({
			'string.email': 'Please enter a valid email address.',
			'any.required': 'Email is required.',
		}),
	}),
};
