import { createActionResult } from '../../db/helpers/withPagination';
import { APIResponse } from '../../types/response';

/**
 * Create a standardized API response when an event is not found.
 *
 * @returns A rejected promise with an {@link APIResponse} object.
 */
export function eventNotFoundError(): Promise<APIResponse<null>> {
	return createActionResult<null>(false, null, 'EVENT_NOT_FOUND', 'Event not found.');
}
