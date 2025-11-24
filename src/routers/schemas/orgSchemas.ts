import Joi from 'joi';

// Common address schema
export const AddressSchema = Joi.object({
	street: Joi.string().min(1),
	city: Joi.string().min(1),
	state: Joi.string().min(1),
	postalCode: Joi.string().min(1),
	country: Joi.string().min(1),
});

// Organizer schema
export const OrganizerSchema = Joi.object({
	email: Joi.string().email(),
	organisationName: Joi.string().min(1),
	phoneNumber: Joi.string().min(8),
	phoneNumberVerified: Joi.boolean().default(false),
	address: AddressSchema.optional(),
	logo: Joi.string().uri().optional(),
	bio: Joi.string().optional(),
	website: Joi.string().uri().optional(),
});

// Main create schema
export const CreateOrganiserSchema = Joi.object({
	// User fields
	email: Joi.string().email().required(),
	password: Joi.string()
		.min(8)
		.regex(/[A-Z]/)
		.regex(/[0-9]/)
		.regex(/[!@#$%^&*]/)
		.required(),
	name: Joi.string().min(1).required(),
	image: Joi.string().uri().optional(),
	role: Joi.string().valid('admin', 'staff', 'hoster', 'user').default('user'),

	// Organizer fields
	organiser: OrganizerSchema.required(),
});

export const id = Joi.string().required().messages({
	'any.invalid': 'Invalid organiser ID format.',
	'any.required': 'Organiser ID is required.',
});

export const AddOrganiserPayoutHistorySchema = Joi.object({
	amount: Joi.number().positive().required(),
	status: Joi.string().valid('pending', 'completed', 'failed').default('pending').optional(),
});

export const AddSocialAccountSchema = Joi.object({
	platform: Joi.string()
		.valid('facebook', 'twitterX', 'tiktok', 'youtube', 'instagram', 'linkedin')
		.required(),
	url: Joi.string().uri().min(1).required(),
});

export const UpdateOrganiserSocialAccount = Joi.object({
	platform: Joi.string()
		.valid('facebook', 'twitterX', 'tiktok', 'youtube', 'instagram', 'linkedin')
		.optional(),
	url: Joi.string().uri().optional(),
});

export const UpdateOrganiserPayoutHistorySchema = Joi.object({
	amount: Joi.number().positive(),
	status: Joi.string().valid('pending', 'completed', 'failed'),
	transactionId: Joi.string().min(1),
}).or('amount', 'status', 'transactionId');

export default {
	id,
	CreateOrganiserSchema,
	AddOrganiserPayoutHistorySchema,
	AddSocialAccountSchema,
	UpdateOrganiserSocialAccount,
	UpdateOrganiserPayoutHistorySchema,
	OrganizerSchema,
	AddressSchema,
};
