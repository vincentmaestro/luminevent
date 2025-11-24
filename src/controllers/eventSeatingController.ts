import {
	Body,
	Controller,
	Delete,
	Get,
	Path,
	Post,
	Route,
	Security,
	SuccessResponse,
	Tags,
	Request,
	Put,
} from 'tsoa';
import { and, DrizzleQueryError, eq } from 'drizzle-orm';

import { db as DB } from '../db';
import schemas from '../db/schemas/index';
import logger, { Logger } from '../utils/logger';
import { createActionResult } from '../db/helpers/withPagination';
import type { APIResponse } from '../types/response';
import {
	CreateSeatingInputBody,
	UpdateSeatingInputBody,
	SeatingResponse,
	SectionAndRowsSeating,
	TableAndChairsSeating,
	MixedSeating,
} from '../types/seating';
import {
	CreateSeatingSchema,
	UpdateSeatingSchema,
	isEventOwner,
} from './helpers/zod/eventSeatingSchemas';
import { Utils } from '../utils/formatter';
import { AuthRequest } from '../types/express';
import { eventNotFoundError } from './helpers/errors';
import { DatabaseError } from 'pg';

/**
 * Controller for managing event seatings.
 *
 * All endpoints are scoped under the route:
 * - `/events/{id}/seatings`
 *
 * Tagged as `"EventSeating"` in the generated Swagger/OpenAPI documentation.
 */
@Route('events')
@Tags('Event-Seating')
export class EventSeatingController extends Controller {
	private log: Logger;

	constructor() {
		super();
		this.log = logger('[EVENT_SEATING_CONTROLLER]');
	}

	/**
	 * @summary Creates a new seating arrangement for a specific event.
	 * @description This endpoint validates the incoming seating data and the event's existence. It ensures the requesting user is authorized before creating a new seating map and its corresponding arrangement (e.g., section/rows, tables/chairs, or mixed). All database operations are performed within a single transaction to guarantee atomicity.
	 * @param {string} id The unique ID of the event to which the seating will be added.
	 * @param {CreateSeatingInputBody} requestBody The payload containing the seating type and arrangement details.
	 * @param {AuthRequest} req The authenticated request object with the active user's details.
	 * @returns {Promise<APIResponse<SeatingResponse | null>>} A promise that resolves to the newly created seating data on success, or an error response on failure.
	 * @response 201 Seating created successfully.
	 * @response 400 Invalid event ID or request body.
	 * @response 403 User is not authorized to create seating for this event.
	 * @response 404 The specified event was not found.
	 * @response 409 Seating of this type already exists for the event.
	 * @response 500 An unexpected internal server error occurred.
	 * @security bearer
	 * @tags Events
	 */
	@Post('{id}/seating')
	@SuccessResponse('201', 'Seating created successfully')
	@Security('bearer', ['admin', 'staff', 'hoster'])
	public async createSeating(
		@Path() id: string,
		@Body() requestBody: CreateSeatingInputBody,
		@Request() req: AuthRequest,
	): Promise<APIResponse<SeatingResponse | null>> {
		try {
			const normalizedId = Utils.normalizeUuid(id);
			if (!normalizedId) {
				this.setStatus(400);
				return createActionResult<null>(false, null, 'INVALID_ID', 'ID is invalid.');
			}

			if (!(await isEventOwner(req.activeUser!.id, normalizedId))) {
				this.setStatus(403);
				return createActionResult<null>(
					false,
					null,
					'FORBIDDEN',
					'You are not authorized to access this resource.',
				);
			}
			console.log(requestBody);
			// Validate the body using the refined Zod schema
			const parse = CreateSeatingSchema.safeParse(requestBody);
			if (!parse.success) {
				console.error(parse.error);
				const resError = createActionResult<null>(
					false,
					null,
					'VALIDATION_ERROR',
					Utils.formatZodErrors(parse.error.issues),
				);
				this.setStatus(400);
				return resError;
			}
			const data = parse.data;

			// Ensure the event exists before attempting to add seating
			const event = await DB.query.events.findFirst({
				where: eq(schemas.events.id, normalizedId),
			});
			if (!event) {
				this.setStatus(404);
				return createActionResult<null>(false, null, 'NOT_FOUND', 'Event not found.');
			}

			try {
				// Check if seating of the requested type already exists for this event
				const existing = await DB.query.eventSeatMapping.findFirst({
					where: and(
						eq(schemas.eventSeatMapping.eventId, event.id),
						eq(schemas.eventSeatMapping.seatingType, data.seatingType),
					),
				});
				if (existing) {
					this.setStatus(409);
					return createActionResult<null>(
						false,
						null,
						'SEATING_ALREADY_EXISTS',
						`Seating of type '${data.seatingType}' already exists for this event.`,
					);
				}
			} catch (err) {
				if (err instanceof DatabaseError) {
					console.error(err.cause);
				} else if (err instanceof DrizzleQueryError) {
					console.error(err.cause);
					console.error(err.message);
				}
			}

			const now = new Date();

			// Use a transaction to ensure both the main seating map and the
			// specific arrangement are created together, or not at all.
			const created = await DB.transaction(async (tx) => {
				// Step 1: Insert the main seating map record into the `eventSeatMapping` table.
				const [main] = await tx
					.insert(schemas.eventSeatMapping)
					.values({
						eventId: normalizedId,
						seatingType: data.seatingType,
						totalCapacity: data.totalCapacity,
						availableCapacity: data.availableCapacity,
						createdAt: now,
						updatedAt: now,
					})
					.returning();

				if (!main) throw new Error('Failed to create event seating map.');

				let arrangement:
					| SectionAndRowsSeating
					| TableAndChairsSeating
					| MixedSeating
					| undefined;
				// Step 2: Insert the specific seating arrangement based on the seating type.
				switch (data.seatingType) {
					case 'section_n_rows':
						// Insert into the `sectionAndRowsSeating` table, linking to the main map via `seatMapId`.
						[arrangement] = await tx
							.insert(schemas.sectionAndRowsSeating)
							.values({
								seatMapId: main.id,
								noOfSections: data.noOfSections,
								noOfRowsPerSection: data.noOfRowsPerSection,
								noOfChairsPerSection: data.noOfChairsPerSection,
								total: data.totalCapacity,
							})
							.returning();
						break;
					case 'table_n_chairs':
						// Insert into the `tableAndChairsSeating` table.
						[arrangement] = await tx
							.insert(schemas.tableAndChairsSeating)
							.values({
								seatMapId: main.id,
								noOfTables: data.noOfTables,
								noOfChairsPerTable: data.noOfChairsPerTable,
								total: data.totalCapacity,
							})
							.returning();
						break;
					case 'mixed':
						// Insert into the `mixedSeating` table.
						[arrangement] = await tx
							.insert(schemas.mixedSeating)
							.values({
								seatMapId: main.id,
								noOfSections: data.noOfSections,
								noOfRowsPerSection: data.noOfRowsPerSection,
								noOfTables: data.noOfTables,
								noOfChairsPerTable: data.noOfChairsPerTable,
								totalChairTable: data.totalChairTable,
								noOfChairsPerRows: data.noOfChairsPerRows,
								totalSectionRow: data.totalSectionRow,
							})
							.returning();
						break;
					case 'individual':
						arrangement = undefined; // No separate table for individual seating.
						break;
				}

				return { seating: main, arrangement };
			});

			// Step 3: Return a success response with the created data.
			this.setStatus(201);
			return createActionResult(true, created, undefined, 'Seating created successfully.');
		} catch (error: any) {
			console.error('Error Code:', error.code);
			console.error('Error Message:', error.message);
			console.error('Error Detail:', error.detail);
			console.error('Error Hint:', error.hint);
			console.error('Constraint:', error.constraint);
			console.error('Table:', error.table_name);
			console.error('Column:', error.column_name);
			console.error('Severity:', error.severity);

			this.log.error(error.detail);
			this.log.error(error.hint);
			// Step 4: Handle any errors, including those from the transaction.
			this.log.error('createSeating error:', error);
			const status = error.message.includes('not found') ? 404 : 500;
			this.setStatus(status);
			return createActionResult<null>(
				false,
				null,
				'CREATE_SEATING_ERROR',
				error.message || 'Something went wrong.',
			);
		}
	}

	/**
	 * @summary Updates an existing seating arrangement for a specific event.
	 * @description This endpoint allows for partial updates to a seating plan. It validates the seating data and event ID, ensuring the requesting user is authorized. Both the main seating map and its corresponding arrangement (e.g., sections, tables) are updated within an atomic transaction.
	 * @param {string} id The unique ID of the event.
	 * @param {UpdateSeatingInputBody} requestBody The payload containing the seating type and fields to be updated.
	 * @param {AuthRequest} req The authenticated request object with the active user's details.
	 * @returns {Promise<APIResponse<SeatingResponse | null>>} A promise that resolves to the updated seating data on success, or an error response on failure.
	 * @response 200 Seating updated successfully.
	 * @response 400 Invalid IDs or request body.
	 * @response 403 User is not authorized to update seating for this event.
	 * @response 404 The specified event or seating map was not found.
	 * @response 500 An unexpected internal server error occurred.
	 * @security bearer
	 * @tags Events
	 */
	@Put('{id}/seating')
	@SuccessResponse('200', 'Seating updated successfully')
	@Security('bearer', ['admin', 'staff', 'hoster'])
	public async updateSeating(
		@Path() id: string,
		@Body() requestBody: UpdateSeatingInputBody,
		@Request() req: AuthRequest,
	): Promise<APIResponse<SeatingResponse | null>> {
		try {
			// Step 1: Validate incoming IDs.
			const normalizedEventId = Utils.normalizeUuid(id);
			if (!normalizedEventId) {
				this.setStatus(400);
				return createActionResult<null>(false, null, 'INVALID_ID', 'ID is invalid.');
			}

			// Step 2: Check user authorization.
			if (!(await isEventOwner(req.activeUser!.id, normalizedEventId))) {
				this.setStatus(403);
				return createActionResult<null>(
					false,
					null,
					'FORBIDDEN',
					'You are not authorized to perform this action.',
				);
			}

			// Step 3: Validate the request body.
			const parse = UpdateSeatingSchema.safeParse(requestBody);
			if (!parse.success) {
				this.setStatus(400);
				const errorMessage = Utils.formatZodErrors(parse.error.issues);
				return createActionResult<null>(false, null, 'VALIDATION_ERROR', errorMessage);
			}
			const data = parse.data;

			// Step 4: Find the existing seating map to get its type.
			const existingSeating = await DB.query.eventSeatMapping.findFirst({
				where: and(eq(schemas.eventSeatMapping.eventId, normalizedEventId)),
			});

			if (!existingSeating) {
				this.setStatus(404);
				return createActionResult<null>(
					false,
					null,
					'NOT_FOUND',
					'Seating map not found for this event.',
				);
			}

			// Step 5: Check if the seating type in the request matches the existing type.
			if (existingSeating.seatingType !== data.seatingType) {
				this.setStatus(400);
				return createActionResult<null>(
					false,
					null,
					'SEATING_TYPE_MISMATCH',
					'Cannot change the seating type. Please use the create endpoint to create a new one.',
				);
			}

			const updated = await DB.transaction(async (tx) => {
				const now = new Date();

				// 5a: Update the main seating map record with optional fields.
				const [mainSeatingMap] = await tx
					.update(schemas.eventSeatMapping)
					.set({
						totalCapacity: data.totalCapacity,
						availableCapacity: data.availableCapacity,
						updatedAt: now,
					})
					.where(eq(schemas.eventSeatMapping.eventId, existingSeating.eventId))
					.returning();

				if (!mainSeatingMap) {
					throw new Error('Failed to update event seating map.');
				}

				// 5b: Update the specific seating arrangement based on its type.
				let arrangement:
					| SectionAndRowsSeating
					| TableAndChairsSeating
					| MixedSeating
					| undefined;
				switch (data.seatingType) {
					case 'section_n_rows':
						[arrangement] = await tx
							.update(schemas.sectionAndRowsSeating)
							.set({
								noOfSections: data.noOfSections,
								noOfRowsPerSection: data.noOfRowsPerSection,
								noOfChairsPerSection: data.noOfChairsPerSection,
								total: data.totalCapacity,
							})
							.where(eq(schemas.sectionAndRowsSeating.seatMapId, existingSeating.id))
							.returning();
						break;
					case 'table_n_chairs':
						[arrangement] = await tx
							.update(schemas.tableAndChairsSeating)
							.set({
								noOfTables: data.noOfTables,
								noOfChairsPerTable: data.noOfChairsPerTable,
								total: data.totalCapacity,
							})
							.where(eq(schemas.tableAndChairsSeating.seatMapId, existingSeating.id))
							.returning();
						break;
					case 'mixed':
						[arrangement] = await tx
							.update(schemas.mixedSeating)
							.set({
								noOfTables: data.noOfTables,
								noOfChairsPerTable: data.noOfChairsPerTable,
								totalChairTable: data.totalChairTable,
								noOfSections: data.noOfSections,
								noOfRowsPerSection: data.noOfRowsPerSection,
								noOfChairsPerRows: data.noOfChairsPerRows,
								totalSectionRow: data.totalSectionRow,
							})
							.where(eq(schemas.mixedSeating.seatMapId, existingSeating.id))
							.returning();
						break;
					case 'individual':
						// Nothing to update in a separate table for individual seating.
						arrangement = undefined;
						break;
				}

				return { seating: mainSeatingMap, arrangement };
			});

			// Step 6: Return a success response.
			this.setStatus(200);
			return createActionResult(true, updated, undefined, 'Seating updated successfully.');
		} catch (error: any) {
			// Step 7: Handle any errors.
			this.log.error('updateSeating error:', error);
			this.setStatus(500);
			return createActionResult<null>(
				false,
				null,
				'UPDATE_SEATING_ERROR',
				error.message || 'Something went wrong.',
			);
		}
	}

	/**
	 * Retrieves the seating arrangement for a specific event.
	 *
	 * @summary Get Seating for an Event
	 * @param id The unique identifier of the event.
	 * @returns A detailed seating configuration including the main map and its specific arrangement.
	 * @throws {400} - If the provided event ID is invalid.
	 * @throws {404} - If no seating arrangement is found for the event.
	 * @throws {500} - If an unexpected error occurs during the fetch operation.
	 */
	@Get('{id}/seating')
	@SuccessResponse('200', 'Seating fetched successfully')
	@Security('bearer', [])
	public async getSeating(@Path() id: string): Promise<APIResponse<SeatingResponse | null>> {
		try {
			// Step 1: Normalize and validate the event ID.
			const normalizedId = Utils.normalizeUuid(id);
			if (!normalizedId) {
				this.setStatus(400);
				return createActionResult<null>(false, null, 'INVALID_ID', 'ID is invalid.');
			}
			const { eventSeatMapping, sectionAndRowsSeating, tableAndChairsSeating, mixedSeating } =
				schemas;

			// Step 2: Fetch the main event seating map.
			const seating = await DB.query.eventSeatMapping.findFirst({
				where: and(eq(eventSeatMapping.eventId, normalizedId)),
			});

			// Step 3: Handle case where no seating map is found.
			if (!seating) {
				return createActionResult<null>(
					false,
					null,
					'SEATING_NOT_FOUND',
					'Seating not found for this event.',
				);
			}

			// Step 4: Determine the seating type and fetch the specific arrangement details.
			let arrangement:
				| SectionAndRowsSeating
				| TableAndChairsSeating
				| MixedSeating
				| undefined;

			switch (seating.seatingType) {
				case 'section_n_rows':
					arrangement = await DB.query.sectionAndRowsSeating.findFirst({
						where: eq(sectionAndRowsSeating.seatMapId, seating.id),
					});
					break;
				case 'table_n_chairs':
					arrangement = await DB.query.tableAndChairsSeating.findFirst({
						where: eq(tableAndChairsSeating.seatMapId, seating.id),
					});
					break;
				case 'mixed':
					arrangement = await DB.query.mixedSeating.findFirst({
						where: eq(mixedSeating.seatMapId, seating.id),
					});
					break;
				default:
					arrangement = undefined;
			}

			// Step 5: Return the combined seating and arrangement data.
			return createActionResult(
				true,
				{ seating, arrangement },
				undefined,
				'Seating fetched successfully.',
			);
		} catch (error: any) {
			this.log.error('getSeating error:', error);
			const resError = await createActionResult<null>(
				false,
				null,
				'FETCH_SEATING_ERROR',
				'Something went wrong.',
			);
			this.setStatus(500);
			return resError;
		}
	}

	/**
	 * Deletes the seating arrangement for a specific event.
	 *
	 * @summary Delete Event Seating
	 * @param id The unique identifier of the event for which to delete the seating.
	 * @returns A confirmation of the deletion.
	 * @throws {400} - If the provided event ID is invalid.
	 * @throws {404} - If the event or its seating arrangement is not found.
	 * @throws {500} - If an unexpected error occurs during the deletion process.
	 */
	@Delete('{id}/seating')
	@SuccessResponse('200', 'Seating deleted successfully')
	@Security('bearer', ['admin', 'staff', 'hoster'])
	public async deleteSeating(@Path() id: string): Promise<APIResponse<null>> {
		try {
			// Step 1: Normalize and validate the event ID.
			const normalizedId = Utils.normalizeUuid(id);
			if (!normalizedId) {
				this.setStatus(400);
				return createActionResult<null>(false, null, 'INVALID_ID', 'ID is invalid.');
			}

			const {
				eventSeatMapping,
				sectionAndRowsSeating,
				tableAndChairsSeating,
				mixedSeating,
				events,
			} = schemas;

			// Step 2: Ensure the event exists and fetch its seating map.
			const event = await DB.query.events.findFirst({
				where: eq(events.id, normalizedId),
				with: {
					seatingMap: true,
				},
			});

			if (!event) {
				this.setStatus(404);
				return eventNotFoundError();
			}

			// Step 3: Check if a seating arrangement exists for the event.
			if (!event.seatingMap) {
				this.setStatus(404);
				return createActionResult<null>(
					false,
					null,
					'SEATING_NOT_FOUND',
					'Seating not found for this event.',
				);
			}

			// Step 4: Execute the deletion within a transaction to ensure atomicity.
			await DB.transaction(async (tx) => {
				// First, delete the arrangement-specific table based on the seating type.
				switch (event.seatingMap.seatingType) {
					case 'section_n_rows':
						await tx
							.delete(sectionAndRowsSeating)
							.where(eq(sectionAndRowsSeating.seatMapId, event.seatingMap.id));
						break;
					case 'table_n_chairs':
						await tx
							.delete(tableAndChairsSeating)
							.where(eq(tableAndChairsSeating.seatMapId, event.seatingMap.id));
						break;
					case 'mixed':
						await tx
							.delete(mixedSeating)
							.where(eq(mixedSeating.seatMapId, event.seatingMap.id));
						break;
					case 'individual':
						// No specific arrangement table to delete for 'individual' seating.
						break;
				}

				// Second, delete the main seating map record.
				await tx
					.delete(eventSeatMapping)
					.where(eq(eventSeatMapping.id, event.seatingMap.id));
			});

			// Step 5: Return a success message upon completion.
			const resData = await createActionResult(
				true,
				null,
				undefined,
				'Seating deleted successfully.',
			);
			this.setStatus(200);
			return resData;
		} catch (error: any) {
			this.log.error('deleteSeating error:', error);
			const resError = await createActionResult<null>(
				false,
				null,
				'DELETE_SEATING_ERROR',
				'Something went wrong.',
			);
			this.setStatus(500);
			return resError;
		}
	}
}
