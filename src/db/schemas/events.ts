import * as drizzle from 'drizzle-orm/pg-core';
import { organiser } from './usersAndOrganiser';
import { timestamps } from '../helpers/timestamp';
import { relations } from 'drizzle-orm';
import {
	eventSeatMapping,
	mixedSeating,
	sectionAndRowsSeating,
	tableAndChairsSeating,
} from './eventSeatings';
import { Organiser } from '../../types/user';
import { MixedSeating, SectionAndRowsSeating, TableAndChairsSeating } from '../../types/seating';

// Enum for the type of event venue
// - virtual: Online events (e.g., webinars)
// - physical: In-person events
// export const eventVenueTypeEnum = drizzle.pgEnum('event_types', ['virtual', 'physical']);

export const eventRecurranceTypeEnum = drizzle.pgEnum('recurrence_type', [
	"once",
	'daily',
	'weekly',
	'monthly',
	'yearly',
]);

export const eventRecurranceLocationEnum = drizzle.pgEnum('recurrence_location', [
	'online',
	'venue',
	'other',
]);

/**
 * Enum for Event Status
 */
export const eventStatusEnum = drizzle.pgEnum('status', [
	'published',
	'completed',
	'cancelled',
	'ongoing',
	'draft',
]);

// Main table for storing event categories
export const eventCategory = drizzle.pgTable(
	'event_category',
	{
		id: drizzle.uuid().defaultRandom().primaryKey(), // Unique ID for the category
		name: drizzle.text('name').notNull(), // Name of the category (e.g., Music, Tech)
		description: drizzle.text('description'), // Optional description of the category
		isActive: drizzle.boolean('is_active').default(true), // Whether the category is active
		image: drizzle.text('image'), // Optional image for the category
		...timestamps, // created_at & updated_at columns
	},
	(table) => [
		// Indexes for faster lookups
		drizzle.index('idx_event_category_name').on(table.name), // Index on category name
		drizzle.index('idx_event_category_created_at').on(table.createdAt), // Index on creation date
	],
);

export const eventTags = drizzle.pgTable('event_tags', {
	id: drizzle.uuid().defaultRandom().primaryKey(), // Unique ID for the tag
	name: drizzle.text().notNull(), // Tag text (e.g., "Music", "Conference")
	...timestamps, // created_at & updated_at columns
});

export const eventToTags = drizzle.pgTable('event_to_tags', {
	id: drizzle.uuid().defaultRandom().primaryKey(), // Unique ID for the association
	eventId: drizzle
		.uuid("event_id")
		.notNull()
		.references(() => events.id, { onDelete: 'cascade' }), // Linked event
	tagId: drizzle
		.uuid("tag_id")
		.notNull()
		.references(() => eventTags.id, { onDelete: 'cascade' }), // Linked tag
	...timestamps, // created_at & updated_at columns
});

export const eventRecurranceDetail = drizzle.pgTable(
	'event_recurring_dates',
	{
		id: drizzle.uuid().defaultRandom().primaryKey(), // Unique ID for the recurring date
		eventId: drizzle
			.uuid('event_id')
			.notNull()
			.references(() => events.id, { onDelete: 'cascade' }), // Linked event
		recurrenceDate: drizzle.date('recurrence_date').notNull(), // Date of the recurring event
		recurrenceStartTime: drizzle.time('recurrence_start_time').notNull(), // Date of the recurring event
		recurrenceEndTime: drizzle.time('recurrence_end_time').notNull(), // Date of the recurring event
		recurrenceTimezone: drizzle.text('recurrence_timezone').notNull(), // Timezone for the recurring event
		recurrenceType: eventRecurranceTypeEnum('recurrence_type').notNull(), // Type of recurrence (daily, weekly, monthly)
		recurrenceLocationType: eventRecurranceLocationEnum('recurrence_location_type').notNull(), // Location of the recurrence (online, venue, other)
		recurrenceLocation: drizzle.text('recurrence_location'), // Location details (e.g., online link, venue address)
		latitude: drizzle.numeric('latitude'), // For mapping/location purposes
		longitude: drizzle.numeric('longitude'), // For mapping/location purposes
		isActive: drizzle.boolean('is_active').default(true), // Whether the recurrence is active
		isCancelled: drizzle.boolean('is_cancelled').default(false), // Whether the recurrence is cancelled
		...timestamps, // created_at & updated_at columns
	},
	(table) => [
		// Indexes for faster lookups
		drizzle.index('idx_event_recurring_dates_event_id').on(table.eventId), // Index on event ID
		drizzle.index('idx_event_recurring_dates_recurrence_date').on(table.recurrenceDate), // Index on recurrence date
		drizzle
			.index('idx_event_recurring_dates_recurrence_start_time')
			.on(table.recurrenceStartTime), // Index on recurrence start time
		drizzle.index('idx_event_recurring_dates_recurrence_end_time').on(table.recurrenceEndTime), // Index on recurrence end time
		drizzle.index('idx_event_recurring_dates_recurrence_timezone').on(table.recurrenceTimezone), // Index on recurrence timezone
	],
);

// Main table for storing event details
export const events = drizzle.pgTable(
	'events',
	{
		id: drizzle.uuid().defaultRandom().primaryKey(), // Unique event ID
		organiserID: drizzle
			.uuid('organiser_id')
			.references(() => organiser.id, { onDelete: 'cascade' }), // Linked organiser
		eventName: drizzle.varchar('event_name').notNull(), // Event title
		eventCategory: drizzle
			.uuid('event_category')
			.notNull()
			.references(() => eventCategory.id, { onDelete: 'cascade' }), // Category (e.g., Music, Tech, Sports)
		eventDescription: drizzle.text('event_description').notNull(), // Detailed description of the event
		eventBanner: drizzle.text('event_banner').notNull(), // URL/path to event banner image

		// This is the new column for consistent timestamp filtering depending on when it was published
        publishedTimestamp: drizzle.timestamp('published_timestamp', { withTimezone: true }).notNull(),
        
		isRecurringEvent: drizzle.boolean('is_recurring_event').default(false), // Whether the event repeats
		isSingleEvent: drizzle.boolean('is_single_event').default(false), // Whether the event repeats

		status: eventStatusEnum('status'),

		// Event settings
		organizedBy: drizzle.varchar('organized_by'), // Name of the organiser or organization
		public: drizzle.boolean('public').default(true), // Whether the event is public or private
		private: drizzle.boolean('private').default(false), // Whether the event is public or private
		publish: drizzle.boolean('publish').default(true), // Whether the event is publsihed or not
		schedule: drizzle.boolean('schedule').default(true), // Whether the event is scheduled 
		...timestamps, // created_at & updated_at columns
	},
	(table) => [
		drizzle.index('idx_event_name').on(table.eventName),
		drizzle.index('idx_event_category').on(table.eventCategory),
		drizzle.index('idx_created_at').on(table.createdAt),
		drizzle.index('idx_organiser_id').on(table.organiserID),
		drizzle.index('idx_status').on(table.status),
	],
);

export const eventContact = drizzle.pgTable(
	'event_contact',
	{
		id: drizzle.uuid().defaultRandom().primaryKey(), // Unique ID for the contact
		eventId: drizzle
			.uuid('event_id')
			.notNull()
			.references(() => events.id, { onDelete: 'cascade' }), // Linked event
		website: drizzle.text('website'), // Contact name
		email: drizzle.text('email').notNull(), // Contact email
		phone: drizzle.text('phone'), // Contact phone number
		facebook: drizzle.text('facebook'), // Contact phone number
		instagram: drizzle.text('instagram'), // Contact phone number
		linkedin: drizzle.text('linkedin'), // Contact phone number
		twitterX: drizzle.text('twitter_x'), // Contact phone number
		isPrimary: drizzle.boolean('is_primary').default(false), // Whether this is the primary contact for the event
		...timestamps, // created_at & updated_at columns
	},
	(table) => [
		drizzle.index('idx_event_contact_event_id').on(table.eventId), // Index on event ID
		drizzle.index('idx_event_contact_website').on(table.website), // Index on contact name
		drizzle.index('idx_event_contact_email').on(table.email), // Index on contact email
		drizzle.index('idx_event_contact_phone').on(table.phone), // Index on contact phone
	],
);

// ------------------- Relationships -------------------
export const eventContactRelations = relations(eventContact, ({ one }) => ({
	// A contact belongs to one event
	event: one(events, {
		fields: [eventContact.eventId],
		references: [events.id],
	}),
}));

export const eventRecurranceDetailRelations = relations(eventRecurranceDetail, ({ one }) => ({
	// A recurring date belongs to one event
	event: one(events, {
		fields: [eventRecurranceDetail.eventId],
		references: [events.id],
	}),
}));

export const eventCategoryRelations = relations(eventCategory, ({ many }) => ({
	// An event category can have multiple events
	events: many(events),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
	// A seating configuration belongs to one event
	seatingMap: one(eventSeatMapping, {
		fields: [events.id],
		references: [eventSeatMapping.eventId],
	}),

	// An event can have one contact
	contact: one(eventContact, {
		fields: [events.id],
		references: [eventContact.eventId],
	}),

	// An event can have multiple recurring dates
	recurringDates: many(eventRecurranceDetail),

	// An event can have one category
	eventCategory: one(eventCategory, {
		fields: [events.eventCategory],
		references: [eventCategory.id],
	}),

	// An event can have multiple seating arrangements
	sectionAndRows: many(sectionAndRowsSeating),
	tableAndChairs: many(tableAndChairsSeating),
	mixedSeating: many(mixedSeating),

	// An event is organized by one organiser
	organiser: one(organiser, {
		fields: [events.organiserID],
		references: [organiser.id],
	}),
}));

// ------------------- Types -------------------

// Event contact type: Used for creating/updating event contacts
export type EventTag = {
	id: string;
	name: string;
	createdAt: Date;
	updatedAt: Date;
};

export type EventTagInput = Omit<EventTag, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateEventTagInput = Partial<EventTagInput>;

export type EventToTagManyToMany = {
	id: string;
	eventId: string;
	tagId: string;
	createdAt: Date;
	updatedAt: Date;
};

export type EventContact = {
	id: string;
	eventId: string;
	website?: string | undefined;
	email: string;
	phone?: string | undefined;
	facebook?: string | undefined;
	instagram?: string | undefined;
	linkedin?: string | undefined;
	twitterX?: string | undefined;
	isPrimary?: boolean | undefined;
};

export type EventContactInput = Omit<EventContact, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateEventContactInput = Partial<EventContactInput>;

// Recurring event type: Used for creating/updating recurring events
export type RecurringEvent = {
	id: string;
	eventId: string | null;
	recurrenceDate: string;
	recurrenceStartTime: string; // e.g., "10:00:00"
	recurrenceEndTime: string; // e.g., "12:00:00"
	recurrenceTimezone: string; // e.g., "America/New_York"
	recurrenceType: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';
	recurrenceLocationType: 'online' | 'venue' | 'other';
	recurrenceLocation: string; // e.g., "https://example.com/event" or "123 Main St, City"
	latitude: string | null; // For mapping/location purposes
	longitude: string | null; // For mapping/location purposes
	isActive: boolean | null; // Whether the recurrence is active
	isCancelled: boolean; // Whether the recurrence is cancelled
};

export type RecurringEventInput = Omit<RecurringEvent, 'eventId' | 'id' | 'longitude' | 'latitude' | 'createdAt' | 'updatedAt'>;
export type UpdateRecurringEventInput = Partial<RecurringEventInput>;

// Event category type: Used for creating/updating event categories
export type EventCategory = {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	name: string;
	description: string | null;
	image: string | null;
	isActive: boolean | null;
};

// Update event category type: Partial version of EventCategoryInput for updates
export type EventCategoryInput = Omit<EventCategory, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateEventCategoryInput = Partial<EventCategoryInput>;

// Select type: Used when fetching an event from the DB
export interface Events {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	status: 'completed' | 'published' | 'cancelled' | 'ongoing' | 'draft' | null;
	organiserID: string | null;
	eventName: string;
	eventCategory: string;
	eventDescription: string;
	eventBanner: string;
	publishedTimestamp: Date;
	isRecurringEvent: boolean | null;
	isSingleEvent: boolean | null;
	organizedBy: string | null;
	public: boolean | null;
	private: boolean | null;
	publish: boolean | null;
	schedule: boolean | null;
};

// Create/Update type: Partial version of insert type for PATCH/UPDATE
export type CreateEvents = Omit<Events, 'id' | 'createdAt' | 'updatedAt' | 'organiserID'>;
export type UpdateEvents = Partial<CreateEvents>;

export interface EventAndRelationships extends Events {
	tags: EventTag[];
	contact: EventContact;
	recurringDates: RecurringEvent[];
	sectionAndRows: SectionAndRowsSeating[];
	tableAndChairs: TableAndChairsSeating[];
	mixedSeating: MixedSeating[];
	organiser: Organiser;
	eventCategoryDetails: EventCategory;
}