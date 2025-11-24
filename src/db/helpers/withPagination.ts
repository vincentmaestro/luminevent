// Updated imports and types for clarity
import {
	Account,
	Organiser,
	OrganizerPayoutAccount,
	User,
	UserSettings,
} from '../schemas/usersAndOrganiser';
import config from '../../config';
import { ActionResult, PaginatedResult } from '../../types/response';
import { EventDto } from '../../types/events';
import { Events } from '../schemas/events';

// The SchemaType is now more inclusive of the relationship types
type SchemaType =
	| User
	| Account
	| Organiser
	| OrganizerPayoutAccount
	| UserSettings
	| EventDto
	| Events;

/**
 * Applies cursor-based pagination formatting to an array of already fetched data.
 * @template T - The type of items in the data array (must extend SchemaType).
 * @param {T[]} data - The array of data, expected to be sorted by `cursorField` and potentially contain `pageSize + 1` items.
 * @param {number} pageSize - The desired number of items per page.
 * @param {keyof T} [cursorField='createdAt'] - The field to use for determining the next cursor.
 * @returns {Promise<PaginatedResult<T>>} A promise that resolves to a cursor-paginated result object.
 */
export async function withPagination<T extends SchemaType>(
	data: T[],
	pageSize: number,
	cursorField?: keyof T,
): Promise<PaginatedResult<T>> {
	// Basic validation for pageSize
	if (pageSize <= 0) {
		return {
			success: false,
			data: [],
			pageSize: pageSize,
			nextCursor: null,
			hasNextPage: false,
		};
	}

	let hasNextPage = false;
	let nextCursor: string | Date | number | null = null;
	let resultData = data;

	// Use nullish coalescing (??) to set 'createdAt' as the default cursor field.
	// This is the most effective way to handle the default value.
	const effectiveCursorField: keyof T = cursorField ?? 'createdAt';

	// If the data array contains more items than the requested pageSize,
	// it means there's a next page.
	if (data.length > pageSize) {
		hasNextPage = true;
		// Slice the array to return only the requested number of items
		resultData = data.slice(0, pageSize);
		// The cursor for the next page is the cursorField value of the last item on the current page
		const lastItem = resultData[resultData.length - 1];

		if (lastItem && lastItem[effectiveCursorField] !== null) {
			nextCursor = lastItem[effectiveCursorField] as Date | string | number;
		} else {
			// Log a warning in development if the cursor field is missing
			if (config.NODE_ENV !== 'production') {
				console.warn(
					`Cursor field '${String(effectiveCursorField)}' not found or invalid on the last item for pagination.`,
				);
			}
			hasNextPage = false;
			nextCursor = null;
		}
	}

	return {
		success: true,
		data: resultData,
		pageSize: pageSize,
		nextCursor,
		hasNextPage,
	};
}

/**
 * Creates a standardized `ActionResult` object for API responses.
 * This helper ensures a consistent structure for conveying success/failure, data, and messages/errors.
 *
 * @template T - The type of data to be returned in case of success.
 * @param {boolean} success - Indicates whether the action was successful.
 * @param {T} [data] - Optional data payload to return on success.
 * @param {string} [error] - Optional error message to provide on failure.
 * @param {string} [message] - Optional general message (e.g., success message, warning).
 * @returns {ActionResult<T>} An object conforming to the `ActionResult` interface.
 */
export async function createActionResult<T>(
	success: boolean,
	data?: T,
	error?: string,
	message?: string,
): Promise<ActionResult<T>> {
	// Ensure that if 'success' is true, 'error' is not set, and vice-versa for clarity.
	if (success && error) {
		if (config.NODE_ENV !== 'production')
			console.warn(
				"createActionResult: 'error' provided for a successful action. Ignoring 'error'.",
			);
		error = undefined;
	} else if (!success && !error) {
		// If not successful but no error is provided, set a generic error message.
		error = 'An unknown error occurred.';
	}

	return { success, data, error, message };
}
