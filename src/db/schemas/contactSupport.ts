import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Contact Support Table
export const contactSupport = pgTable('contact_support', {
	id: uuid('id').defaultRandom().primaryKey().notNull(),
	firstName: text('first_name').notNull(),
	lastName: text('last_name').notNull(),
	email: text('email').notNull(),
	companyName: text('company_name'),
	organizationType: text('organization_type'),
	phoneNumber: text('phone_number'),
	reasonForContact: text('reason_for_contact').notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Types
export type ContactSupport = typeof contactSupport.$inferSelect;
export type NewContactSupport = typeof contactSupport.$inferInsert;
