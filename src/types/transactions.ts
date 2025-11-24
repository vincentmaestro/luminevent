/**
 * @summary Type for creating a new transaction history record.
 * @description Fields required for a new transaction.
 */
export interface CreateTransactionDTO {
	orderId: string;
	userId: string;
	type: 'credit' | 'refund' | 'withdrawal' | 'transfer' | 'fee' | 'reward' | 'debit' | 'event';
	amount: string;
	description: string;
	isSuccessful: boolean;
}

/**
 * @summary Type for updating an existing transaction history record.
 * @description All fields are optional to allow for partial updates.
 */
export interface UpdateTransactionDTO extends Partial<CreateTransactionDTO> {}

/**
 * @summary Type for fetching a transaction history record.
 * @description Matches the structure of the database record.
 */
export interface TransactionHistory {
	id: string;
	orderId: string;
	userId: string;
	type: 'credit' | 'refund' | 'withdrawal' | 'transfer' | 'fee' | 'reward' | 'debit' | 'event';
	amount: string;
	description: string;
	isSuccessful: boolean;
	createdAt: Date;
	updatedAt: Date;
}
