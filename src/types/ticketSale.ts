// Type for a ticket sale record (Read)
export type TicketSale = {
	id: string; // UUID as string
	ticketSectionId: string | null; // UUID as string, nullable due to reference
	seatsOrTablePurchased: any; // JSONB, non-null
	userId: string; // UUID as string, non-null
	quantity: number; // Non-null integer
	totalAmount: string; // Decimal(10,2), represented as string
	purchaseDate: Date; // Non-null timestamp
	createdAt: Date; // From timestamps
	updatedAt: Date; // From timestamps
};

// Type for creating a new ticket sale (Create)
export type BuyTicketsDto = {
	id?: string; // Optional, defaults to random UUID
	ticketSectionId?: string | null; // Optional, nullable
	seatsOrTablePurchased: any; // Required, JSONB
	userId: string; // Required
    promoCode?: string,
	quantity: number; // Required
	totalAmount: string; // Required
	purchaseDate?: Date; // Optional, defaults to now
	createdAt?: Date; // Optional, from timestamps
	updated_at?: Date; // Optional, from timestamps
};

// Type for updating a ticket sale (Update)
export type UpdateTicketSale = Partial<BuyTicketsDto>;
