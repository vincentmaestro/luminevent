export interface LoginUserInputBody {
	email: string;
	password: string;
}

export interface User {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	image: string | null;
	role: 'user' | 'admin' | 'staff' | 'hoster';
	banned: boolean | null;
	customerCode: string | null
	lastLogin: Date;
	createdAt: Date;
	updatedAt: Date;
}

export interface NotificationSettings {
	email?: { enabled: boolean; marketing: boolean; securityAlerts: boolean };
	sms?: { enabled: boolean; promotions: boolean };
	whatsapp?: { enabled: boolean; updates: boolean };
	push?: { enabled: boolean; reminders: boolean; alerts: boolean };
	telegram?: { enabled: boolean; alerts: boolean; updates: boolean };
}

export interface UserSettings {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	userId: string;
	notification: unknown;
	preference: 'system' | 'dark' | 'light';
}

export interface UserSettingsInputBody {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	userId: string;
	notification: NotificationSettings;
	preference: 'system' | 'dark' | 'light';
}

export interface UpdateUserSettingsInputBody {
	userId?: string | undefined;
	notification?: NotificationSettings | unknown;
	preferences?: 'system' | 'dark' | 'light';
}

export interface OrganiserWallet {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	organiserId: string;
	grossRevenue: string;
	payoutBalance: string;
}

export interface Organiser {
	id: string;
	phoneNumber: string;
	phoneNumberVerified: boolean;
	address: string | null;
	logo: string | null;
	bio: string | null;
	website: string | null;
	email: string;
	organisationName: string;
	userId: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface EmailVericationBodyInput {
	token: string;
}

export interface RequestResetTokenInput {
	email: string;
}

export interface ResetPasswordInputBody {
	token: string;
	newPassword: string;
	confirmNewPassword: string;
}

export interface CreateUserInputBody {
	email: string;
	password: string;
	name: string;
	role?: 'admin' | 'staff' | 'hoster' | 'user';
	image?: string | undefined;
}

export interface OrganizerPayoutAccount {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	userId: string;
	bvn: string | null;
	bankName: string;
	paystackSubAccountCode: string;
	bankAccountName: string;
	bankAccountNumber: string;
	bankRoutingNumber: string | null;
	verified: boolean | null;
	schedulePayout: 'weekly' | 'monthly';
}

// Enum for schedule payout, matching the database schema
export type SchedulePayout = 'daily' | 'weekly' | 'monthly';

/**
 * @description Data transfer object for creating an organizer payout account.
 */
export interface CreateOrganizerPayoutAccountDTO {
    bankName: string;
    bankAccountName: string;
    bankAccountNumber: string;
	bvn?: string;
    bankRoutingNumber?: string;
    schedulePayout: SchedulePayout;
}

/**
 * @description Data transfer object for updating an organizer payout account.
 * All fields are optional to allow partial updates.
 */
export interface UpdateOrganizerPayoutAccountDTO {
    bankName?: string;
    bankAccountName?: string;
	bvn?: string;
    bankAccountNumber?: string;
    bankRoutingNumber?: string;
    schedulePayout?: SchedulePayout;
}

export interface AccountOutput {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	userId: string;
	providerId: string;
}

export interface UserWithRelationship extends User {
	userSettings?: UserSettings;
	organiser?: Organiser;
	accounts?: AccountOutput[];
	organizerPayoutAccount?: OrganizerPayoutAccount;
}

export interface OrganiserWithRelationship extends User {
	userSettings?: UserSettings;
	organiser: Organiser;
	wallet: OrganiserWallet;
	organizerPayoutAccount?: OrganizerPayoutAccount;
}

export interface GetSSOAccounts {
	id: string;
	providerId: string;
	accountId: string;
	userId: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface OrganiserSocialAccount {
	id: string;
	platform: 'facebook' | 'twitterX' | 'tiktok' | 'youtube' | 'instagram' | 'linkedin';
	url: string;
	createdAt: Date;
	updatedAt: Date;
	organiserId: string;
}

export interface UpdateUserInputBody {
	image?: string | undefined;
	role?: 'user' | 'admin' | 'staff' | 'hoster' | undefined;
	banned?: boolean | undefined;
	emailVerified?: boolean | undefined;
	lastLogin?: Date | undefined;
	createdAt?: Date | undefined;
	updatedAt?: Date | undefined;
}

export interface CreateOrganiserInputBody {
	email: string;
	password: string;
	organisationName: string;
	phoneNumber?: string;
	phoneNumberVerified?: boolean;
	address?: {
		street?: string | undefined;
		city?: string | undefined;
		state?: string | undefined;
		postalCode?: string | undefined;
		country?: string | undefined;
	};
	logo?: string | undefined;
	bio?: string | undefined;
	website?: string | undefined;
	role?: 'admin' | 'staff' | 'hoster' | 'user';
}

export interface BecomeOrganiserInputBody {
	email?: string;
	organisationName: string;
	phoneNumber?: string;
	phoneNumberVerified?: boolean;
	address?: {
		street?: string | undefined;
		city?: string | undefined;
		state?: string | undefined;
		postalCode?: string | undefined;
		country?: string | undefined;
	};
	logo?: string | undefined;
	bio?: string | undefined;
	website?: string | undefined;
	role?: 'admin' | 'staff' | 'hoster' | 'user';
}

export interface UpdateOrganiserInputBody {
	address?: {
		street?: string | undefined;
		city?: string | undefined;
		state?: string | undefined;
		postalCode?: string | undefined;
		country?: string | undefined;
	};
	logo?: string | undefined;
	bio?: string | undefined;
	website?: string | undefined;
}

export interface AddSocialAccountInputBody {
	platform: 'facebook' | 'twitterX' | 'tiktok' | 'youtube' | 'instagram' | 'linkedin';
	url: string;
}

/**
 * Defines the parameters for the getAllUsers function.
 */
export interface GetAllUsersParams {
	pageSize?: number;
	nextCursor?: string | number | Date;
	filters?: {
		emailVerified?: boolean;
		createdAt?: {
			startDate?: string;
			endDate?: string;
		};
	};
}
