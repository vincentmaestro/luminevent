// src/helpers/zod/eventSeatingSchemas.ts
import { z } from 'zod';
import { eq } from 'drizzle-orm';

import { db as DB } from '../../../db';
import schemas from '../../../db/schemas/index';

// ---------------- Enums ----------------
export const SeatingTypeLiteral = z.enum([
	'table_n_chairs',
	'section_n_rows',
	'individual',
	'mixed',
]);

// ---------------- Event Seating Mapping ----------------
// Base schema for all seating types
const BaseSeatingSchema = z
	.object({
		totalCapacity: z.number().int().positive(),
		availableCapacity: z.number().int().nonnegative(),
	})
	.refine((data) => data.availableCapacity <= data.totalCapacity, {
		message: 'availableCapacity cannot exceed totalCapacity',
		path: ['availableCapacity'],
	})
	.passthrough();

const SectionAndRowsSchema = BaseSeatingSchema.extend({
	seatingType: z.literal('section_n_rows'),
	noOfSections: z.number().int().positive(),
	noOfRowsPerSection: z.number().int().positive(),
	noOfChairsPerSection: z.number().int().positive(),
});

const TableAndChairsSchema = BaseSeatingSchema.extend({
	seatingType: z.literal('table_n_chairs'),
	noOfTables: z.number().int().positive(),
	noOfChairsPerTable: z.number().int().positive(),
});

const MixedSeatingSchema = BaseSeatingSchema.extend({
	seatingType: z.literal('mixed'),
	noOfSections: z.number().int().positive(),
	noOfRowsPerSection: z.number().int().positive(),
	noOfChairsPerRows: z.number().int().positive(),
	totalSectionRow: z.number().int().positive(),
	noOfTables: z.number().int().positive(),
	noOfChairsPerTable: z.number().int().positive(),
	totalChairTable: z.number().int().positive(),
});

const IndividualSeatingSchema = BaseSeatingSchema.extend({
	seatingType: z.literal('individual'),
});

// Use z.discriminatedUnion for comprehensive, type-safe validation
export const CreateSeatingSchema = z.discriminatedUnion('seatingType', [
	SectionAndRowsSchema,
	TableAndChairsSchema,
	MixedSeatingSchema,
	IndividualSeatingSchema,
]);

// Update schemas are partial to allow for updating only specific fields.
const BaseSeatingUpdateSchema = z.object({
	totalCapacity: z.number().int().positive().optional(),
	availableCapacity: z.number().int().min(0).optional(),
});

const SectionAndRowsUpdateSchema = BaseSeatingUpdateSchema.extend({
	seatingType: z.literal('section_n_rows'),
	noOfSections: z.number().int().positive().optional(),
	noOfRowsPerSection: z.number().int().positive().optional(),
	noOfChairsPerSection: z.number().int().positive().optional(),
});

const TableAndChairsUpdateSchema = BaseSeatingUpdateSchema.extend({
	seatingType: z.literal('table_n_chairs'),
	noOfTables: z.number().int().positive().optional(),
	noOfChairsPerTable: z.number().int().positive().optional(),
});

const MixedSeatingUpdateSchema = BaseSeatingUpdateSchema.extend({
	seatingType: z.literal('mixed'),
	noOfSections: z.number().int().positive().optional(),
	noOfRowsPerSection: z.number().int().positive().optional(),
	noOfChairsPerRows: z.number().int().positive().optional(),
	totalSectionRow: z.number().int().positive().optional(),
	noOfTables: z.number().int().positive().optional(),
	noOfChairsPerTable: z.number().int().positive().optional(),
	totalChairTable: z.number().int().positive().optional(),
});

const IndividualSeatingUpdateSchema = BaseSeatingUpdateSchema.extend({
	seatingType: z.literal('individual'),
});

export const UpdateSeatingSchema = z.discriminatedUnion('seatingType', [
	SectionAndRowsUpdateSchema,
	TableAndChairsUpdateSchema,
	MixedSeatingUpdateSchema,
	IndividualSeatingUpdateSchema,
]);

/**
 * Checks if a user is the owner of a given event.
 *
 * ## Logic:
 * 1. Looks up the user’s role.
 *    - If the user is an **admin**, ownership is automatically granted.
 * 2. Otherwise, fetches the event to retrieve its associated organiser ID.
 * 3. Then fetches the organiser record to check which user owns it.
 * 4. Returns `true` if the given `userId` matches the organiser’s `userId`,
 *    otherwise `false`.
 *
 * ## Returns:
 * - `true` if:
 *   - The user exists **and** is an admin, OR
 *   - The user exists and owns the organiser that created the event.
 * - `false` if:
 *   - The user does not exist,
 *   - The event does not exist,
 *   - The organiser does not exist, OR
 *   - The user does not match the event’s organiser.
 *
 * @param userId - The ID of the user requesting access.
 * @param eventId - The ID of the event to check ownership for.
 * @returns A boolean indicating whether the user owns the event.
 */
export async function isEventOwner(userId: string, eventId: string) {
	const { user, events, organiser } = schemas;
	// fetch user role
	const [userRow] = await DB.select({ role: user.role }).from(user).where(eq(user.id, userId));

	if (!userRow) return false;

	if (userRow.role === 'admin') return true;

	// fetch event with organiser link
	const [eventRow] = await DB.select({ organiserID: events.organiserID })
		.from(events)
		.where(eq(events.id, eventId));

	if (!eventRow) return false;

	if (!eventRow?.organiserID) {
		return false;
	}

	// fetch organiser’s user
	const [organiserRow] = await DB.select({ userId: organiser.userId })
		.from(organiser)
		.where(eq(organiser.id, eventRow.organiserID));

	return organiserRow?.userId === userId;
}

// ---------------- Types from Zod ----------------
export type CreateSeatingInputBody = z.infer<typeof CreateSeatingSchema>;
export type UpdateSeatingInputBody = z.infer<typeof UpdateSeatingSchema>;
