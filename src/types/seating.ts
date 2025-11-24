export interface EventSeatMapping {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	eventId: string | null;
	seatingType: 'table_n_chairs' | 'section_n_rows' | 'individual' | 'mixed';
	totalCapacity: number;
	availableCapacity: number;
}

export interface SectionAndRowsSeating {
	id: string;
	seatMapId: string;
	noOfSections: number;
	noOfRowsPerSection: number;
	total: number;
}

export interface TableAndChairsSeating {
	id: string;
	seatMapId: string;
	noOfTables: number;
	noOfChairsPerTable: number;
	total: number;
}

export interface MixedSeating {
	id: string;
	seatMapId: string;
	noOfSections: number;
	noOfRowsPerSection: number;
	noOfTables: number;
	noOfChairsPerTable: number;
	totalChairTable: number;
	noOfChairsPerRows: number;
	totalSectionRow: number;
}

export interface CreateSeatingInputBody {
	seatingType: 'section_n_rows' | 'table_n_chairs' | 'mixed' | 'individual';
	totalCapacity: number;
	availableCapacity: number;
	// Section & Rows
	noOfSections?: number;
	noOfRowsPerSection?: number;
	noOfChairsPerSection?: number;
	// Table & Chairs
	noOfTables?: number;
	noOfChairsPerTable?: number;
	// Mixed
	totalChairTable?: number;
	noOfChairsPerRows?: number;
	totalSectionRow?: number;
}

export interface UpdateSeatingInputBody {
	// seatingType is required to discriminate which arrangement it is
	seatingType: 'section_n_rows' | 'table_n_chairs' | 'mixed' | 'individual';

	// Common fields for all seating types
	totalCapacity?: number;
	availableCapacity?: number;

	// Section & Rows
	noOfSections?: number;
	noOfRowsPerSection?: number;

	// Table & Chairs
	noOfTables?: number;
	noOfChairsPerTable?: number;

	// Mixed
	totalChairTable?: number;
	noOfChairsPerRows?: number;
	totalSectionRow?: number;
}

export interface SeatingResponseItem {
	seating: EventSeatMapping;
}

/**
 * The response shape for seating creation and retrieval.
 */
export interface SeatingsList {
	seatings?: SeatingResponseItem[];
}

/**
 * The response shape for seating creation and retrieval.
 */
export interface SeatingResponse {
	/**
	 * The base event seating mapping metadata.
	 */
	seating?: EventSeatMapping | SeatingsList;

	/**
	 * A detailed seating arrangement definition.
	 *
	 * Can be one of:
	 * - Section and rows seating
	 * - Table and chairs seating
	 * - Mixed seating
	 */
	arrangement?: SectionAndRowsSeating | TableAndChairsSeating | MixedSeating;
}
