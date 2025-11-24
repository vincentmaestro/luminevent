import {
	CreateEvents,
	RecurringEventInput,
	Events,
	UpdateEvents,
	UpdateRecurringEventInput,
} from '../db/schemas/events';
import {
	EventSeatMapping,
	MixedSeating,
	SectionAndRowsSeating,
	TableAndChairsSeating,
} from './seating';

export interface EventOnlyDTO {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	status: 'completed' | 'published' | 'cancelled' | 'ongoing' | 'draft' | null;
	organiserID: string | null;
	eventName: string;
	eventCategory: string;
	eventDescription?: string;
	eventBanner: string;
	publishedTimestamp: Date;
	isRecurringEvent: boolean | null;
	isSingleEvent: boolean | null;
	organizedBy: string | null;
	public: boolean | null;
	private: boolean | null;
	publish: boolean | null;
	schedule: boolean | null;
}

/**
 * EventDto
 * this mirrors the event schema in zod
 * this helps with the tsoa openapi docs
 */
export interface EventDto extends Events {
	contact: EventContactDTO;
	seatingMap: EventSeatingDTO;
	recurringDates: EventRecurranceDetailDTO[];
}

export interface EventSeatingDTO extends EventSeatMapping {
	mixedSeating: MixedSeating;
	sectionAndRows: SectionAndRowsSeating;
	tableAndChairs: TableAndChairsSeating;
}

export interface EventRecurranceDetailDTO {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	eventId: string;
	isActive: boolean | null;
	recurrenceDate: string;
	recurrenceStartTime: string;
	recurrenceEndTime: string;
	recurrenceTimezone: string;
	recurrenceType: 'once' | 'weekly' | 'monthly' | 'daily' | 'yearly';
	recurrenceLocationType: 'online' | 'venue' | 'other';
	recurrenceLocation: string | null;
	latitude: string | null;
	longitude: string | null;
	isCancelled: boolean | null;
}

export interface EventContactDTO {
	id: string;
	email: string;
	createdAt: Date;
	updatedAt: Date;
	facebook: string | null;
	twitterX: string | null;
	instagram: string | null;
	linkedin: string | null;
	website: string | null;
	eventId: string;
	phone: string | null;
	isPrimary: boolean | null;
}

export type AddEventContactDTO = Omit<EventContactDTO, 'id' | 'eventId' | 'createdAt' | 'updatedAt'>;
export type UpdateEventContactDTO = Partial<AddEventContactDTO>;

/**
 * @summary Data transfer object for creating a new event.
 * @description This interface extends the base `CreateEvents` and includes additional fields
 * for contact information, tags, and recurrence details, all of which are optional.
 */
export interface CreateEventDTO extends CreateEvents {
    /**
     * Contact information for the event.
     * @optional
     */
    contact?: AddEventContactDTO;
    /**
     * An array of tags associated with the event for categorization.
     * @optional
     */
    tags?: string[];
    /**
     * An array of recurrence details for events that repeat on a schedule.
     * @optional
     */
    recurrenceDetails?: RecurringEventInput[];
}

export interface UpdateEventInput extends UpdateEvents {
	contact: UpdateEventContactDTO;
    tags: string[];
	recurrenceDetails: UpdateRecurringEventInput[];
}
