import { UploadApiOptions } from "cloudinary";
import type { Logger } from "winston"

export interface TimeFormatOptions {
    /**
     * Whether to show seconds for durations less than a minute.
     * Defaults to `false`.
     */
    showSeconds?: boolean;
    /**
     * Whether to use the long form (e.g., "seconds ago" instead of "s ago").
     * Applies to durations less than a minute when `showSeconds` is true.
     * Defaults to `false`.
     */
    longForm?: boolean;
    /**
     * The locale to use for formatting dates when the elapsed time is more than 7 days but less than a year.
     * Defaults to "en-US".
     */
    locale?: string;
}

/**
 * Interface for Email sending jobs.
 */
export interface EmailJobData {
    type: "passwordReset" | "emailVerification" | "transactional";
    to: string;
    subject?: string;
    body?: string;
    html?: string;
    text?: string;
    token?: string;
    callbackUrl?: string;
    templateName?: string; // For template engines (e.g., Handlebars)
    attachments?: Array<{
        filename: string;
        path: string;
    }>;
}

/**
 * DTO: Contact Support request body
 */
export interface ContactSupportDTO {
  firstName: string;
  lastName: string;
  companyName?: string;
  organizationType?: string;
  phoneNumber?: string;
  reasonForContact: string;
  email: string;
}

export interface ImageProcessingJobData {
    // Source (choose one)
    imageUrl?: string;       // Remote URL or local path
    imageBuffer?: {          // Alternative to URL
        data: Buffer;
        mimeType: string;      // Required for Buffer uploads (e.g., 'image/jpeg')
    };

    // Required Metadata
    userId: string | number;
    publicId?: string;       // Optional Cloudinary public_id

    // Transformations (matches Cloudinary's API)
    transformations?: {
        resize?: {
            width: number;
            height: number;
            crop?: 'fill' | 'fit' | 'limit' | 'pad'; // Cloudinary crop modes
        };
        quality?: number;      // 1-100
        format?: 'jpg' | 'png' | 'webp' | 'auto';
        effects?: {
            grayscale?: boolean;
            rotate?: number;     // 0-360 degrees
            blur?: number;       // 0-2000
        };
    };

    // Upload Options (extends Cloudinary's ExtendedUploadOptions)
    uploadOptions?: Omit<UploadApiOptions, 'public_id'> & {
        folder?: string;       // e.g., 'users/avatars'
        overwrite?: boolean;   // Replace existing image
    };
}

/**
 * Interface for receipt parser from json.
 */
export interface ReceiptItem {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
}

export interface ReceiptData {
    receiptId: string;
    date: string;
    customerName: string;
    items: ReceiptItem[];
    subtotal: number;
    taxRate: number; // e.g., 0.05 for 5%
    taxAmount: number;
    totalAmount: number;
    currency: string;
    notes?: string;
}


/**
 * Interface for formatting errors.
 */
export interface NotFoundOptions {
    log?: boolean;
    includePath?: boolean;
    logger?: Logger;
}

export interface HttpError extends Error {
    status?: number;
    statusCode?: number;
    isJoi?: boolean;
    details?: any;
}