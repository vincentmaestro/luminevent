import {
	Controller,
	Route,
	Tags,
	Get,
	Post,
	Put,
	Delete,
	Path,
	Body,
	Security,
	SuccessResponse,
	Request,
} from 'tsoa';
import { eq, and } from 'drizzle-orm';
import { db as DB } from '../db'; // Assuming this is your Drizzle ORM instance
import schemas from '../db/schemas/index';
import { APIResponse } from '../types/response';

import {
	ApplyPromoCodeDTO,
	CreatePromoCodeDTO,
	CreateRefundPolicyDTO,
	CreateTicketSectionDTO,
	SelectRefundPolicyDTO,
	SelectTicketPromoCodeDTO,
	SelectTicketSectionDTO,
	UpdateRefundPolicyDTO,
	UpdateTicketSectionDTO,
} from '../types/tickets';
import {
	ApplyPromoCodeSchema,
	CreateRefundPolicySchema,
	CreateTicketSaleSchema,
	CreateTicketSectionSchema,
	UpdateRefundPolicySchema,
	UpdateTicketSectionSchema,
} from './helpers/zod/ticketSchema';
import { Utils } from '../utils/formatter';
import { createActionResult } from '../db/helpers/withPagination';
import logger, { Logger } from '../utils/logger';
import { BuyTicketsDto, TicketSale } from '../types/ticketSale';
import { AuthRequest } from '../types/express';

// =========================
// Main Controller
// =========================

@Route('events')
@Tags('Event-Tickets')
export class TicketController extends Controller {
	private log: Logger;

	constructor() {
		super();
		this.log = logger('[EVENT_TICKET_CONTROLLER]');
	}

	/**
	 * @summary Creates a new ticket section.
	 * @description This method validates the input and creates a new ticket section linked to a specific event seating map.
	 * @param eventSeatingId The ID of the event seating map to link the section to.
	 * @param body The data for the new ticket section.
	 * @returns The created ticket section record.
	 * @response 201 Ticket created successfully.
	 * @throws {400} Invalid event ID or request body.
	 * @throws {404} The specified event seating map was not found.
	 */
	@Post('{id}/tickets')
	@SuccessResponse('201', 'Ticket section created successfully')
	@Security('bearer', ['admin', 'staff', 'hoster'])
	public async createTicketSection(
		@Path() id: string,
		@Body() body: CreateTicketSectionDTO,
	): Promise<APIResponse<SelectTicketSectionDTO>> {
		try {
			// Step 1: Validate input data using Zod schema.
			const validatedInput = CreateTicketSectionSchema.safeParse(body);

			if (!validatedInput.success) {
				const resError = createActionResult<null>(
					false,
					null,
					'VALIDATION_ERROR',
					Utils.formatZodErrors(validatedInput.error.issues),
				);
				this.setStatus(400);
				return resError;
			}

			// Step 2: Ensure the event seating exists and assign the ID.
			const seatingExists = await DB.query.eventSeatMapping.findFirst({
				where: eq(schemas.eventSeatMapping.eventId, id),
			});
			if (!seatingExists) {
				const resError = createActionResult<null>(
					false,
					null,
					'EVENT_SEATING_NOT_FOUND',
					'Event seating ID not found.',
				);
				this.setStatus(404);
				return resError;
			}

			// Step 3: Use Drizzle to insert the new record.
			const [result] = await DB.insert(schemas.ticketSections)
				.values({
					...body,
					eventSeatingId: seatingExists.id,
				})
				.returning();

			this.setStatus(201);
			return createActionResult(true, result);
		} catch (error: any) {
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
	 * @summary Retrieves all ticket sections for a specific event.
	 * @description Fetches all ticket sections linked to a given event seating ID.
	 * @param id The ID of the event.
	 * @returns {SelectTicketSectionDTO[]} An array of ticket section records.
	 * @throws {404} If no sections are found.
	 */
	@Get('{id}/tickets')
	@SuccessResponse('200', 'Ticket sections fetched successfully')
	@Security('bearer', [])
	public async getTicketSections(
		@Path() id: string,
	): Promise<APIResponse<SelectTicketSectionDTO[] | null>> {
		try {
			// Step 1: Query Drizzle for all sections matching the eventSeatingId.
			// Check if seating of the requested type already exists for this event
			const existing = await DB.query.eventSeatMapping.findFirst({
				where: and(eq(schemas.eventSeatMapping.eventId, id)),
			});

			if (!existing) {
				this.setStatus(404);
				return createActionResult<null>(
					false,
					null,
					'SEATING_NOT_FOUND',
					`Seating map not found.`,
				);
			}
			const sections = await DB.query.ticketSections.findMany({
				where: eq(schemas.ticketSections.eventSeatingId, existing.id),
			});

			// Step 2: Handle cases where no records are found.
			if (sections.length === 0) {
				this.setStatus(404);
				return createActionResult<null>(
					false,
					null,
					'TICKET_SECTIONS_NOT_FOUND',
					'No ticket sections found for this seating map.',
				);
			}
			// Step 3: Return the results.
			return createActionResult(true, sections);
		} catch (error: any) {
			// Step 4: Handle any errors, including those from the transaction.
			this.log.error('fetching tickets section error:', error);
			const status = error.message.includes('not found') ? 404 : 500;
			this.setStatus(status);
			return createActionResult<null>(
				false,
				null,
				'FETCHING_TICKET_ERROR',
				error.message || 'Something went wrong.',
			);
		}
	}

	/**
	 * @summary Updates a specific ticket section.
	 * @description Allows for partial updates to a ticket section identified by its unique ID.
	 * @param id The ID of the event tied to the seating map.
	 * @param ticketId The ticketId of the ticket section to update.
	 * @param body The partial data to update.
	 * @returns The updated ticket section record.
	 * @throws {404} If the section is not found.
	 */
	@Put('{id}/tickets/{ticketId}')
	@SuccessResponse('200', 'Ticket section updated successfully')
	@Security('bearer', ['admin', 'staff', 'hoster'])
	public async updateTicketSection(
		@Path() id: string,
		@Path() ticketId: string,
		@Body() body: UpdateTicketSectionDTO,
	): Promise<APIResponse<SelectTicketSectionDTO>> {
		try {
			// Step 0: Verifiy the body and ids
			const normEventId = Utils.normalizeUuid(id);
			const normTicketId = Utils.normalizeUuid(ticketId);
			if (!normEventId || !normTicketId) {
				this.setStatus(400);
				return createActionResult<null>(false, null, 'INVALID_ID', 'ID is invalid.');
			}

			// Check if seating of the requested type already exists for this event
			const existing = await DB.query.eventSeatMapping.findFirst({
				where: and(eq(schemas.eventSeatMapping.eventId, id)),
			});

			if (!existing) {
				this.setStatus(404);
				return createActionResult<null>(
					false,
					null,
					'SEATING_NOT_FOUND',
					`Seating map not found.`,
				);
			}

			const validatedInput = UpdateTicketSectionSchema.safeParse(body);

			if (!validatedInput.success) {
				const resError = createActionResult<null>(
					false,
					null,
					'VALIDATION_ERROR',
					Utils.formatZodErrors(validatedInput.error.issues),
				);
				this.setStatus(400);
				return resError;
			}

			// Step 1: Check if the record exists.
			const existingSection = await DB.query.ticketSections.findFirst({
				where: eq(schemas.ticketSections.id, normTicketId),
			});
			if (!existingSection) {
				this.setStatus(404);
				return {
					success: false,
					data: null,
					message: 'Ticket section not found.',
					error: 'TICKET_SECTION_NOT_FOUND',
				};
			}

			// Step 2: Use Drizzle to update the record.
			const [result] = await DB.update(schemas.ticketSections)
				.set({ ...validatedInput.data })
				.where(eq(schemas.ticketSections.id, id))
				.returning();

			// Step 3: Return the updated record.
			return createActionResult(true, result);
		} catch (error: any) {
			// Step 4: Handle any errors, including those from the transaction.
			this.log.error('fetching tickets section error:', error);
			const status = error.message.includes('not found') ? 404 : 500;
			this.setStatus(status);
			return createActionResult<null>(
				false,
				null,
				'FETCHING_TICKET_ERROR',
				error.message || 'Something went wrong.',
			);
		}
	}

	/**
	 * @summary Deletes a specific ticket section.
	 * @description Deletes a ticket section and all associated promo codes, refunds, and sales (due to cascade deletes).
	 * @param id The ID of the ticket section to delete.
	 * @returns Confirmation of the deletion.
	 * @throws {404} If the section is not found.
	 */
	@Delete('{id}/tickets/{ticketId}')
	@SuccessResponse('200', 'Ticket section deleted successfully')
	@Security('bearer', ['admin', 'staff', 'hoster'])
	public async deleteTicketSection(
		@Path() id: string,
		@Path() ticketId: string,
	): Promise<APIResponse<null>> {
		try {
			// Step 0: Verifiy the body and ids
			const normEventId = Utils.normalizeUuid(id);
			const normTicketId = Utils.normalizeUuid(ticketId);
			if (!normEventId || !normTicketId) {
				this.setStatus(400);
				return createActionResult<null>(false, null, 'INVALID_ID', 'ID is invalid.');
			}

			// Check if seating of the requested type already exists for this event
			const existing = await DB.query.eventSeatMapping.findFirst({
				where: and(eq(schemas.eventSeatMapping.eventId, normEventId)),
			});

			if (!existing) {
				this.setStatus(404);
				return createActionResult<null>(
					false,
					null,
					'SEATING_NOT_FOUND',
					`Seating map not found.`,
				);
			}

			// Step 1: Check if the record exists before attempting to delete.
			const existingSection = await DB.query.ticketSections.findFirst({
				where: eq(schemas.ticketSections.id, normTicketId),
			});
			if (!existingSection) {
				this.setStatus(404);
				return {
					success: false,
					data: null,
					message: 'Ticket section not found.',
					error: 'TICKET_SECTION_NOT_FOUND',
				};
			}
			// Step 2: Use Drizzle to delete the record. Drizzle's `onDelete: 'cascade'` will handle related records.
			await DB.delete(schemas.ticketSections).where(
				eq(schemas.ticketSections.id, normTicketId),
			);
			// Step 3: Return success.
			return createActionResult(
				true,
				null,
				undefined,
				'Ticket section deleted successfully.',
			);
		} catch (error: any) {
			// Step 4: Handle any errors, including those from the transaction.
			this.log.error('fetching tickets section error:', error);
			const status = error.message.includes('not found') ? 404 : 500;
			this.setStatus(status);
			return createActionResult<null>(
				false,
				null,
				'FETCHING_TICKET_ERROR',
				error.message || 'Something went wrong.',
			);
		}
	}

	//
	// Promo Code Endpoints
	//

	/**
	 * @summary Creates a new promo code for a specific event.
	 * @param id The ID of the event to link the promo code to.
	 * @param body The data for the new promo code.
	 * @returns The created promo code record.
	 */
	@Post('{id}/promo-codes')
	@SuccessResponse('201', 'Promo code created successfully')
	@Security('bearer', ['admin', 'staff', 'hoster'])
	public async createPromoCode(
		@Path() id: string,
		@Body() body: CreatePromoCodeDTO,
	): Promise<APIResponse<SelectTicketPromoCodeDTO | null>> {
		try {
			const normEventId = Utils.normalizeUuid(id);
			if (!normEventId) {
				this.setStatus(400);
				return createActionResult<null>(false, null, 'INVALID_ID', 'ID is invalid.');
			}

			// Check if seating of the requested type already exists for this event
			const existing = await DB.query.events.findFirst({
				where: and(eq(schemas.events.id, normEventId)),
			});

			if (!existing) {
				this.setStatus(404);
				return createActionResult<null>(false, null, 'EVENT_NOT_FOUND', `Event not found.`);
			}

			// Step 2: Insert the new promo code, linking it to the ticket section.
			const [result] = await DB.insert(schemas.ticketPromoCodes)
				.values({ ...body, eventId: normEventId })
				.returning();

			if (!result) {
				throw new Error('Failed to create event promoCode.');
			}
			this.setStatus(201);
			return createActionResult(true, result);
		} catch (error: any) {
			// Step 4: Handle any errors, including those from the transaction.
			this.log.error('Creating promocode error:', error);
			const status = error.message.includes('not found') ? 404 : 500;
			this.setStatus(status);
			return createActionResult<null>(
				false,
				null,
				'CREATING_PROMOCODE_ERROR',
				error.message || 'Something went wrong.',
			);
		}
	}

	/**
	 * @summary Retrieves all promo codes for an event.
	 * @param id The ID of the event.
	 * @returns An array of promo code records.
	 */
	@Get('{id}/promo-codes')
	@SuccessResponse('200', 'Promo codes fetched successfully')
	@Security('bearer', [])
	public async getPromoCodesForSection(
		@Path() id: string,
	): Promise<APIResponse<SelectTicketPromoCodeDTO[]>> {
		try {
			const normEventId = Utils.normalizeUuid(id);
			if (!normEventId) {
				this.setStatus(400);
				return createActionResult<null>(false, null, 'INVALID_ID', 'ID is invalid.');
			}

			// Check if seating of the requested type already exists for this event
			const existing = await DB.query.events.findFirst({
				where: and(eq(schemas.events.id, normEventId)),
			});

			if (!existing) {
				this.setStatus(404);
				return createActionResult<null>(
					false,
					null,
					'EVENTS_NOT_FOUND',
					`Event not found.`,
				);
			}

			const promoCodes = await DB.query.ticketPromoCodes.findMany({
				where: eq(schemas.ticketPromoCodes.eventId, normEventId),
			});
			return createActionResult(true, promoCodes);
		} catch (error: any) {
			// Step 4: Handle any errors, including those from the transaction.
			this.log.error('fetching promo code error:', error);
			const status = error.message.includes('not found') ? 404 : 500;
			this.setStatus(status);
			return createActionResult<null>(
				false,
				null,
				'FETCHING_PROMOCODE_ERROR',
				error.message || 'Something went wrong.',
			);
		}
	}

	/**
	 * @summary Applies a promo code to an order.
	 * @param id The ID of the event containing the promo code.
	 * @param body The promo code to apply and the quantity to use.
	 * @returns The updated promo code record.
	 */
	@Post('{id}/promo-codes/apply')
	@SuccessResponse('200', 'Promo code applied successfully')
	@Security('bearer', [])
	public async applyPromoCode(
		@Path() id: string,
		@Body() body: ApplyPromoCodeDTO,
	): Promise<APIResponse<SelectTicketPromoCodeDTO | null>> {
		try {
			const normEventId = Utils.normalizeUuid(id);
			if (!normEventId) {
				this.setStatus(400);
				return createActionResult<null>(false, null, 'INVALID_ID', 'Event ID is invalid.');
			}

			const validatedInput = ApplyPromoCodeSchema.safeParse(body);

			if (!validatedInput.success) {
				const resError = createActionResult<null>(
					false,
					null,
					'VALIDATION_ERROR',
					Utils.formatZodErrors(validatedInput.error.issues),
				);
				this.setStatus(400);
				return resError;
			}

			const now = new Date();

			// Step 1: Use a database transaction to ensure atomicity.
			// This prevents race conditions where multiple users try to use the last available promo code.
			const updatedPromoCode = await DB.transaction(async (tx) => {
				// Step 2: Find the promo code for the event and lock the row for update.
				const promoCode = await tx.query.ticketPromoCodes.findFirst({
					where: and(
						eq(schemas.ticketPromoCodes.eventId, normEventId),
						eq(schemas.ticketPromoCodes.promotionCode, validatedInput.data.code),
					),
					// Assuming your DB library supports locking (e.g., `forUpdate`).
					// This is a critical step to prevent race conditions.
					// If your ORM doesn't support this, you'll need a different approach.
				});

				// Step 3: Validate the promo code's existence and quantity.
				if (!promoCode) {
					throw new Error('PROMO_CODE_NOT_FOUND');
				}

				if (promoCode.endDate <= now) {
					throw new Error('PROMO_EXPIRED');
				}

				return promoCode;
			});

			this.setStatus(200);
			return createActionResult(true, updatedPromoCode);
		} catch (error: any) {
			this.log.error('Applying promo code error:', error);
			let message = 'Something went wrong.';
			let errorCode = 'APPLY_PROMOCODE_ERROR';
			let status = 500;

			if (error.message === 'PROMO_CODE_NOT_FOUND') {
				status = 404;
				errorCode = 'PROMO_CODE_NOT_FOUND';
				message = 'Promo code not found for this event.';
			} else if (error.message === 'INSUFFICIENT_QUANTITY') {
				status = 409; // 409 Conflict
				errorCode = 'INSUFFICIENT_QUANTITY';
				message = 'Not enough promo code quantity available.';
			} else if (error.message.includes('invalid')) {
				status = 400;
				errorCode = 'INVALID_REQUEST';
				message = 'Invalid input provided.';
			}
			this.setStatus(status);
			return createActionResult<null>(false, null, errorCode, message);
		}
	}

	/**
	 * @summary Creates a new refund policy for a specific event.
	 * @description This method validates and creates a refund policy for an event.
	 * @param eventId The ID of the event to link the policy to.
	 * @param body The data for the new refund policy.
	 * @returns The created refund policy record.
	 */
	@Post('{eventId}/refund-policies')
	@SuccessResponse('201', 'Refund policy created successfully')
	@Security('bearer', ['admin', 'staff', 'hoster'])
	public async createRefundPolicy(
		@Path() eventId: string,
		@Body() body: CreateRefundPolicyDTO,
	): Promise<APIResponse<SelectRefundPolicyDTO | null>> {
		try {
			const normEventId = Utils.normalizeUuid(eventId);
			if (!normEventId) {
				this.setStatus(400);
				return createActionResult<null>(false, null, 'INVALID_ID', 'Event ID is invalid.');
			}

			// Check if the event exists.
			const eventExists = await DB.query.events.findFirst({
				where: eq(schemas.events.id, normEventId),
			});
			if (!eventExists) {
				this.setStatus(404);
				return createActionResult(false, null, 'EVENT_NOT_FOUND', 'Event not found.');
			}

			// Step 1: Validate input data using a Zod schema.
			const validatedInput = CreateRefundPolicySchema.safeParse(body);
			if (!validatedInput.success) {
				this.setStatus(400);
				return createActionResult(
					false,
					null,
					'VALIDATION_ERROR',
					Utils.formatZodErrors(validatedInput.error.issues),
				);
			}

			// Step 2: Insert the new refund policy.
			const [result] = await DB.insert(schemas.ticketRefundPolicy)
				.values({ ...validatedInput.data, eventId: normEventId })
				.returning();

			this.setStatus(201);
			return createActionResult(true, result);
		} catch (error: any) {
			this.log.error('createRefundPolicy error:', error);
			this.setStatus(500);
			return createActionResult(
				false,
				null,
				'CREATE_REFUND_POLICY_ERROR',
				error.message || 'Something went wrong.',
			);
		}
	}

	/**
	 * @summary Updates an existing refund policy.
	 * @description This method updates a refund policy for an event.
	 * @param eventId The ID of the event.
	 * @param policyId The ID of the refund policy to update.
	 * @param body The partial data to update.
	 * @returns The updated refund policy record.
	 */
	@Put('{eventId}/refund-policies/{policyId}')
	@SuccessResponse('200', 'Refund policy updated successfully')
	@Security('bearer', ['admin', 'staff', 'hoster'])
	public async updateRefundPolicy(
		@Path() eventId: string,
		@Path() policyId: string,
		@Body() body: UpdateRefundPolicyDTO,
	): Promise<APIResponse<SelectRefundPolicyDTO | null>> {
		try {
			const normEventId = Utils.normalizeUuid(eventId);
			const normPolicyId = Utils.normalizeUuid(policyId);
			if (!normEventId || !normPolicyId) {
				this.setStatus(400);
				return createActionResult(false, null, 'INVALID_ID', 'IDs are invalid.');
			}

			// Step 1: Check if the refund policy exists.
			const existingPolicy = await DB.query.ticketRefundPolicy.findFirst({
				where: and(
					eq(schemas.ticketRefundPolicy.id, normPolicyId),
					eq(schemas.ticketRefundPolicy.eventId, normEventId),
				),
			});
			if (!existingPolicy) {
				this.setStatus(404);
				return createActionResult(
					false,
					null,
					'REFUND_POLICY_NOT_FOUND',
					'Refund policy not found.',
				);
			}

			// Step 2: Validate the input.
			const validatedInput = UpdateRefundPolicySchema.safeParse(body);
			if (!validatedInput.success) {
				this.setStatus(400);
				return createActionResult(
					false,
					null,
					'VALIDATION_ERROR',
					Utils.formatZodErrors(validatedInput.error.issues),
				);
			}

			// Step 3: Update the record.
			const [result] = await DB.update(schemas.ticketRefundPolicy)
				.set(validatedInput.data)
				.where(eq(schemas.ticketRefundPolicy.id, normPolicyId))
				.returning();

			this.setStatus(200);
			return createActionResult(true, result);
		} catch (error: any) {
			this.log.error('updateRefundPolicy error:', error);
			this.setStatus(500);
			return createActionResult(
				false,
				null,
				'UPDATE_REFUND_POLICY_ERROR',
				error.message || 'Something went wrong.',
			);
		}
	}

	/**
	 * @summary Buys tickets for an event.
	 * @description This method handles the purchase of tickets, checks for availability, applies promo codes, triggers a payment process, and records the sale.
	 * @param eventId The ID of the event.
	 * @param body The purchase details, including ticket section, seats or table, quantity, and optional promo code.
	 * @returns The details of the successful ticket sale.
	 */
	@Post('{eventId}/buy-tickets')
	@SuccessResponse('201', 'Tickets purchased successfully')
	@Security('bearer', []) // Or an appropriate security level
	public async buyTickets(
		@Path() eventId: string,
		@Body() body: BuyTicketsDto,
		@Request() req: AuthRequest,
	): Promise<APIResponse<TicketSale | null>> {
		try {
			// Validate input using CreateTicketSaleSchema
			const parsedBody = CreateTicketSaleSchema.safeParse(body);
			if (!parsedBody.success) {
				this.setStatus(400);
				const msg = Utils.formatZodErrors(parsedBody.error.issues);
				return createActionResult(false, null, 'INVALID_INPUT', msg);
			}

			const { ticketSectionId, seatsOrTablePurchased, quantity, promoCode } = parsedBody.data;
			const userId = req.activeUser!.id; // Assuming user ID from request context

			const normEventId = Utils.normalizeUuid(eventId);
			const normTicketId = Utils.normalizeUuid(ticketSectionId ?? '');

			if (!normEventId || !normTicketId) {
				this.setStatus(400);
				return createActionResult(false, null, 'INVALID_ID', 'IDs are invalid.');
			}

			// Drizzle transaction to ensure atomicity
			const result = await DB.transaction(async (tx) => {
				// Step 1: Check if the ticket section exists
				const ticketSection = await tx.query.ticketSections.findFirst({
					where: eq(schemas.ticketSections.id, normTicketId),
				});

				if (!ticketSection) {
					this.setStatus(404);
					return createActionResult(
						false,
						null,
						'TICKET_SECTION_NOT_FOUND',
						'Ticket section not found.',
					);
				}

				// Validate seatsOrTablePurchased against ticket section's seating type
				const isTablePurchase =
					'type' in seatsOrTablePurchased && seatsOrTablePurchased.type === 'table';
				if (
					(isTablePurchase && ticketSection.selectedSeatingType !== 'table_n_chairs') ||
					(!isTablePurchase && ticketSection.selectedSeatingType === 'table_n_chairs')
				) {
					this.setStatus(400);
					return createActionResult(
						false,
						null,
						'INVALID_SEATING_TYPE',
						'Seating type does not match ticket section configuration.',
					);
				}

				// Check ticket availability (allow unlimited if availableTickets is 0)
				if (
					ticketSection.availableTickets !== 0 &&
					ticketSection.availableTickets < quantity
				) {
					this.setStatus(400);
					return createActionResult(
						false,
						null,
						'TICKET_UNAVAILABLE',
						'Not enough tickets available.',
					);
				}

				// Step 2: Calculate the final price
				let finalPrice = Number(ticketSection.price) * quantity;
				if (promoCode) {
					const promo = await tx.query.ticketPromoCodes.findFirst({
						where: and(
							eq(schemas.ticketPromoCodes.eventId, normEventId),
							eq(schemas.ticketPromoCodes.promotionCode, promoCode),
						),
					});

					if (promo) {
						if (promo.promotionType === 'percentage_off') {
							finalPrice -= finalPrice * (+(promo.promoValue) / 100);
						} else if (promo.promotionType === 'fixed_amount_off') {
							finalPrice -= +promo.promoValue;
						}
						finalPrice = Math.max(0, Number(finalPrice.toFixed(2)));
					}
				}

				// Step 3: Simulate payment process
				this.log.info(`Simulating payment of ${finalPrice} for user ${userId}`);
				const paymentSuccess = true; // Placeholder for payment gateway response
				if (!paymentSuccess) {
					throw new Error('Payment failed.');
				}

				// Step 4: Decrement available ticket count (skip if unlimited tickets)
				if (ticketSection.availableTickets !== 0) {
					await tx
						.update(schemas.ticketSections)
						.set({ availableTickets: ticketSection.availableTickets - quantity })
						.where(eq(schemas.ticketSections.id, normTicketId));
				}

				// Step 5: Create a new ticket sale record
				const [newSale] = await tx
					.insert(schemas.ticketSales)
					.values({
						ticketSectionId: normTicketId,
						seatsOrTablePurchased,
						userId,
						quantity,
						totalAmount: finalPrice.toFixed(2),
						purchaseDate: parsedBody.data.purchaseDate ?? new Date(),
					})
					.returning();

				// Step 6: Return the new sale record
				return createActionResult(
					true,
					newSale,
					undefined,
					'Tickets purchased successfully.',
				);
			});

			this.setStatus(201);
			return result;
		} catch (error: any) {
			this.log.error('buyTickets error:', error);
			const status = error.message.includes('not enough') ? 400 : 500;
			this.setStatus(status);
			return createActionResult(
				false,
				null,
				'TICKET_PURCHASE_ERROR',
				error.message || 'Something went wrong.',
			);
		}
	}
}
