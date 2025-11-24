import * as drizzle from 'drizzle-orm/pg-core';
import { eventSeatMapping } from './eventSeatings';
import { timestamps } from '../helpers/timestamp';
import { user } from './usersAndOrganiser';
import { relations } from 'drizzle-orm';
import { events } from './events';

// Enum for different seating types
export const seatingTypeSelectEnum = drizzle.pgEnum('seating_type_select_enum', [
	'table_n_chairs', // Tables with multiple chairs
	'section_n_rows', // Sections with rows of seats
	'chairs', // Individual seat arrangement
]);

// =========================
// Ticket Sections Table
// =========================
// Represents ticket categories or sections within an event seating arrangement.
// Each section can have its own name, description, price, perks, and ticket availability.
export const ticketSections = drizzle.pgTable('ticket_sections', {
	id: drizzle.uuid().defaultRandom().primaryKey(), // Unique ID for the ticket section
	eventId: drizzle.uuid().references(() => events.id, { onDelete: 'cascade' }),
	eventSeatingId: drizzle.uuid().references(() => eventSeatMapping.id, { onDelete: 'cascade' }), // Links to a specific seating configuration
	selectedSeatingIds: drizzle.jsonb(),
	selectedSeatingType: seatingTypeSelectEnum().default('table_n_chairs').notNull(),
	ticketName: drizzle.text().notNull(), // e.g., "VIP Section A", "Balcony Row 2"
	ticketDescription: drizzle.text().notNull(), // Detailed description of the ticket/section
	price: drizzle.numeric({ precision: 10, scale: 2 }).notNull().default('0.00'), // Price for one ticket in this section
	perks: drizzle.text().array(), // Array of perks (e.g., ["Free Drinks", "Backstage Access"])
	salesStart: drizzle.timestamp().notNull(), // Date/time when ticket sales start
	salesEnd: drizzle.timestamp().notNull(), // Date/time when ticket sales end
	totalTickets: drizzle.integer().notNull(), // Total tickets available in this section
	availableTickets: drizzle.integer().notNull(), // Tickets remaining for sale andd if zero let this be unlimited ticket quantity
	absorbTicketFee: drizzle.boolean().default(false).notNull(), // If organisers would pay for the platform fee or the attendees
	...timestamps, // created_at & updated_at columns
});

// ========================
// Ticket Promo codes Table
// ========================
// Represents promotional codes that can be applied to ticket purchases.
// Each promo code can have its own discount amount/percentage and validity period.
export const promoTypeEnum = drizzle.pgEnum('promo_type', [
	'percentage_off',
	'fixed_amount_off',
	'buy_one_get_one',
]);

export const ticketPromoCodes = drizzle.pgTable('ticket_promo_codes', {
	id: drizzle.uuid().defaultRandom().primaryKey(), // Unique ID for the promo code
	eventId: drizzle.uuid().references(() => events.id, { onDelete: 'cascade' }), // Links to a specific ticket section
	promotionCode: drizzle.varchar({ length: 50 }).notNull(), // Promo code string (e.g., "SUMMER2024")
	promotionType: promoTypeEnum().notNull(), // Promo code string (e.g., "SUMMER2024")
	promoValue: drizzle.numeric({ precision: 10, scale: 2 }).default('0.00').notNull(), // Fixed discount amount
	startDate: drizzle.timestamp().notNull(), // Start date/time for promo code
	endDate: drizzle.timestamp().notNull(), // End date/time for promo code
	...timestamps, // created_at & updated_at columns
});

// ========================
// Ticket Refund Policy Table
// ========================
// Defines the refund policy for each ticket section.
// This allows for flexible refund rules based on the section and event.
export const ticketRefundPolicy = drizzle.pgTable('ticket_refund_policy', {
	id: drizzle.uuid().defaultRandom().primaryKey(), // Unique ID for the refund policy
	eventId: drizzle.uuid().references(() => events.id, { onDelete: 'cascade' }), // Links to a specific ticket section
	refundPeriod: drizzle.integer().notNull(), // Number of days before the event when refunds are allowed
	isRefundable: drizzle.boolean().notNull().default(true), // Whether this section is refundable
	...timestamps, // created_at & updated_at columns
});

// =========================
// Ticket Sales Table
// =========================
// Stores each ticket purchase made by users.
// Tracks quantity, amount paid, and links to the section purchased.
export const ticketSales = drizzle.pgTable('ticket_sales', {
	id: drizzle.uuid().defaultRandom().primaryKey(), // Unique sale transaction ID
	ticketSectionId: drizzle.uuid().references(() => ticketSections.id, { onDelete: 'cascade' }), // The section these tickets belong to
	seatsOrTablePurchased: drizzle.jsonb().notNull(),
	userId: drizzle
		.uuid()
		.notNull()
		.references(() => user.id, { onDelete: 'no action' }), // Buyer (linked to users table)
	quantity: drizzle.integer().notNull(), // Number of tickets bought in this transaction
	totalAmount: drizzle.decimal({ precision: 10, scale: 2 }).notNull(), // Total price paid for the transaction
	purchaseDate: drizzle.timestamp().defaultNow().notNull(), // When the purchase was made
	...timestamps, // created_at & updated_at columns
});

// Remember to send ticket confirmation emails after purchase! to the users purchased for by other users

// ------------------- Relationship -------------------
export const ticketSectionsRelations = relations(ticketSections, ({ one }) => ({
	// A ticket section belongs to one event seating configuration
	eventSeating: one(eventSeatMapping, {
		fields: [ticketSections.eventSeatingId],
		references: [eventSeatMapping.id],
	}),
	//
}));
export const ticketSalesRelations = relations(ticketSales, ({ one }) => ({
	// A ticket sale belongs to one ticket section
	ticketSection: one(ticketSections, {
		fields: [ticketSales.ticketSectionId],
		references: [ticketSections.id],
	}),
	// A ticket sale is made by one user
	ticketOwner: one(user, {
		fields: [ticketSales.userId],
		references: [user.id],
	}),
}));

// ------------------- Types -------------------

// Insert types (for creating new records)
export type AddTicketSection = typeof ticketSections.$inferInsert;
export type AddTicketSales = typeof ticketSales.$inferInsert;
export type AddTicketPromoCode = typeof ticketPromoCodes.$inferInsert;

// Select types (for reading from DB)
export type SelectTicketSection = typeof ticketSections.$inferSelect;
export type SelectTicketSales = typeof ticketSales.$inferSelect;
export type SelectTicketPromoCode = typeof ticketPromoCodes.$inferSelect;
export type SelectTicketRefund = typeof ticketRefundPolicy.$inferSelect;

// Update types (partial insert types for PATCH/UPDATE)
export type UpdateTicketSection = Partial<AddTicketSection>;
export type UpdateTicketSales = Partial<AddTicketSales>;
export type UpdateTicketPromoCode = Partial<AddTicketPromoCode>;
