/**
 * Represents a paginated result set with metadata.
 * @template T - The type of items in the data array.
 */
export interface PaginatedResult<T> {
    success: boolean;
    /** Array of paginated items */
    data: T[];
    /** Number of items per page */
    pageSize: number;
    /** The cursor for the next page (null if no more pages) */
    nextCursor: string | Date | number | null;
    /** Whether there are more pages available */
    hasNextPage: boolean;
};

/**
 * Represents a single object or error details
 */
export interface ActionResult<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

// --- Consistent API Response Structure ---
export interface APIResponse<T> {
    success: boolean;
    data?: T | null;
    error?: string;
    message?: any;
}