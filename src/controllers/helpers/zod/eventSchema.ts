import { z } from 'zod';

export const eventVenueTypeEnum = z.enum(['virtual', 'physical']);
export const eventRecurranceTypeEnum = z.enum(['once', 'daily', 'weekly', 'monthly', 'yearly']);
export const eventRecurranceLocationEnum = z.enum(['online', 'venue', 'other']);
export const eventStatusEnum = z.enum(['published', 'completed', 'cancelled', 'ongoing', 'draft']);

export const EventCategorySchema = z.object({
	name: z.string().min(1, 'Category name is required.'),
	description: z.string().optional(),
	image: z.url('Invalid URL format for image.').optional(),
	isActive: z.boolean().optional(),
});

export const EventCategoryUpdateSchema = z.object({
	name: z.string().min(1, 'Category name is required.'),
	description: z.string().optional(),
	image: z.url('Invalid URL format for image.').optional(),
	isActive: z.boolean().optional(),
});

export const EventTagSchema = z.object({
	name: z.string().min(1, 'Tag name is required.'),
});

export const EventTagUpdateSchema = z.object({
	name: z.string().min(1, 'Tag name is required.').optional(),
});

// Define schemas for related tables
export const EventRecurranceDetailSchema = z.object({
	recurrenceDate: z
		.string()
		.min(1, 'Recurrence Date required')
		.default(() => new Date().toISOString()),
	recurrenceStartTime: z.string(), // Coerces a string to a Date object
	recurrenceEndTime: z.string(), // Coerces a string to a Date object
	recurrenceTimezone: z.string().min(1, 'Timezone is required.'),
	recurrenceType: eventRecurranceTypeEnum,
	recurrenceLocationType: eventRecurranceLocationEnum,
	recurrenceLocation: z.string().optional(),
	latitude: z.string().optional(),
	longitude: z.string().optional(),
	isActive: z.boolean().default(true).optional(),
	isCancelled: z.boolean().default(false).optional(),
});

export const EventContactSchema = z.object({
	website: z.url('Invalid URL format.').optional(),
	email: z.email('Invalid email format.').min(1, 'Email is required.'),
	phone: z.url().min(10).optional(),
	facebook: z.url().optional(),
	instagram: z.url().optional(),
	linkedin: z.url().optional(),
	twitterX: z.url().optional(),
	isPrimary: z.boolean().default(false).optional(),
});

// Main schema for creating an event
export const CreateEventInputSchema = z.object({
	// organiserID: z.string().uuid(),
	eventName: z.string().min(1, 'Event name is required.'),
	eventCategory: z.string(),
	eventDescription: z.string().min(1, 'Event description is required.'),
	eventBanner: z.url('Event banner must be a valid URL.'),
	publishedTimestamp: z.date().optional(),
	isRecurringEvent: z.boolean().optional(),
	isSingleEvent: z.boolean().optional(),
	status: eventStatusEnum.optional(),
	organizedBy: z.string().optional(),
	public: z.boolean().default(false),
	private: z.boolean().default(false),
	publish: z.boolean().default(false),
	schedule: z.boolean().default(false),

	// Nested schemas for relations
	tags: z.array(z.string()).min(1, 'At least one tag is required.'),
	recurrenceDetails: z.array(EventRecurranceDetailSchema).optional(),
	contact: EventContactSchema,
});

export const UpdateEventInputSchema = z
	.object({
		organiserID: z.uuid(),
		eventName: z.string().min(1, 'Event name is required.'),
		eventCategory: z.uuid(),
		eventDescription: z.string().min(1, 'Event description is required.'),
		eventBanner: z.url('Event banner must be a valid URL.'),
		publishedTimestamp: z.date().optional(),
		isRecurringEvent: z.boolean().optional(),
		isSingleEvent: z.boolean().optional(),
		status: eventStatusEnum.optional(),
		organizedBy: z.string().optional(),
		public: z.boolean().default(false),
		private: z.boolean().default(false),
		publish: z.boolean().default(false),
		schedule: z.boolean().default(false),

		// Nested schemas for relations
		tags: z.array(z.uuid()).optional(),
		recurrenceDetails: z.array(EventRecurranceDetailSchema).optional(),
		contact: EventContactSchema.optional(),
	})
	.optional();

// TypeScript Types
export type EventRecurranceDetail = z.infer<typeof EventRecurranceDetailSchema>;
export type EventContact = z.infer<typeof EventContactSchema>;
export type CreateEventInput = z.infer<typeof CreateEventInputSchema>;

export const EventSchema = z.object({
	id: z.uuid(),
	organiserID: z.uuid().nullable(),
	eventName: z.string().min(1),
	eventCategory: z.string().min(1),
	eventDescription: z.string().min(1),
	eventBanner: z.url().or(z.string().min(1)),
	isRecurringEvent: z.boolean().default(false),
	recurrenceType: z.string().nullable(),
	recurrenceInterval: z.number().int().nullable(),
	recurrenceEndDate: z.date().nullable(),
	recurrenceCount: z.number().int().nullable(),
	daysOfWeek: z.array(z.string()).nullable(),
	monthlyType: z.string().nullable(),
	eventTimestamp: z.date(),
	timezone: z.string().min(1),
	eventVenueType: eventVenueTypeEnum,
	status: eventStatusEnum,
	eventLocation: z.string().min(1),
	latitude: z.string().nullable(),
	longitude: z.string().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export type EventValidated = z.infer<typeof EventSchema>;
