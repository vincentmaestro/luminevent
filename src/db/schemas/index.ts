import {
	userRoleEnum,
	preferenceEnum,
	user,
	account,
	passkey,
	session,
	userSettings,
	verification,

	// Organisers
	socialPlatformEnum,
	schedulePayoutEnum,
	payoutHistoryStatusEnum,
	organiser,
	organiserPayoutHistory,
	organiserSocialAccounts,
	organizerPayoutAccount,
	organiserRelations,
	organiserPayoutHistoryRelations,
	organiserSocialAccountsRelations,
	organizerPayoutAccountRelations,

	// Reltionships
	usersRelations,
	userSettingsRelations,
	sessionsRelations,
	accountsRelations,
	passkeysRelations,
	organiserWallet,
	organiserWalletRelations,
} from './usersAndOrganiser';
import {
	eventStatusEnum,
	events,
	eventsRelations,
	eventCategory,
	eventCategoryRelations,
	eventTags,
	eventToTags,
	eventContact,
	eventRecurranceDetail,
	eventRecurranceDetailRelations,
	eventContactRelations,
} from './events';
import {
	seatingTypeEnum,
	eventSeatMapping,
	seatingMapRelations,
	sectionAndRowsRelations,
	tableAndChairsRelations,
	mixedSeatingRelations,
	sectionAndRowsSeating,
	tableAndChairsSeating,
	mixedSeating,
} from './eventSeatings';
import {
	ticketPromoCodes,
	ticketRefundPolicy,
	ticketSales,
	ticketSalesRelations,
	ticketSections,
	ticketSectionsRelations,
} from './eventTickets';

import { notificationTypeEnum, notifications, notificationsRelations } from './notifications';

export default {
	// User Schemas
	userRoleEnum,
	preferenceEnum,
	user,
	userSettings,
	account,
	passkey,
	session,
	verification,
	socialPlatformEnum,
	schedulePayoutEnum,
	payoutHistoryStatusEnum,
	organiser,
	organiserWallet,
	organiserPayoutHistory,
	organiserSocialAccounts,
	organizerPayoutAccount,

	// notifications
	notificationTypeEnum,
	notifications,

	// Event Schemas
	eventStatusEnum,
	events,
	eventTags,
	eventToTags,
	eventCategory,
	eventRecurranceDetail,
	eventContact,
	seatingTypeEnum,
	eventSeatMapping,
	sectionAndRowsSeating,
	tableAndChairsSeating,
	mixedSeating,

	// Ticket Schemas
	ticketSections,
	ticketSales,
	ticketPromoCodes,
	ticketRefundPolicy,

	// Relationships
	ticketSectionsRelations,
	ticketSalesRelations,
	organiserRelations,
	organiserWalletRelations,
	organiserPayoutHistoryRelations,
	organiserSocialAccountsRelations,
	organizerPayoutAccountRelations,
	usersRelations,
	eventsRelations,
	eventRecurranceDetailRelations,
	eventContactRelations,
	eventCategoryRelations,
	seatingMapRelations,
	sectionAndRowsRelations,
	notificationsRelations,
	tableAndChairsRelations,
	mixedSeatingRelations,
	userSettingsRelations,
	sessionsRelations,
	accountsRelations,
	passkeysRelations,
};
