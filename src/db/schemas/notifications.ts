import { user } from './usersAndOrganiser';
import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, boolean, pgEnum, index, numeric } from 'drizzle-orm/pg-core';
import { timestamps } from '../helpers/timestamp';

export const notificationTypeEnum = pgEnum('notification_type', [
    'event_update',
    'ticket_purchase',
    'reminder',
    'general',
]);

export const notifications = pgTable('notifications', {
    id: uuid().defaultRandom().primaryKey(), // Unique ID for the notification
    userId: uuid().notNull().references(() => user.id, { onDelete: 'cascade' }), // User this notification belongs to
    type: notificationTypeEnum('type').notNull(), // Type of notification (event update, ticket purchase, etc.)
    title: text().notNull(), // Notification title
    amount: numeric('amount', { precision: 10, scale: 2 }).default("0.00"), // Amount related to the notification (if applicable)
    message: text().notNull(), // Notification message content
    isRead: boolean().default(false), // Whether the notification has been read
    ...timestamps
}, (table) => ({
    userIdIndex: index('idx_notifications_user_id').on(table.userId), // Index for userId for faster lookups
}));

// ------------------- Relationships -------------------
export const notificationsRelations = relations(notifications, ({ one }) => ({
    // A notification belongs to one user
    user: one(user, {
        fields: [notifications.userId],
        references: [user.id],
    }),
}));

// ------------------ Types -------------------
export type NotificationType = 'event_update' | 'ticket_purchase' | 'reminder' | 'general';
export type Notification = {
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: Date;
    updatedAt: Date;
};
export type NotificationCreateInput = Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>;
export type NotificationUpdateInput = Partial<Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>>;
