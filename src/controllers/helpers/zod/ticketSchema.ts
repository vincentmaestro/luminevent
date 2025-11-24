// =========================
// Zod Schemas for Validation
// =========================

import z from 'zod';

const promoTypeEnum = z.enum(['percentage_off', 'fixed_amount_off', 'buy_one_get_one']);

// Enum for seating types
export const SeatingTypeEnumSchema = z.enum(['table_n_chairs', 'section_n_rows', 'chairs']);

// Schema for creating a new ticket section
export const CreateTicketSectionSchema = z.object({
	eventSeatingId: z.string().uuid().optional(), // Optional, nullable in table
	selectedSeatingIds: z.any().optional(), // JSONB, can be any JSON-compatible data
	selectedSeatingType: SeatingTypeEnumSchema.default('table_n_chairs'), // Enum with default
	ticketName: z.string().min(1, 'Ticket name is required'), // Non-null, required
	ticketDescription: z.string().min(1, 'Ticket description is required'), // Non-null, required
	price: z
		.string()
		.regex(/^\d+(\.\d{1,2})?$/, 'Price must be a valid decimal number (e.g., 10 or 10.00)')
		.default('0.00'), // Numeric(10,2) with default
	perks: z.array(z.string()).nullable().optional(), // Nullable text array
	salesStart: z.date({ message: 'Sales start date is required' }), // Non-null timestamp
	salesEnd: z.date({ message: 'Sales end date is required' }), // Non-null timestamp
	totalTickets: z
		.number()
		.int({ message: 'Total tickets must be an integer' })
		.nonnegative({ message: 'Total tickets must be non-negative' }), // Non-null integer
	availableTickets: z
		.number()
		.int({ message: 'Available tickets must be an integer' })
		.nonnegative({ message: 'Available tickets must be non-negative' }), // Non-null integer
	absorbTicketFee: z.boolean().default(false), // Boolean with default
});

export const UpdateTicketSectionSchema = CreateTicketSectionSchema.partial();

export const CreatePromoCodeSchema = z.object({
	promotionCode: z.string().min(1),
	promotionType: promoTypeEnum,
	promoValue: z.string().regex(/^\d+(\.\d{1,2})?$/),
	startDate: z.date(),
	endDate: z.date(),
});

export const UpdatePromoCodeSchema = CreatePromoCodeSchema.partial();

/**
 * @description Zod schema for the ApplyPromoCodeDTO.
 * This schema validates the data for applying a promo code.
 */
export const ApplyPromoCodeSchema = z.object({
	/**
	 * @description The promo code string.
	 * Must be a non-empty string.
	 */
	code: z.string().min(1, 'Promo code cannot be empty.'),

	//   /**
	//    * @description The quantity of promo codes to use.
	//    * Must be an integer greater than 0.
	//    */
	//   quantity: z.number().int().positive('Quantity must be a positive integer.'),
});
export const CreateRefundPolicySchema = z.object({
	refundPeriod: z.number().int().nonnegative(),
	isRefundable: z.boolean(),
});

export const UpdateRefundPolicySchema = CreateRefundPolicySchema.partial();

/**
 * Zod schema for a single seat purchase.
 * @property {string} row - The row identifier (e.g., "A", "B").
 * @property {number} seatNumber - The seat number.
 */
const SeatSchema = z.object({
	type: z.literal('seat'),
	row: z.string().min(1, 'Row identifier is required.'),
	seatNumber: z.number().int().positive('Seat number must be a positive integer.'),
});

/**
 * Zod schema for a single table purchase.
 * @property {number} tableNumber - The table number.
 * @property {number} numberOfSeats - The number of seats at the table.
 */
const TableSchema = z.object({
	type: z.literal('table'),
	tableNumber: z.number().int().positive('Table number must be a positive integer.'),
	numberOfSeats: z.number().int().positive('Number of seats must be a positive integer.'),
});

/**
 * A discriminated union that validates the `seatsOrTablePurchased` field.
 * This ensures the data is either an array of seats or a single table object.
 *
 * It uses the 'type' field to determine which schema to validate against.
 */
export const SeatsOrTableSchema = z.union([
	z.array(SeatSchema), // Allows an array of seat objects for individual seat purchases
	TableSchema, // Allows a single table object for a table purchase
]);

/**
 * The main Zod schema for creating a new ticket sale.
 */
export const CreateTicketSaleSchema = z.object({
	ticketSectionId: z.string().uuid().optional().or(z.null()), // Optional, nullable UUID
	seatsOrTablePurchased: SeatsOrTableSchema, // Required, validated against the discriminated union
	userId: z.string().uuid({ message: 'User ID must be a valid UUID' }), // Required
	promoCode: z.string().optional(),
	quantity: z
		.number()
		.int({ message: 'Quantity must be an integer' })
		.nonnegative({ message: 'Quantity must be non-negative' }), // Required
	totalAmount: z
		.string()
		.regex(
			/^\d+(\.\d{1,2})?$/,
			'Total amount must be a valid decimal number (e.g., 10 or 10.00)',
		), // Required
	purchaseDate: z.date().optional(), // Optional, defaults to now
});
