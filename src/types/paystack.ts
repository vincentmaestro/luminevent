/**
 * @description Defines the expected successful response from the Paystack bank resolution API.
 */
export interface PaystackResolveSuccessDTO {
	status: boolean;
	message: string;
	data: {
		account_number: string;
		account_name: string;
		bank_id: number;
	};
}

/**
 * @description Defines the expected error response from the Paystack bank resolution API.
 */
export interface PaystackResolveErrorDTO {
	status: boolean;
	message: string;
}

/**
 * @description Defines the structure of the Paystack customer object.
 */
export interface PaystackCustomerDTO {
    email: string;
    integration: number;
    domain: string;
    customer_code: string;
    id: number;
    identified: boolean;
    identifications: unknown;
    createdAt: string;
    updatedAt: string;
}

/**
 * @description Defines the expected successful response from the Paystack customer creation API.
 */
export interface PaystackCustomerSuccessDTO {
    status: boolean;
    message: string;
    data: PaystackCustomerDTO;
}

/**
 * @description Defines the expected error response from the Paystack API.
 */
export interface PaystackApiErrorDTO {
    status: boolean;
    message: string;
}

/**
 * @description Defines the comprehensive successful response for creating a dedicated bank account.
 */
export interface DedicatedAccountSuccessDTO {
    status: boolean;
    message: string;
    data: {
        bank: {
            name: string;
            id: number;
            slug: string;
        };
        account_name: string;
        account_number: string;
        assigned: boolean;
        currency: string;
        metadata: null;
        active: boolean;
        id: number;
        created_at: string;
        updated_at: string;
        assignment: {
            integration: number;
            assignee_id: number;
            assignee_type: string;
            expired: boolean;
            account_type: string;
            assigned_at: string;
        };
        customer: {
            id: number;
            first_name: string;
            last_name: string;
            email: string;
            customer_code: string;
            phone: string;
            risk_action: string;
        };
    };
}

/**
 * @description Defines the expected successful response for creating a subaccount.
*/
export interface SubaccountSuccessDTO {
	status: boolean;
	message: string;
	data: {
		business_name: string;
		account_number: string;
		percentage_charge: number;
		settlement_bank: string;
		currency: string;
		bank: number;
		integration: number;
		domain: string;
		account_name: string;
		product: string;
		managed_by_integration: number;
		subaccount_code: string;
		is_verified: boolean;
		settlement_schedule: string;
		active: boolean;
		migrate: boolean;
		id: number;
		createdAt: string;
		updatedAt: string;
	};
}