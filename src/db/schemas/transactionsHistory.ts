import { pgTable, boolean, pgEnum, text, uuid, varchar, index, numeric } from "drizzle-orm/pg-core";
import { user } from "./usersAndOrganiser";
import { timestamps } from "../helpers/timestamp";

export const transactionTypeEnum = pgEnum('transaction_type', [
    'credit', // Money added to the user's account
    'refund', // Money returned to the user
    'withdrawal', // Money withdrawn by the user, organiser or admin)
    'transfer', // Money transferred between users
    'fee', // Transaction fees charged to the user
    'reward', // Rewards or loyalty points added to the user's account
    'debit', // Money deducted from the user's account
    "event"
]);

export const transactionsHistory = pgTable('transactions_history', {
    id: uuid('id').primaryKey(),
    orderId: varchar('order_id').notNull(),
    userId: uuid('user_id').notNull().references(() => user.id),
    type: transactionTypeEnum('type').notNull(),
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull().default("0.00"),
    description: text('description').notNull(),
    isSuccessful: boolean('is_successful').default(true).notNull(),
    ...timestamps
}, (table => ({
    userIdIndex: index('idx_transactions_history_user_id').on(table.userId),
    orderIdIndex: index('idx_transactions_history_order_id').on(table.orderId),
})));