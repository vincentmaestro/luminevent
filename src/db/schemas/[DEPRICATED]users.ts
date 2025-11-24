// // @ts-ignore
// import { index, jsonb, numeric, pgEnum, uuid, varchar } from 'drizzle-orm/pg-core';
// import { pgTable, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core';
// import { relations } from 'drizzle-orm/relations';

// export const userRoleEnum = pgEnum('user_role', ['admin', 'staff', 'hoster', 'user']);

// export const socialPlatformEnum = pgEnum('social_platform', [
// 	'facebook',
// 	'twitterX',
// 	'tiktok',
// 	'youtube',
// 	'instagram',
// 	'linkedin',
// ]);

// export const preferenceEnum = pgEnum('preference', ['light', 'dark', 'system']);

// export const schedulePayoutEnum = pgEnum('schedule_payout', ['weekly', 'monthly']);

// export const payoutHistoryStatusEnum = pgEnum('payout_history_status', [
// 	'pending',
// 	'completed',
// 	'failed',
// 	'reversed',
// ]);

// export const user = pgTable(
// 	'user',
// 	{
// 		id: uuid().defaultRandom().primaryKey(),
// 		name: text('name').notNull(),
// 		email: text('email').notNull().unique(),
// 		emailVerified: boolean('email_verified')
// 			.$defaultFn(() => false)
// 			.notNull(),
// 		image: text('image'),
// 		role: userRoleEnum('role')
// 			.$defaultFn(() => 'user')
// 			.notNull(),
// 		banned: boolean('banned').default(false),
// 		lastLogin: timestamp('last_login')
// 			.$defaultFn(() => /* @__PURE__ */ new Date())
// 			.notNull(),
// 		createdAt: timestamp('created_at')
// 			.$defaultFn(() => /* @__PURE__ */ new Date())
// 			.notNull(),
// 		updatedAt: timestamp('updated_at')
// 			.$defaultFn(() => /* @__PURE__ */ new Date())
// 			.notNull(),
// 	},
// 	(table) => [
// 		index('user_email_idx').on(table.email),
// 		index('user_last_login_idx').on(table.lastLogin),
// 		index('user_created_at_idx').on(table.createdAt),
// 	],
// );

// export const session = pgTable(
// 	'session',
// 	{
// 		id: uuid().defaultRandom().primaryKey(),
// 		expiresAt: timestamp('expires_at').notNull(),
// 		token: text('token').notNull().unique(),
// 		createdAt: timestamp('created_at').notNull(),
// 		updatedAt: timestamp('updated_at').notNull(),
// 		ipAddress: text('ip_address'),
// 		userAgent: text('user_agent'),
// 		userId: text('user_id')
// 			.notNull()
// 			.references(() => user.id, { onDelete: 'cascade' }),
// 	},
// 	(table) => [
// 		index('session_user_id_idx').on(table.userId),
// 		index('session_token_idx').on(table.token),
// 	],
// );

// export const account = pgTable(
// 	'account',
// 	{
// 		id: uuid().defaultRandom().primaryKey(),
// 		accountId: text('account_id').notNull(),
// 		providerId: text('provider_id').notNull(),
// 		userId: text('user_id')
// 			.notNull()
// 			.references(() => user.id, { onDelete: 'cascade' }),
// 		accessToken: text('access_token'),
// 		refreshToken: text('refresh_token'),
// 		idToken: text('id_token'),
// 		accessTokenExpiresAt: timestamp('access_token_expires_at'),
// 		refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
// 		scope: text('scope'),
// 		password: text('password'),
// 		createdAt: timestamp('created_at').notNull(),
// 		updatedAt: timestamp('updated_at').notNull(),
// 	},
// 	(table) => [
// 		index('account_user_id_idx').on(table.userId),
// 		index('account_provider_id_idx').on(table.providerId),
// 	],
// );

// export const verification = pgTable(
// 	'verification',
// 	{
// 		id: uuid().defaultRandom().primaryKey(),
// 		identifier: text('identifier').notNull(),
// 		value: text('value').notNull(),
// 		expiresAt: timestamp('expires_at').notNull(),
// 		createdAt: timestamp('created_at').$defaultFn(() => /* @__PURE__ */ new Date()),
// 		updatedAt: timestamp('updated_at').$defaultFn(() => /* @__PURE__ */ new Date()),
// 	},
// 	(table) => [index('verification_identifier_idx').on(table.identifier)],
// );

// export const passkey = pgTable(
// 	'passkey',
// 	{
// 		id: uuid().defaultRandom().primaryKey(),
// 		name: text('name'),
// 		publicKey: text('public_key').notNull(),
// 		userId: text('user_id')
// 			.notNull()
// 			.references(() => user.id, { onDelete: 'cascade' }),
// 		credentialID: text('credential_i_d').notNull(),
// 		counter: integer('counter').notNull(),
// 		deviceType: text('device_type').notNull(),
// 		backedUp: boolean('backed_up').notNull(),
// 		transports: text('transports'),
// 		createdAt: timestamp('created_at'),
// 		aaguid: text('aaguid'),
// 	},
// 	(table) => [index('passkey_user_id_idx').on(table.userId)],
// );

// export const organiser = pgTable(
// 	'organiser',
// 	{
// 		id: uuid().defaultRandom().primaryKey(),
// 		phoneNumber: text('phone_number').notNull(),
// 		phoneNumberVerified: boolean('phone_number_verified')
// 			.$defaultFn(() => false)
// 			.notNull(),
// 		address: text('address'),
// 		logo: text('logo'),
// 		bio: text('bio'),
// 		website: text('website'),
// 		email: text('email').notNull(),
// 		organisationName: text('organisation_name').notNull(),
// 		userId: text('user_id')
// 			.notNull()
// 			.references(() => user.id, { onDelete: 'cascade' }),
// 		createdAt: timestamp('created_at')
// 			.$defaultFn(() => /* @__PURE__ */ new Date())
// 			.notNull(),
// 		updatedAt: timestamp('updated_at')
// 			.$defaultFn(() => /* @__PURE__ */ new Date())
// 			.notNull(),
// 	},
// 	(table) => [
// 		index('organiser_user_id_idx').on(table.userId),
// 		index('organiser_name_idx').on(table.organisationName),
// 		index('organiser_email_idx').on(table.email),
// 		index('organiser_phone_number_idx').on(table.phoneNumber),
// 		index('organiser_organisation_name_idx').on(table.organisationName),
// 		index('organiser_created_at_idx').on(table.createdAt),
// 	],
// );

// export const organiserSocialAccounts = pgTable(
// 	'organiser_social_accounts',
// 	{
// 		id: uuid().defaultRandom().primaryKey(),
// 		platform: socialPlatformEnum('platform').notNull(),
// 		url: text('url').notNull(),
// 		organiserId: text('organiser_id')
// 			.notNull()
// 			.references(() => organiser.id, { onDelete: 'cascade' }),
// 		createdAt: timestamp('created_at')
// 			.$defaultFn(() => /* @__PURE__ */ new Date())
// 			.notNull(),
// 		updatedAt: timestamp('updated_at')
// 			.$defaultFn(() => /* @__PURE__ */ new Date())
// 			.notNull(),
// 	},
// 	(table) => [
// 		index('organiser_social_accounts_organiser_id_idx').on(table.organiserId),
// 		index('organiser_social_accounts_platform_idx').on(table.platform),
// 		index('organiser_social_accounts_created_at_idx').on(table.createdAt),
// 	],
// );

// export const userSettings = pgTable(
// 	'user_settings',
// 	{
// 		id: uuid().defaultRandom().primaryKey(),
// 		userId: text('user_id')
// 			.notNull()
// 			.references(() => user.id, { onDelete: 'cascade' }),
// 		notification: jsonb('notification')
// 			.$defaultFn(() =>
// 				JSON.stringify({
// 					email: { enabled: true, marketing: false, securityAlerts: true },
// 					sms: { enabled: false, promotions: false },
// 					whatsapp: { enabled: false, updates: true },
// 					push: { enabled: true, reminders: true, alerts: false },
// 					telegram: { enabled: true, alerts: true, updates: false },
// 				}),
// 			)
// 			.notNull(),
// 		preference: preferenceEnum('preference')
// 			.$defaultFn(() => 'system')
// 			.notNull(),
// 		createdAt: timestamp('created_at')
// 			.$defaultFn(() => /* @__PURE__ */ new Date())
// 			.notNull(),
// 		updatedAt: timestamp('updated_at')
// 			.$defaultFn(() => /* @__PURE__ */ new Date())
// 			.notNull(),
// 	},
// 	(table) => [
// 		index('user_settings_user_id_idx').on(table.userId),
// 		index('user_settings_preference_idx').on(table.preference),
// 		index('user_settings_created_at_idx').on(table.createdAt),
// 	],
// );

// export const organizerPayoutAccount = pgTable(
// 	'organizer_payout_account',
// 	{
// 		id: uuid().defaultRandom().primaryKey(),
// 		userId: text('user_id')
// 			.notNull()
// 			.references(() => user.id, { onDelete: 'cascade' }),
// 		bankName: text('bank_name').notNull(), // e.g., "Bank of America"
// 		bankAccountName: text('account_name').notNull(), // e.g., "John Doe"
// 		bankAccountNumber: text('account_number').notNull(), // e.g., "1234567890"
// 		bankRoutingNumber: text('routing_number').notNull(),
// 		schedulePayout: schedulePayoutEnum('schedule_payout')
// 			.$defaultFn(() => 'monthly')
// 			.notNull(),
// 		createdAt: timestamp('created_at')
// 			.$defaultFn(() => /* @__PURE__ */ new Date())
// 			.notNull(),
// 		updatedAt: timestamp('updated_at')
// 			.$defaultFn(() => /* @__PURE__ */ new Date())
// 			.notNull(),
// 	},
// 	(table) => [
// 		index('organizer_payout_account_user_id_idx').on(table.userId),
// 		index('organizer_payout_account_bank_name_idx').on(table.bankName),
// 		index('organizer_payout_account_bank_account_name_idx').on(table.bankAccountName),
// 		index('organizer_payout_account_bank_account_number_idx').on(table.bankAccountNumber),
// 		index('organizer_payout_account_created_at_idx').on(table.createdAt),
// 	],
// );

// export const organiserPayoutHistory = pgTable(
// 	'organiser_payout_history',
// 	{
// 		id: uuid().defaultRandom().primaryKey(),
// 		organiserId: text('organiser_id')
// 			.notNull()
// 			.references(() => organiser.id, { onDelete: 'cascade' }),
// 		status: payoutHistoryStatusEnum('status').$default(() => 'pending'), // Amount in cents or smallest currency unit
// 		amount: numeric('currency').default('0').notNull(), // Amount in cents or smallest currency unit
// 		transactionId: text('transaction_id').notNull().unique(), // Unique identifier for the payout transaction
// 		createdAt: timestamp('created_at')
// 			.$defaultFn(() => /* @__PURE__ */ new Date())
// 			.notNull(),
// 		updatedAt: timestamp('updated_at')
// 			.$defaultFn(() => /* @__PURE__ */ new Date())
// 			.notNull(),
// 	},
// 	(table) => [
// 		index('organiser_payout_history_amount_idx').on(table.amount),
// 		index('organiser_payout_history_status_idx').on(table.status),
// 		index('organiser_payout_history_transaction_id_idx').on(table.transactionId),
// 		index('organiser_payout_history_created_at_idx').on(table.createdAt),
// 		index('organiser_payout_history_updated_at_idx').on(table.updatedAt),
// 	],
// );

// // Define relations for the users table here
// export const usersRelations = relations(user, ({ one, many }) => ({
// 	// A user can have many sessions
// 	sessions: many(session),
// 	// A user can have many accounts (e.g., Google, GitHub, email/password)
// 	accounts: many(account),
// 	// A user can have many passkeys
// 	passkeys: many(passkey),

// 	organiser: one(organiser, {
// 		fields: [user.id],
// 		references: [organiser.userId],
// 	}),
// 	userSettings: one(userSettings, {
// 		fields: [user.id],
// 		references: [userSettings.userId],
// 	}),
// 	organizerPayoutAccount: one(organizerPayoutAccount, {
// 		fields: [user.id],
// 		references: [organizerPayoutAccount.userId],
// 	}),
// }));

// // Define Organisers relatoinships here
// export const organiserRelations = relations(organiser, ({ one, many }) => ({
// 	user: one(user, {
// 		fields: [organiser.userId],
// 		references: [user.id],
// 	}),
// 	socialAccounts: many(organiserSocialAccounts),
// 	payoutHistory: many(organiserPayoutHistory),
// }));

// // Relations for organiser_social_accounts table
// export const organiserSocialAccountsRelations = relations(organiserSocialAccounts, ({ one }) => ({
// 	organiser: one(organiser, {
// 		fields: [organiserSocialAccounts.organiserId],
// 		references: [organiser.id],
// 	}),
// }));

// // Relations for userSettings table
// export const userSettingsRelations = relations(userSettings, ({ one }) => ({
// 	user: one(user, {
// 		fields: [userSettings.userId],
// 		references: [user.id],
// 	}),
// }));

// // Relations for organizer_payout_account table
// export const organizerPayoutAccountRelations = relations(organizerPayoutAccount, ({ one }) => ({
// 	user: one(user, {
// 		fields: [organizerPayoutAccount.userId],
// 		references: [user.id],
// 	}),
// }));

// // Relations for organiser_payout_history table
// export const organiserPayoutHistoryRelations = relations(organiserPayoutHistory, ({ one }) => ({
// 	organiser: one(organiser, {
// 		fields: [organiserPayoutHistory.organiserId],
// 		references: [organiser.id],
// 	}),
// }));

// // Define relations for the session table
// export const sessionsRelations = relations(session, ({ one }) => ({
// 	// A session belongs to one user
// 	user: one(user, {
// 		fields: [session.userId],
// 		references: [user.id],
// 	}),
// }));

// // Define relations for the account table
// export const accountsRelations = relations(account, ({ one }) => ({
// 	// An account belongs to one user
// 	user: one(user, {
// 		fields: [account.userId],
// 		references: [user.id],
// 	}),
// }));

// // Define relations for the passkey table
// export const passkeysRelations = relations(passkey, ({ one }) => ({
// 	// A passkey belongs to one user
// 	user: one(user, {
// 		fields: [passkey.userId],
// 		references: [user.id],
// 	}),
// }));

// export type UserRole = typeof userRoleEnum.enumValues;
// export type User = typeof user.$inferSelect;
// export type AddUser = typeof user.$inferInsert;
// export type UpdateUser = Partial<AddUser>;
// export type Session = typeof session.$inferSelect;
// export type Account = typeof account.$inferSelect;
// export type Verification = typeof verification.$inferSelect;
// export type Passkey = typeof passkey.$inferSelect;
// export type AddPasskey = typeof passkey.$inferInsert;
// export type UpdatePasskey = Partial<AddPasskey>;
// export type Organiser = typeof organiser.$inferSelect;
// export type AddOrganiser = typeof organiser.$inferInsert;
// export type UpdateOrganiser = Partial<AddOrganiser>;
// export type OrganiserSocialAccount = typeof organiserSocialAccounts.$inferSelect;
// export type AddOrganiserSocialAccount = typeof organiserSocialAccounts.$inferInsert;
// export type UpdateOrganiserSocialAccount = Partial<AddOrganiserSocialAccount>;
// export type UserSettings = typeof userSettings.$inferSelect;
// export type AddUserSettings = typeof userSettings.$inferInsert;
// export type UpdateUserSettings = Partial<AddUserSettings>;
// export type OrganizerPayoutAccount = typeof organizerPayoutAccount.$inferSelect;
// export type AddOrganizerPayoutAccount = typeof organizerPayoutAccount.$inferInsert;
// export type UpdateOrganizerPayoutAccount = Partial<AddOrganizerPayoutAccount>;
// export type OrganiserPayoutHistory = typeof organiserPayoutHistory.$inferSelect;
// export type AddOrganiserPayoutHistory = typeof organiserPayoutHistory.$inferInsert;
// export type UpdateOrganiserPayoutHistory = Partial<AddOrganiserPayoutHistory>;
