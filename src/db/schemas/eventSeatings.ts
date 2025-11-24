import * as drizzle from 'drizzle-orm/pg-core';
import { events } from './events';
// import { user } from './usersAndOrganiser';
import { timestamps } from '../helpers/timestamp';
import { relations } from 'drizzle-orm';
import { ticketSections } from './eventTickets';

// Enum for different seating types
export const seatingTypeEnum = drizzle.pgEnum('seating_type_enum', [
	'table_n_chairs', // Tables with multiple chairs
	'section_n_rows', // Sections with rows of seats
	'individual', // Individual seat arrangement
	'mixed', // Combination of seating styles
]);

// Main table for event seating configuration
export const eventSeatMapping = drizzle.pgTable('event_seatings', {
	id: drizzle.uuid().defaultRandom().primaryKey(),
	eventId: drizzle
		.uuid("event_id")
		.notNull()
		.references(() => events.id, { onDelete: 'cascade' }), // Link to event
	seatingType: seatingTypeEnum("seating_type").notNull(), // Type of seating for the event
	totalCapacity: drizzle.integer("total_capacity").notNull(), // Total seats available for this seating type
	availableCapacity: drizzle.integer("available_capacity").notNull(), // Seats still available
	...timestamps, // CreatedAt and UpdatedAt columns
});

// Seating arrangement: Sections with rows
export const sectionAndRowsSeating = drizzle.pgTable('section_and_rows_seatings', {
	id: drizzle.uuid().defaultRandom().primaryKey(),
	seatMapId: drizzle
		.uuid("seat_map_id")
		.notNull()
		.references(() => eventSeatMapping.id, { onDelete: 'cascade' }),
	noOfSections: drizzle.integer("no_of_sections").notNull(), // Number of sections
	noOfRowsPerSection: drizzle.integer("no_of_rows_per_section").notNull(), // Rows in each section
	noOfChairsPerSection: drizzle.integer("no_of_chairs_per_section").notNull(), // Chairs in each section
	total: drizzle.integer("total").notNull(), // Total seats
});

// Seating arrangement: Tables with chairs
export const tableAndChairsSeating = drizzle.pgTable('table_and_chairs_seatings', {
	id: drizzle.uuid().defaultRandom().primaryKey(),
	seatMapId: drizzle
		.uuid("seat_map_id")
		.notNull()
		.references(() => eventSeatMapping.id, { onDelete: 'cascade' }),
	noOfTables: drizzle.integer("no_of_tables").notNull(), // Number of tables
	noOfChairsPerTable: drizzle.integer("no_of_chairs_per_table").notNull(), // Chairs at each table
	total: drizzle.integer().notNull(), // Total seats
});

// Seating arrangement: Mixed configuration (tables + sections)
export const mixedSeating = drizzle.pgTable('mixed_seatings', {
	id: drizzle.uuid().defaultRandom().primaryKey(),
	seatMapId: drizzle
		.uuid("seat_map_id")
		.notNull()
		.references(() => eventSeatMapping.id, { onDelete: 'cascade' }),
	noOfTables: drizzle.integer("no_of_tables").notNull(), // Number of tables
	noOfChairsPerTable: drizzle.integer("no_of_chairs_per_table").notNull(), // Chairs at each table
	totalChairTable: drizzle.integer("total_chair_table").notNull(), // Total seats from table/chair arrangement
	noOfSections: drizzle.integer("no_of_sections").notNull(), // Number of sections
	noOfRowsPerSection: drizzle.integer("no_of_rows_per_section").notNull(), // Rows in each section
	noOfChairsPerRows: drizzle.integer("no_of_chairs_per_rows").notNull(), // Chairs per row
	totalSectionRow: drizzle.integer("total_section_row").notNull(), // Total seats from section/row arrangement
});

// ------------------- Relationships -------------------
// ------------------- Relationships -------------------

// Relations for the main event seating table.
// It can have one of each specific seating type, and many ticket sections.
export const seatingMapRelations = relations(eventSeatMapping, ({ one, many }) => ({
	// A seating map belongs to one event.
	event: one(events, {
		fields: [eventSeatMapping.eventId],
		references: [events.id],
	}),
	// A seating map can have one specific arrangement. We are using `one` to denote this.
	sectionAndRows: one(sectionAndRowsSeating, {
		fields: [eventSeatMapping.id],
		references: [sectionAndRowsSeating.seatMapId],
	}),
	tableAndChairs: one(tableAndChairsSeating, {
		fields: [eventSeatMapping.id],
		references: [tableAndChairsSeating.seatMapId],
	}),
	mixedSeating: one(mixedSeating, {
		fields: [eventSeatMapping.id],
		references: [mixedSeating.seatMapId],
	}),
	// A seating map can have many ticket sections.
	ticketSections: many(ticketSections),
}));

export const sectionAndRowsRelations = relations(sectionAndRowsSeating, ({ one }) => ({
	// A section and rows seating belongs to one event
	seatingMap: one(eventSeatMapping, {
		fields: [sectionAndRowsSeating.seatMapId],
		references: [eventSeatMapping.id],
	}),
}));

export const tableAndChairsRelations = relations(tableAndChairsSeating, ({ one }) => ({
	// A table and chairs seating belongs to one event
	seatingMap: one(eventSeatMapping, {
		fields: [tableAndChairsSeating.seatMapId],
		references: [eventSeatMapping.id],
	}),
}));

export const mixedSeatingRelations = relations(mixedSeating, ({ one }) => ({
	// A mixed seating configuration belongs to one event
	seatingMap: one(eventSeatMapping, {
		fields: [mixedSeating.seatMapId],
		references: [eventSeatMapping.id],
	}),
}));

// ------------------- Types -------------------

// Insert types (for creating new records)
export type addEventSeatMapping = {
	seatingType: 'table_n_chairs' | 'section_n_rows' | 'individual' | 'mixed';
	totalCapacity: number;
	availableCapacity: number;
	id?: string | undefined;
	createdAt?: Date | undefined;
	updatedAt?: Date | undefined;
	eventId?: string | null | undefined;
};

export type addSectionAndRowsSeating = {
	noOfSections: number;
	noOfRowsPerSection: number;
	noOfChairsPerSection: number;
	total: number;
	id?: string | undefined;
	seatMapId?: string | null | undefined;
};

export type addTableAndChairsSeating = {
	total: number;
	noOfTables: number;
	noOfChairsPerTable: number;
	id?: string | undefined;
	seatMapId?: string | null | undefined;
};

export type addMixedSeating = {
	noOfTables: number;
	noOfChairsPerTable: number;
	totalChairTable: number;
	noOfSections: number;
	noOfRowsPerSection: number;
	noOfChairsPerRows: number;
	totalSectionRow: number;
	id?: string | undefined;
	seatMapId?: string | null | undefined;
};

// Select types (for reading from DB)
export type EventSeatMapping = {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	eventId: string | null;
	seatingType: 'table_n_chairs' | 'section_n_rows' | 'individual' | 'mixed';
	totalCapacity: number;
	availableCapacity: number;
};

export type SectionAndRowsSeating = {
	id: string;
	seatMapId: string;
	noOfSections: number;
	noOfRowsPerSection: number;
	noOfChairsPerSection: number;
	total: number;
};

export type TableAndChairsSeating = {
	id: string;
	seatMapId: string;
	total: number;
	noOfTables: number;
	noOfChairsPerTable: number;
};

export type MixedSeating = {
	id: string;
	seatMapId: string;
	noOfSections: number;
	noOfRowsPerSection: number;
	noOfTables: number;
	noOfChairsPerTable: number;
	totalChairTable: number;
	noOfChairsPerRows: number;
	totalSectionRow: number;
};

// Update types (partial insert types for PATCH/UPDATE)
export type updateEventSeatMapping = Partial<addEventSeatMapping>;
export type updateSectionAndRowsSeating = Partial<addSectionAndRowsSeating>;
export type updateTableAndChairsSeating = Partial<addTableAndChairsSeating>;
export type updateMixedSeating = Partial<addMixedSeating>;
export interface CreateSeatingInputBody {
	seatingType: 'section_n_rows' | 'table_n_chairs' | 'individual' | 'mixed';
	totalCapacity: number;
	availableCapacity: number;
	noOfSections?: number;
	noOfRowsPerSection?: number;
	noOfChairsPerSection?: number;
	noOfTables?: number;
	noOfChairsPerTable?: number;
	totalChairTable?: number;
	noOfChairsPerRows?: number;
	totalSectionRow?: number;
}
