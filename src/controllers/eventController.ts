import logger, { Logger } from '../utils/logger';
import {
	Controller,
	Get,
	Path,
	Query,
	Request,
	Route,
	Tags,
	SuccessResponse,
	Post,
	Body,
	Put,
	Delete,
	Security,
} from 'tsoa';
import { db as DB } from '../db/index';
import { createActionResult, withPagination } from '../db/helpers/withPagination';
import { APIResponse, PaginatedResult } from '../types/response';
import {
	EventCategorySchema,
	EventCategoryUpdateSchema,
	EventTagSchema,
	EventTagUpdateSchema,
	UpdateEventInputSchema,
} from './helpers/zod/eventSchema';
import {
	EventCategory,
	EventCategoryInput,
	Events,
	events,
	EventTag,
	UpdateEventCategoryInput,
} from '../db/schemas/events';
import { and, eq, gt, lt } from 'drizzle-orm';
// import { Request as ExpressRequest } from 'express';
import { AuthRequest } from '../types/express';
import schemas from '../db/schemas';
import config from '../config';
import { CreateEventInputSchema } from './helpers/zod/eventSchema';
import { CreateEventDTO, EventDto, EventOnlyDTO, UpdateEventInput } from '../types/events';
import { Utils } from '../utils/formatter';

/**
 * Controller for handling Event-related operations.
 * get all events, get events by filter (category,id,etc)
 */
@Route('events')
@Tags('Events')
export class EventController extends Controller {
	private log: Logger;

	constructor() {
		super();
		this.log = logger('[EVENT_CONTROLLER]');
	}

	/**
	 * @summary Creates a new event category.
	 * @description This endpoint validates the request body against the EventCategorySchema and creates a new event category record in the database.
	 * @param requestBody The data required to create an event category.
	 * @returns A promise that resolves to an APIResponse containing the newly created EventCategory object or a null value in case of an error.
	 * @tags EventCategory
	 * @response 201 The event category was created successfully.
	 * @response 400 The request body is invalid.
	 * @response 500 An internal server error occurred during creation.
	 */
	@Post('category')
	@SuccessResponse('201', 'Created')
	public async createEventCategory(
		@Body() requestBody: EventCategoryInput,
	): Promise<APIResponse<EventCategory | null>> {
		try {
			// Step 1: Validate request body against the EventCategorySchema.
			// This ensures the data is well-formed and meets all required constraints before processing.
			const validation = EventCategorySchema.safeParse(requestBody);
			if (!validation.success) {
				const resError = await createActionResult<null>(
					false,
					null,
					'VALIDATION_ERROR',
					validation.error.issues
						.map((issue) => `${issue.message} for field/s [${issue.path.join(',')}]`)
						.join(', '),
				);
				this.setStatus(400);
				return resError;
			}

			// Step 2: Insert the validated data into the database.
			// Drizzle-ORM is used here to perform the insert operation and return the newly created record.
			const [cat] = await DB.insert(schemas.eventCategory)
				.values({ ...validation.data })
				.returning();

			this.setStatus(201);
			return await createActionResult<EventCategory>(
				true,
				cat,
				undefined,
				'Event category created successfully',
			);
		} catch (error: any) {
			this.log.error('Error authenticating user:', error);
			const resError = await createActionResult<null>(
				false,
				null,
				'EVENT_CATEGORY_CREATION_ERROR',
				config.NODE_ENV === 'production'
					? 'Internal error during event category creation.'
					: error.message,
			);
			this.setStatus(500);
			return resError;
		}
	}

	/**
	 * @summary Updates an existing event category by ID.
	 * @description This endpoint updates one or more fields of an event category based on its unique ID.
	 * @param id The UUID of the event category to update.
	 * @param requestBody The fields to be updated.
	 * @returns A promise that resolves to an APIResponse containing the updated EventCategory object or a null value if not found.
	 * @tags EventCategory
	 * @response 200 The event category was updated successfully.
	 * @response 400 The request ID or body is invalid.
	 * @response 404 The event category was not found.
	 * @response 500 An internal server error occurred during the update.
	 */
	@Put('category/{id}')
	@SuccessResponse('200', 'Updated')
	@Security('bearer', ['admin', 'staff'])
	public async updateEventCategory(
		@Path() id: string,
		@Body() requestBody: UpdateEventCategoryInput,
	): Promise<APIResponse<EventCategory | null>> {
		try {
			// Step 0: Verify that the provided ID is valid and not empty.
			const normalizedId = Utils.normalizeUuid(id);
			if (!normalizedId) {
				this.setStatus(400);
				return createActionResult<null>(false, null, 'INVALID_ID', 'ID is invalid.');
			}

			// Step 1: Validate the request body using a partial schema.
			// This ensures that only provided fields are validated.
			const validation = EventCategoryUpdateSchema.partial().safeParse(requestBody);
			if (!validation.success) {
				const resError = await createActionResult<null>(
					false,
					null,
					'VALIDATION_ERROR',
					validation.error.issues
						.map((issue) => `${issue.message} for field/s [${issue.path.join(',')}]`)
						.join(', '),
				);
				this.setStatus(400);
				return resError;
			}

			// Step 2: Update the record in the database based on the provided ID.
			const [updatedCat] = await DB.update(schemas.eventCategory)
				.set({ ...validation.data, updatedAt: new Date() })
				.where(eq(schemas.eventCategory.id, id))
				.returning();

			// Step 3: Handle the case where the category was not found.
			if (!updatedCat) {
				this.setStatus(404);
				return await createActionResult<null>(
					false,
					null,
					'NOT_FOUND',
					'Event category not found',
				);
			}

			this.setStatus(200);
			return await createActionResult<EventCategory>(true, updatedCat);
		} catch (error: any) {
			this.log.error('Error updating event category:', error);
			const resError = await createActionResult<null>(
				false,
				null,
				'EVENT_CATEGORY_UPDATE_ERROR',
				config.NODE_ENV === 'production'
					? 'Internal error during event category update.'
					: error.message,
			);
			this.setStatus(500);
			return resError;
		}
	}

	/**
	 * @summary Deletes an event category by ID.
	 * @description This endpoint permanently deletes an event category from the database.
	 * @param id The UUID of the event category to delete.
	 * @returns A promise that resolves to an APIResponse confirming the deletion or a null value if the category was not found.
	 * @tags EventCategory
	 * @response 200 The event category was deleted successfully.
	 * @response 400 The request ID is invalid.
	 * @response 404 The event category was not found.
	 * @response 500 An internal server error occurred during deletion.
	 */
	@Delete('category/{id}')
	@SuccessResponse('200', 'Deleted')
	@Security('bearer', ['admin', 'staff'])
	public async deleteEventCategory(@Path() id: string): Promise<APIResponse<null>> {
		try {
			// Step 0: Verify that the provided ID is valid.
			const normalizedId = Utils.normalizeUuid(id);
			if (!normalizedId) {
				this.setStatus(400);
				return createActionResult<null>(false, null, 'INVALID_ID', 'ID is invalid.');
			}

			// Step 1: Execute the delete operation in the database.
			// Drizzle's returning() method will return the deleted record, which we check for existence.
			const deletedCount = await DB.delete(schemas.eventCategory)
				.where(eq(schemas.eventCategory.id, id))
				.returning();

			// Step 2: Handle the case where no category was deleted.
			if (deletedCount.length === 0) {
				this.setStatus(404);
				return await createActionResult<null>(
					false,
					null,
					'NOT_FOUND',
					'Event category not found',
				);
			}

			this.setStatus(200);
			return await createActionResult<null>(
				true,
				null,
				undefined,
				'Event category deleted successfully',
			);
		} catch (error: any) {
			this.log.error('Error deleting event category:', error);
			const resError = await createActionResult<null>(
				false,
				null,
				'EVENT_CATEGORY_DELETION_ERROR',
				config.NODE_ENV === 'production'
					? 'Internal error during event category deletion.'
					: error.message,
			);
			this.setStatus(500);
			return resError;
		}
	}

	/**
	 * @summary Retrieves all event categories.
	 * @description Fetches a list of all event categories from the database, ordered by name in ascending order.
	 * @returns A promise that resolves to an APIResponse containing an array of EventCategory objects.
	 * @tags EventCategory
	 * @response 200 The event categories were fetched successfully.
	 * @response 500 An internal server error occurred during the fetch operation.
	 */
	@Get('category')
	@SuccessResponse('200', 'Event categories fetched successfully')
	public async getAllEventCategories(): Promise<APIResponse<EventCategory[] | null>> {
		try {
			const categoriesList = await DB.query.eventCategory.findMany({
				orderBy: (c, { asc }) => asc(c.name),
			});

			return createActionResult(
				true,
				categoriesList,
				undefined,
				'Event categories fetched successfully',
			);
		} catch (error: any) {
			this.log.error('Error fetching event categories:', error);
			return createActionResult(false, null, 'FETCH_EVENT_CATEGORIES_ERROR', error.message);
		}
	}

	/**
	 * @summary Creates a new event tag.
	 * @description This endpoint validates the request body for a new tag's name and creates a new tag record in the database.
	 * @param requestBody The data required to create an event tag, containing the `name` property.
	 * @returns A promise that resolves to an APIResponse containing the newly created EventTag object or a null value in case of an error.
	 * @tags EventTag
	 * @response 201 The event tag was created successfully.
	 * @response 400 The request body is invalid.
	 * @response 500 An internal server error occurred during creation.
	 */
	@Post('tags')
	@SuccessResponse('201', 'Created')
	public async createEventTag(
		@Body() requestBody: { name: string },
	): Promise<APIResponse<EventTag | null>> {
		try {
			// Step 1: Validate request body against the EventTagSchema.
			const validation = EventTagSchema.safeParse(requestBody);
			if (!validation.success) {
				const resError = await createActionResult<null>(
					false,
					null,
					'VALIDATION_ERROR',
					validation.error.issues
						.map((issue) => `${issue.message} for field/s [${issue.path.join(',')}]`)
						.join(', '),
				);
				this.setStatus(400);
				return resError;
			}

			// Step 2: Insert the validated data into the database.
			const [tag] = await DB.insert(schemas.eventTags)
				.values({ ...validation.data })
				.returning();

			this.setStatus(201);
			return await createActionResult<EventTag>(
				true,
				tag,
				undefined,
				'Event tag created successfully',
			);
		} catch (error: any) {
			this.log.error('Error creating event tag:', error);
			const resError = await createActionResult<null>(
				false,
				null,
				'EVENT_TAG_CREATION_ERROR',
				config.NODE_ENV === 'production'
					? 'Internal error during event tag creation.'
					: error.message,
			);
			this.setStatus(500);
			return resError;
		}
	}

	/**
	 * @summary Updates an existing event tag by ID.
	 * @description This endpoint updates the name of an event tag based on its unique ID.
	 * @param id The UUID of the event tag to update.
	 * @param requestBody The new data for the event tag.
	 * @returns A promise that resolves to an APIResponse containing the updated EventTag object or a null value if the tag was not found.
	 * @tags EventTag
	 * @response 200 The event tag was updated successfully.
	 * @response 400 The request ID or body is invalid.
	 * @response 404 The event tag was not found.
	 * @response 500 An internal server error occurred during the update.
	 */
	@Put('tags/{id}')
	@SuccessResponse('200', 'Updated')
	@Security('bearer', ['admin', 'staff'])
	public async updateEventTag(
		@Path() id: string,
		@Body() requestBody: { name?: string },
	): Promise<APIResponse<EventTag | null>> {
		try {
			// Step 0: Verify that the provided ID is valid and not empty.
			const normalizedId = Utils.normalizeUuid(id);
			if (!normalizedId) {
				this.setStatus(400);
				return createActionResult<null>(false, null, 'INVALID_ID', 'ID is invalid.');
			}

			// Step 1: Validate the request body using a partial schema.
			const validation = EventTagUpdateSchema.partial().safeParse(requestBody);
			if (!validation.success) {
				const resError = await createActionResult<null>(
					false,
					null,
					'VALIDATION_ERROR',
					validation.error.issues
						.map((issue) => `${issue.message} for field/s [${issue.path.join(',')}]`)
						.join(', '),
				);
				this.setStatus(400);
				return resError;
			}

			// Step 2: Update the record in the database based on the provided ID.
			const [updatedTag] = await DB.update(schemas.eventTags)
				.set({ ...validation.data, updatedAt: new Date() })
				.where(eq(schemas.eventTags.id, id))
				.returning();

			// Step 3: Handle the case where the tag was not found.
			if (!updatedTag) {
				this.setStatus(404);
				return await createActionResult<null>(
					false,
					null,
					'NOT_FOUND',
					'Event tag not found',
				);
			}
			this.setStatus(200);
			return await createActionResult<EventTag>(true, updatedTag);
		} catch (error: any) {
			this.log.error('Error updating event tag:', error);
			const resError = await createActionResult<null>(
				false,
				null,
				'EVENT_TAG_UPDATE_ERROR',
				config.NODE_ENV === 'production'
					? 'Internal error during event tag update.'
					: error.message,
			);
			this.setStatus(500);
			return resError;
		}
	}

	/**
	 * @summary Deletes an event tag by ID.
	 * @description This endpoint permanently deletes an event tag from the database.
	 * @param id The UUID of the event tag to delete.
	 * @returns A promise that resolves to an APIResponse confirming the deletion or a null value if the tag was not found.
	 * @tags EventTag
	 * @response 200 The event tag was deleted successfully.
	 * @response 400 The request ID is invalid.
	 * @response 404 The event tag was not found.
	 * @response 500 An internal server error occurred during deletion.
	 */
	@Delete('tags/{id}')
	@SuccessResponse('200', 'Deleted')
	@Security('bearer', ['admin', 'staff'])
	public async deleteEventTag(@Path() id: string): Promise<APIResponse<null>> {
		try {
			// Step 0: Verify that the provided ID is valid.
			const normalizedId = Utils.normalizeUuid(id);
			if (!normalizedId) {
				this.setStatus(400);
				return createActionResult<null>(false, null, 'INVALID_ID', 'ID is invalid.');
			}

			// Step 1: Execute the delete operation in the database.
			const deletedCount = await DB.delete(schemas.eventTags)
				.where(eq(schemas.eventTags.id, id))
				.returning();

			// Step 2: Handle the case where no tag was deleted.
			if (deletedCount.length === 0) {
				this.setStatus(404);
				return await createActionResult<null>(
					false,
					null,
					'NOT_FOUND',
					'Event tag not found',
				);
			}

			this.setStatus(200);
			return await createActionResult<null>(
				true,
				null,
				undefined,
				'Event tag deleted successfully',
			);
		} catch (error: any) {
			this.log.error('Error deleting event tag:', error);
			const resError = await createActionResult<null>(
				false,
				null,
				'EVENT_TAG_DELETION_ERROR',
				config.NODE_ENV === 'production'
					? 'Internal error during event tag deletion.'
					: error.message,
			);
			this.setStatus(500);
			return resError;
		}
	}

	/**
	 * @summary Retrieves all event tags.
	 * @description This endpoint fetches a list of all event tags from the database, ordered alphabetically by name.
	 * @returns A promise that resolves to an APIResponse containing an array of EventTag objects or null if an error occurs.
	 * @tags EventTag
	 * @response 200 The event tags were fetched successfully.
	 * @response 500 An internal server error occurred while fetching the tags.
	 */
	@Get('tags')
	@SuccessResponse('200', 'Event tags fetched successfully')
	public async getAllEventTags(): Promise<APIResponse<EventTag[] | null>> {
		try {
			// Step 1: Query the database for all event tags.
			// The Drizzle ORM query selects all records from the 'eventTags' table.
			const tagsList = await DB.query.eventTags.findMany({
				orderBy: (t, { asc }) => asc(t.name),
			});

			// Step 2: Return a successful response with the fetched data.
			// The createActionResult helper formats the response consistently.
			return createActionResult(true, tagsList, undefined, 'Event tags fetched successfully');
		} catch (error: any) {
			// Step 3: Handle any unexpected errors during the database query.
			// Log the error for debugging and return a consistent error response.
			this.log.error('Error fetching event tags:', error);
			return createActionResult(false, null, 'FETCH_EVENT_TAGS_ERROR', error.message);
		}
	}

	/**
	 * @summary Creates a new event and its related records.
	 * @description This endpoint handles the creation of a new event, including its tags, contact information, and recurring details, within a single database transaction. Upon successful creation, it invalidates the Redis cache for event lists to ensure users fetch the most up-to-date data.
	 * @param req The Express request object containing the active user and Redis client.
	 * @param requestBody The complete event data from the form steps.
	 * @returns A promise that resolves to an APIResponse indicating success or failure.
	 * @response 201 The event was created successfully.
	 * @response 400 The request body is invalid.
	 * @response 500 An internal server error occurred during event creation.
	 * @security bearer
	 * @tags Events
	 */
	@Post()
	@SuccessResponse('201', 'Created')
	@Security('bearer', ['admin', 'staff', 'hoster'])
	public async createEvent(
		@Request() req: AuthRequest,
		@Body() requestBody: CreateEventDTO,
	): Promise<APIResponse<EventOnlyDTO | null>> {
		try {
			const organiser_details = await DB.query.organiser.findFirst({
				where: eq(schemas.organiser.userId, req.activeUser?.id!),
			});
			// Step 1: Validate the request body.
			// A manual check with safeParse is used for fine-grained error handling.
			const validation = CreateEventInputSchema.safeParse(requestBody);
			if (!validation.success) {
				this.setStatus(400);
				const errorMessage = validation.error.issues
					.map((issue) => `${issue.message} for field '${issue.path.join('.')}'`)
					.join('; ');
				return createActionResult(false, null, 'VALIDATION_ERROR', errorMessage);
			}

			const { tags, recurrenceDetails, contact, ...eventData } = validation.data;

			// ALt: Cheeck if event category exists or not
			// Check if the input looks like a UUID first
			const isUuid =
				/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

			let catExists;
			if (isUuid.test(eventData.eventCategory)) {
				// Search by ID only if it's a UUID
				catExists = await DB.query.eventCategory.findFirst({
					where: eq(schemas.eventCategory.id, eventData.eventCategory),
				});
			} else {
				// Search by name only if it's not a UUID
				catExists = await DB.query.eventCategory.findFirst({
					where: eq(schemas.eventCategory.name, eventData.eventCategory),
				});
			}

			if (!catExists) {
				[catExists] = await DB.insert(schemas.eventCategory)
					.values({
						name: eventData.eventCategory,
					})
					.returning();
			}

			// Step 2: Use a transaction to ensure all related records are created together.
			const newEvent = await DB.transaction(async (tx) => {
				// Step 3: Insert the main event record.
				const [newEvent] = await tx
					.insert(schemas.events)
					.values({
						...eventData,
						organiserID: organiser_details?.id,
						eventCategory: catExists!.id,
						publishedTimestamp: new Date(),
						createdAt: new Date(),
						updatedAt: new Date(),
					})
					.returning();

				if (!newEvent) {
					throw new Error('Failed to create event record.');
				}

				const newEventId = newEvent.id;

				// Step 4: Insert related records (tags, contact, recurrence details) using the new event ID.
				if (tags && tags.length > 0) {
					const tagsToInsert = tags.map((tagId) => ({
						eventId: newEventId,
						tagId: tagId,
					}));
					await tx.insert(schemas.eventToTags).values(tagsToInsert);
				}

				if (recurrenceDetails && recurrenceDetails.length > 0) {
					const recurrenceToInsert = recurrenceDetails.map((detail) => ({
						...detail,
						eventId: newEventId,
					}));
					await tx.insert(schemas.eventRecurranceDetail).values(recurrenceToInsert);
				}
				
				await tx.insert(schemas.eventContact).values({
					...contact,
					eventId: newEventId,
				});

				return newEvent;
			});

			// Step 5: Invalidate the Redis cache for event lists.
			// This ensures that subsequent GET requests for the event list will fetch the new, updated data from the database.
			// We use a wildcard (`*`) to delete all keys matching the `events:list:*` pattern.
			const redis = req.redisClient;
			if (redis) {
				const keys = await redis.keys('events:list:*');
				const fKeys = await redis.keys('events:filter:*');
				if (keys.length > 0) {
					await redis.del({ ...keys });
					await redis.del({ ...fKeys });
					this.log.info(`Invalidated ${keys.length} event list cache keys.`);
					this.log.info(`Invalidated ${fKeys.length} filtered event list cache keys.`);
				}
			}

			// Step 6: Return a success response.
			this.setStatus(201);
			return createActionResult(true, newEvent, undefined, 'Event created successfully.');
		} catch (error: any) {
			console.error(
				'Error Object:',
				JSON.stringify(error, Object.getOwnPropertyNames(error), 2),
			);

			this.log.error('Error creating event:', error);
			this.setStatus(500);
			// Step 7: Handle any unexpected errors.
			this.log.error('Error creating event:', error);
			this.setStatus(500);
			const errorMessage =
				process.env.NODE_ENV === 'production'
					? 'Internal error during event creation.'
					: error.message;
			return createActionResult(false, null, 'EVENT_CREATION_ERROR', errorMessage);
		}
	}

	/**
	 * @summary Updates an existing event and its related records.
	 * @description This endpoint finds an event by its ID and updates its details, contact information, tags, and recurring dates. All updates are handled within a single database transaction to maintain data integrity. Upon success, it invalidates the relevant Redis cache keys to ensure data consistency across the application.
	 * @param id The unique ID of the event to update.
	 * @param req The Express request object, containing the active user and Redis client.
	 * @param requestBody The complete event data to update.
	 * @returns A promise that resolves to an APIResponse indicating success or failure.
	 * @response 200 The event was updated successfully.
	 * @response 400 The request body is invalid.
	 * @response 404 The event was not found.
	 * @response 500 An internal server error occurred during event creation.
	 * @security bearer
	 * @tags Events
	 */
	@Put('{id}')
	@SuccessResponse('200', 'Updated')
	@Security('bearer', ['admin', 'staff', 'hoster'])
	public async updateEvent(
		@Path() id: string,
		@Request() req: AuthRequest,
		@Body() requestBody: UpdateEventInput,
	): Promise<APIResponse<EventDto | null>> {
		try {
			// Step 1: Validate the request body.
			const normalizedId = Utils.normalizeUuid(id);
			if (!normalizedId) {
				this.setStatus(400);
				return createActionResult<null>(false, null, 'INVALID_ID', 'ID is invalid.');
			}

			// Using a dedicated Zod schema for updates, which can handle partial data.
			const validation = UpdateEventInputSchema.safeParse(requestBody);
			if (!validation.success) {
				this.setStatus(400);
				const errorMessage = validation.error.issues
					.map((issue) => `${issue.message} for field '${issue.path.join('.')}'`)
					.join('; ');
				return createActionResult(false, null, 'VALIDATION_ERROR', errorMessage);
			}

			if (!validation.data) {
				return createActionResult(
					false,
					null,
					'VALIDATION_ERROR',
					'Validated data is undefined',
				);
			}

			const { tags, recurrenceDetails, contact, ...eventData } = validation.data;

			// Step 2: Use a transaction to perform all related updates atomically.
			const existingEvent = await DB.transaction(async (tx) => {
				// Step 3: Find and update the main event record.
				const existingEvent = await tx.query.events.findFirst({
					where: eq(schemas.events.id, id),
					with: {
						contact: true,
						seatingMap: {
							with: {
								mixedSeating: true,
								sectionAndRows: true,
								tableAndChairs: true,
							},
						},
						recurringDates: true,
					},
				});

				if (!existingEvent) {
					this.setStatus(404);
					throw new Error('Event not found.');
				}

				await tx
					.update(schemas.events)
					.set({
						...eventData,
						updatedAt: new Date(),
					})
					.where(eq(schemas.events.id, id));

				// Step 4: Update related records by clearing and re-inserting.
				// This is a common pattern for many-to-many or one-to-many relationships.

				// Update tags: delete all existing and insert new ones.
				await tx.delete(schemas.eventToTags).where(eq(schemas.eventToTags.eventId, id));
				if (tags && tags.length > 0) {
					const tagsToInsert = tags.map((tagId) => ({
						eventId: id,
						tagId: tagId,
					}));
					await tx.insert(schemas.eventToTags).values(tagsToInsert);
				}

				// Update recurrence details: delete all existing and insert new ones.
				await tx
					.delete(schemas.eventRecurranceDetail)
					.where(eq(schemas.eventRecurranceDetail.eventId, id));

				if (recurrenceDetails && recurrenceDetails.length > 0) {
					const recurrenceToInsert = recurrenceDetails.map((detail) => ({
						...detail,
						eventId: id,
					}));
					await tx.insert(schemas.eventRecurranceDetail).values(recurrenceToInsert);
				}

				// Update contact details: update the existing record or insert if it doesn't exist.
				// Assuming one contact per event, you can perform an upsert.
				if (contact) {
					await tx
						.update(schemas.eventContact)
						.set({
							...contact,
						})
						.where(eq(schemas.eventContact.eventId, id));
				}

				return existingEvent;
			});

			// Step 5: Invalidate the Redis cache.
			// Invalidate all event lists to ensure subsequent GET requests get the updated data.
			const redis = req.redisClient;
			if (redis) {
				const listKeys = await redis.keys('events:list:*');
				const filterKeys = await redis.keys('events:filter:*');
				const allKeys = [...listKeys, ...filterKeys];
				if (allKeys.length > 0) {
					await redis.del({ ...allKeys });
					this.log.info(`Invalidated ${allKeys.length} event cache keys.`);
				}
			}

			// Step 6: Return a success response.
			this.setStatus(200);
			return createActionResult(
				true,
				existingEvent,
				undefined,
				'Event updated successfully.',
			);
		} catch (error: any) {
			// Step 7: Handle any unexpected errors.
			this.log.error('Error updating event:', error);
			this.setStatus(error.message === 'Event not found.' ? 404 : 500);
			const errorMessage =
				process.env.NODE_ENV === 'production'
					? 'Internal error during event update.'
					: error.message;
			return createActionResult(false, null, 'EVENT_UPDATE_ERROR', errorMessage);
		}
	}

	/**
	 * @summary Fetches a paginated list of published events.
	 * @description This endpoint retrieves a list of events with a 'published' status, supporting cursor-based pagination for efficient data retrieval. It first attempts to serve the request from a Redis cache to improve performance and reduce database load. If the data is not in the cache, it fetches the events from the database, validates the data, and stores the result in Redis for subsequent requests.
	 * * @param req The Express request object, which is assumed to contain a Redis client instance.
	 * @param pageSize The number of events to return per page (defaults to 20).
	 * @param cursor An optional timestamp string representing the `createdAt` value of the last event from the previous page, used for cursor-based pagination.
	 * @returns A promise that resolves to an APIResponse containing a paginated list of events.
	 * @response 200 The events were fetched successfully, either from the cache or the database.
	 * @response 404 No events were found.
	 * @response 500 An internal server error occurred while processing the request.
	 * @tags Events
	 */
	@Get()
	@SuccessResponse('200', 'Events fetched successfully')
	public async getEvents(
		@Request() req: AuthRequest,
		@Query() pageSize: number = 20,
		@Query() cursor?: string,
	): Promise<APIResponse<PaginatedResult<Events> | null>> {
		try {
			this.log.info('Fetching published events...');

			const redis = req.redisClient;
			const cacheKey = `events:list:${cursor || 'start'}:${pageSize}`;

			// Step 1: Check Redis cache for an existing result.
			// This is a key performance optimization to reduce database queries.
			if (redis) {
				try {
					const cached = await redis.get(cacheKey);
					if (cached) {
						this.log.info('Fetching events from cache');
						const parsed = JSON.parse(cached) as PaginatedResult<Events>;
						return createActionResult(
							true,
							parsed,
							undefined,
							'Events fetched successfully (c)',
						);
					}
				} catch (err) {
					// Fallback to database query if Redis is unavailable or an error occurs.
					this.log.warn('Redis unavailable, falling back to DB:', err);
				}
			}

			// Step 2: Build the query conditions for the database.
			// A 'published' status is always required. The cursor is used to filter events created before the last one.
			const conditions = [eq(events.status, 'published')];
			if (cursor) {
				conditions.push(lt(events.createdAt, new Date(cursor)));
			}

			// Step 3: Fetch events from the database.
			// We fetch one extra record (`pageSize + 1`) to determine if there is a next page.
			const eventsList = await DB.query.events.findMany({
				where: and(...conditions),
				orderBy: (t, { desc }) => desc(t.createdAt),
				limit: pageSize + 1,
			});

			// Step 4(DEPRECATED): Validate the fetched data using Zod.
			// This ensures that the data from the database conforms to the expected schema, providing a safety net against data corruption.
			// const parsed = EventSchema.array().safeParse(eventsList);
			// if (!parsed.success) {
			// 	this.log.warn('Validation failed', parsed.error.format());
			// 	this.setStatus(500);
			// 	return createActionResult(
			// 		false,
			// 		null,
			// 		'VALIDATION_ERROR',
			// 		'Failed to fetch events due to schema mismatch.',
			// 	);
			// }

			// Step 5: Map the raw database records to a Data Transfer Object (DTO).
			// This isolates the API's public-facing schema from the internal database schema.
			// const dtoList: EventDto[] = eventsList.map(event => ({
			// 	...event,
			// 	recurringDates: event.recurringDates?.map(rd => ({
			// 		...rd,
			// 		recurrenceLocation: rd.recurrenceLocation === null ? undefined : rd.recurrenceLocation,
			// 	})) ?? [],
			// }));

			// Step 6: Apply pagination logic to format the result.
			// The `withPagination` helper processes the results to determine if a next page exists.
			const paginated = await withPagination(eventsList, pageSize);

			// Step 7: Handle the case where no events are found.
			if (paginated.data.length === 0) {
				this.setStatus(404);
				return createActionResult(false, null, 'NO_EVENTS', 'No events at the moment.');
			}

			// Step 8: Cache the results in Redis.
			// This step is critical for performance, as subsequent identical requests will be served from the fast cache.
			await redis?.set(cacheKey, JSON.stringify(paginated), { EX: 60 * 30 }); // TTL of 30 minutes

			// Step 9: Return the final, paginated result.
			this.setStatus(200);
			return createActionResult(true, paginated, undefined, 'Events fetched successfully');
		} catch (error: any) {
			// Step 10: Catch and handle any unexpected errors.
			// Log the error for internal debugging and return a generic error response to the client.
			this.log.error('Error fetching events:', error);
			this.setStatus(500);
			const resError = createActionResult(false, null, 'FETCH_EVENTS_ERROR', error.message);
			return resError;
		}
	}

	/**
	 * @summary Fetch filtered events with optional pagination.
	 * Returns events filtered by status, category, organiser, and timeframe.
	 * Supports cursor-based pagination and Redis caching (10 minutes TTL).
	 *
	 * @param status Filter by event status: published, completed, cancelled, ongoing, or draft
	 * @param category Filter by event category
	 * @param organiserId Filter by organiser ID
	 * @param pageSize Number of events to return per request (default: 20)
	 * @param cursor Optional cursor for pagination (timestamp of last fetched event)
	 * @param timeframe Timeframe to filter events: past, upcoming, or all (default: all)
	 * @returns Paginated list of filtered events
	 */

	@Get('filter')
	@SuccessResponse('200', 'Filtered events fetched successfully')
	public async getFilteredEvents(
		@Request() req: AuthRequest,
		@Query() status?: 'published' | 'completed' | 'cancelled' | 'ongoing' | 'draft',
		@Query() category?: string,
		@Query() organiserId?: string,
		@Query() pageSize: number = 20,
		@Query() cursor?: string,
		@Query() timeframe: 'past' | 'upcoming' | 'all' = 'all',
	): Promise<APIResponse<PaginatedResult<Events> | null>> {
		try {
			this.log.info(`Fetching filtered events [timeframe=${timeframe}]...`);

			const redis = req.redisClient;
			const cacheKey = `events:filter:${status || 'any'}:${category || 'any'}:${organiserId || 'any'}:${timeframe}:${cursor || 'start'}:${pageSize}`;

			//check cache
			if (redis) {
				try {
					const cached = await redis.get(cacheKey);
					if (cached) {
						this.log.info(`Serving filtered events from cache [${cacheKey}]`);
						const parsed = JSON.parse(cached) as PaginatedResult<Events>;
						return createActionResult(
							true,
							parsed,
							undefined,
							'Filtered events fetched successfully (c)',
						);
					}
				} catch (err) {
					this.log.warn('Redis unavailable, falling back to DB:', err);
				}
			}

			// query conditions
			const conditions: any[] = [];
			if (status) conditions.push(eq(events.status, status));
			if (category) conditions.push(eq(events.eventCategory, category));
			if (organiserId) conditions.push(eq(events.organiserID, organiserId));

			//timeframe & cursor
			const now = new Date();
			const referenceDate = cursor ? new Date(cursor) : now;

			if (timeframe === 'past') {
				conditions.push(lt(events.publishedTimestamp, referenceDate));
			} else if (timeframe === 'upcoming') {
				conditions.push(gt(events.publishedTimestamp, referenceDate));
			}
			//fetch from DB
			const eventsList = await DB.query.events.findMany({
				where: conditions.length > 0 ? and(...conditions) : undefined,
				orderBy: (t, { desc, asc }) =>
					timeframe === 'upcoming'
						? asc(t.publishedTimestamp)
						: desc(t.publishedTimestamp),
				limit: pageSize + 1,
			});

			//validate with Zod
			// const parsed = EventSchema.array().safeParse(eventsList);
			// if (!parsed.success) {
			// 	this.log.warn('Validation failed', parsed.error.format());
			// 	return createActionResult(
			// 		false,
			// 		null,
			// 		'VALIDATION_ERROR',
			// 		'Failed to fetch filtered events',
			// 	);
			// }
			//map to DTO
			// const dtoList: EventDto[] = parsed.data as EventDto[];

			// pagination and generate nextCursor
			const paginated = await withPagination(eventsList, pageSize, 'publishedTimestamp');

			if (paginated.data.length === 0) {
				this.setStatus(404);
				return createActionResult(
					false,
					null,
					'NO_EVENTS',
					'No events found with the given filters.',
				);
			}

			//cache result
			await redis?.set(cacheKey, JSON.stringify(paginated), { EX: 60 * 10 });

			return createActionResult(
				true,
				paginated,
				undefined,
				'Filtered events fetched successfully',
			);
		} catch (error: any) {
			this.log.error('Error fetching filtered events:', error);
			return createActionResult(
				false,
				null,
				'FETCH_EVENTS_ERROR',
				error.message || 'Failed to fetch filtered events.',
			);
		}
	}

	/**
	 * @summary Fetches a single event by its unique ID.
	 * @description This endpoint retrieves a specific event from the database using its unique ID. It validates the retrieved data against the `EventSchema` to ensure data integrity before returning the result.
	 * @param id The unique ID of the event to retrieve.
	 * @returns A promise that resolves to an APIResponse containing the requested event data or null if not found.
	 * @response 200 The event was fetched successfully.
	 * @response 404 The event with the specified ID was not found.
	 * @response 500 An internal server error occurred while fetching the event.
	 * @tags Events
	 */
	@Get('{id}')
	@SuccessResponse('200', 'Event fetched successfully')
	public async getEventById(@Path() id: string): Promise<APIResponse<EventDto | null>> {
		try {
			const normalizedId = Utils.normalizeUuid(id);
			if (!normalizedId) {
				this.setStatus(400);
				return createActionResult<null>(false, null, 'INVALID_ID', 'ID is invalid.');
			}

			// Step 1: Query the database for the event.
			// A `findFirst` query with a `where` clause on the event ID is used for an efficient lookup.
			const event = await DB.query.events.findFirst({
				where: eq(events.id, id),
				with: {
					contact: true,
					recurringDates: true,
					seatingMap: {
						with: {
							mixedSeating: true,
							sectionAndRows: true,
							tableAndChairs: true,
						},
					},
				},
			});

			// Step 2: Handle the case where no event is found.
			// If the query returns no data, set a 404 status and return a "Not Found" message.
			if (!event) {
				this.setStatus(404);
				return createActionResult<null>(false, null, 'NOT_FOUND', 'Event not found');
			}

			// Step 3(DEPRECATED): Validate the retrieved data against the Zod schema.
			// This is a critical step to ensure that the data from the database is in the expected format.
			// const parsed = EventSchema.safeParse(event);
			// if (!parsed.success) {
			// 	this.log.warn('Data validation failed:', parsed.error.format());
			// 	this.setStatus(500);
			// 	const validationError = parsed.error.issues
			// 		.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
			// 		.join(', ');
			// 	return createActionResult<null>(
			// 		false,
			// 		null,
			// 		'VALIDATION_ERROR',
			// 		`Failed to validate event data: ${validationError}`,
			// 	);
			// }

			// Step 4: Return a successful response with the validated data.
			// The `parsed.data` is guaranteed to be of type `EventDto` at this point.
			this.setStatus(200);
			return createActionResult(true, event, undefined, 'Event fetched successfully');
		} catch (error: any) {
			// Step 5: Catch and handle unexpected errors.
			// Log the full error for debugging purposes and return a generic server error to the client.
			this.log.error('Error fetching event by ID:', error);
			this.setStatus(500);
			return createActionResult<null>(
				false,
				null,
				'FETCH_EVENT_ERROR',
				'An unexpected error occurred while fetching the event.',
			);
		}
	}
}
