// Enum type for seating types
export type SeatingTypeEnum = 'table_n_chairs' | 'section_n_rows' | 'chairs';

// Type for the ticketSections table
export type TicketSection = {
	id: string; // UUID as string
	eventId: string | null;
	eventSeatingId: string | null; // UUID as string, nullable due to reference
	selectedSeatingIds: any; // JSONB can hold any JSON-compatible data
	selectedSeatingType: SeatingTypeEnum; // Enum type
	ticketName: string; // Non-null text
	ticketDescription: string; // Non-null text
	price: string; // Numeric with precision 10, scale 2, represented as string
	perks: string[] | null; // Array of text, nullable
	salesStart: Date; // Non-null timestamp
	salesEnd: Date; // Non-null timestamp
	totalTickets: number; // Non-null integer
	availableTickets: number; // Non-null integer
	absorbTicketFee: boolean; // Boolean with default false
	created_at: Date; // From timestamps
	updated_at: Date; // From timestamps
};

// Type for inserting a new ticket section (optional fields for insertion)
export type NewTicketSection = {
	id?: string; // Optional, as it defaults to random UUID
	eventId: string | null;
	eventSeatingId?: string | null; // Optional, nullable
	selectedSeatingIds: any; // Optional JSONB
	selectedSeatingType: SeatingTypeEnum; // Optional, defaults to 'table_n_chairs'
	ticketName: string; // Required
	ticketDescription: string; // Required
	price: string; // Optional, defaults to '0.00'
	perks?: string[] | null; // Optional, nullable
	salesStart: Date; // Required
	salesEnd: Date; // Required
	totalTickets: number; // Required
	availableTickets: number; // Required
	absorbTicketFee?: boolean; // Optional, defaults to false
	created_at?: Date; // Optional, from timestamps
	updated_at?: Date; // Optional, from timestamps
};

/**
 * @summary DTO for creating a new ticket section.
 * @description All fields are required to create a new ticket section.
 */
export interface CreateTicketSectionDTO {
	eventSeatingId?: string;
	eventId?: string;
	selectedSeatingIds: any; // Optional JSONB
	selectedSeatingType: SeatingTypeEnum; // Optional, defaults to 'table_n_chairs'
	ticketName: string;
	ticketDescription: string;
	price: string;
	perks?: string[];
	salesStart: Date;
	salesEnd: Date;
	totalTickets: number;
	availableTickets: number;
	absorbTicketFee?: boolean;
}

/**
 * @summary DTO for updating an existing ticket section.
 * @description All fields are optional to allow for partial updates.
 */
export interface UpdateTicketSectionDTO extends Partial<CreateTicketSectionDTO> {}

export interface SelectTicketSectionDTO {
	id: string; // UUID as string
	eventId: string | null; // UUID as string, nullable due to reference
	eventSeatingId: string | null; // UUID as string, nullable due to reference
	selectedSeatingIds: any; // JSONB can hold any JSON-compatible data
	selectedSeatingType: SeatingTypeEnum; // Enum type
	ticketName: string; // Non-null text
	ticketDescription: string; // Non-null text
	price: string; // Numeric with precision 10, scale 2, represented as string
	perks: string[] | null; // Array of text, nullable
	salesStart: Date; // Non-null timestamp
	salesEnd: Date; // Non-null timestamp
	totalTickets: number; // Non-null integer
	availableTickets: number; // Non-null integer
	absorbTicketFee: boolean; // Boolean with default false
	createdAt: Date; // From timestamps
	updatedAt: Date; // From timestamps
}

/**
 * @summary DTO for creating a new ticket promo code.
 * @description All fields are required to create a new promo code.
 */
export interface CreatePromoCodeDTO {
	promotionCode: string;
	promotionType: 'percentage_off' | 'fixed_amount_off' | 'buy_one_get_one';
	promoValue: string;
	startDate: Date;
	endDate: Date;
}

/**
 * @summary DTO for updating an existing promo code.
 * @description All fields are optional to allow for partial updates.
 */
export interface UpdatePromoCodeDTO extends Partial<CreatePromoCodeDTO> {}

/**
 * @description Data transfer object for applying a promo code.
 * Contains the promo code string and the quantity to be used.
 */
export interface ApplyPromoCodeDTO {
	code: string;
}

export interface SelectTicketPromoCodeDTO {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	eventId: string | null;
	promotionCode: string;
	promotionType: 'percentage_off' | 'fixed_amount_off' | 'buy_one_get_one';
	promoValue: string | null;
	startDate: Date;
	endDate: Date;
}

/**
 * @summary DTO for creating a new ticket refund policy.
 * @description All fields are required for a refund policy.
 */
export interface CreateRefundPolicyDTO {
	refundPeriod: number;
	isRefundable: boolean;
}

export interface SelectRefundPolicyDTO {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	eventId: string | null;
	refundPeriod: number;
	isRefundable: boolean;
}

/**
 * @summary DTO for updating a ticket refund policy.
 * @description All fields are optional to allow for partial updates.
 */
export interface UpdateRefundPolicyDTO extends Partial<CreateRefundPolicyDTO> {}
