import Utils from "../../utils"
import z from 'zod';

export const CreateUserSchema = z.object({
    email: z.email("Please enter a valid email address."),
    password: z.string()
        .min(8, "Password must be at least 8 characters long.")
        .regex(/[A-Z]/, "Password must contain at least one uppercase letter (A-Z).")
        .regex(/[0-9]/, "Password must contain at least one number (0-9).")
        .regex(/[!@#$%^&*.]/, "Password must contain at least one special character (!@#$%^&*)."),
    name: z.string().min(1, "Name is required."),
    image: z.string().min(1, "Image URL is required.").optional(),
    role: z.enum([
        "admin",
        "staff",
        "hoster",
        "user"
    ]).default("user")
});

export const LoginUserSchema = z.object({
    email: z.email("Please enter a valid email address."),
    password: z.string()
});

export const ChangePasswordSchema = z.object({
    oldPassword: z.string(),
    newPassword: z.string()
        .min(8, "Password must be at least 8 characters long.")
        .regex(/[A-Z]/, "Password must contain at least one uppercase letter (A-Z).")
        .regex(/[0-9]/, "Password must contain at least one number (0-9).")
        .regex(/[!@#$%^&*.]/, "Password must contain at least one special character (!@#$%^&*.).")
})
    .refine((data) => !Utils.AuthUtils.isCommonPassword(data.newPassword), {
        // This refinement checks if the new password is NOT a common password.
        // If isCommonPassword returns true (meaning it IS common), this refinement fails.
        path: ['newPassword'], // Associate the error with the newPassword field
        message: "Password is too common and easily guessable."
    })
    .refine(async (data) => {
        // This refinement checks the similarity between new and old passwords.
        // It should return true if the new password is DIFFERENT enough from the old one.
        const similarityThreshold = 0.7; // 70% similarity (adjust as needed)
        const similarity = await Utils.AuthUtils.calculatePasswordSimilarity(data.newPassword, data.oldPassword);
        return similarity < similarityThreshold;
    }, {
        path: ['newPassword'], // Associate the error with the newPassword field
        message: "New password must be significantly different from your old password."
    });

// Common address schema
export const AddressSchema = z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    postalCode: z.string().min(1),
    country: z.string().min(1)
}).partial();

// Organizer schema
export const OrganizerSchema = z.object({
    email: z.email(),
    organisationName: z.string().min(1),
    phoneNumber: z.string().min(8),
    phoneNumberVerified: z.boolean().default(false),
    address: AddressSchema.optional(),
    logo: z.url().optional(),
    bio: z.string().optional(),
    website: z.string().url().optional()
});

// Main create schema
export const CreateOrganiserSchema = z.object({
    // User fields
    email: z.email(),
    password: z.string()
        .min(8)
        .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
        .regex(/[0-9]/, 'Must contain at least one number')
        .regex(/[!@#$%^&*]/, 'Must contain at least one special character'),
    name: z.string().min(1),
    image: z.url().min(1).optional(),
    role: z.enum(['admin', 'staff', 'hoster', 'user']).default('user'),

    // Organizer fields
    organiser: OrganizerSchema
});

export const AddOrganiserPayoutHistorySchema = z.object({
	amount: z.number().positive(),
	status: z.enum(['pending', 'completed', 'failed']).default('pending').optional(),
});

export const AddSocialAccountSchema = z.object({
	platform: z.enum(['facebook', 'twitterX', 'tiktok', 'youtube', 'instagram', 'linkedin']),
	url: z.url().min(1),
});

export const UpdateOrganiserPayoutHistorySchema = z
	.object({
		amount: z.number().positive().optional(),
		status: z.enum(['pending', 'completed', 'failed']).optional(),
		transactionId: z.string().min(1).optional(),
	})
	.refine((data) => data.amount !== null || data.status !== null || data.transactionId !== null, {
		message: 'At least one field (amount, status, or transactionId) is required for update.',
	});

export const UserSettingsSchema = z.object({
    userId: z.string().uuid(),
    notification: z.object({
        email: z.boolean().default(true),
        sms: z.boolean().default(false),
        push: z.boolean().default(true)
    }).default({
        email: true,
        sms: false,
        push: true
    }),
    preferences: z.object({
        theme: z.enum(['light', 'dark', 'system']).default('light')
    }).default({
        theme: 'light'
    })
}).partial();

export const RequestResetTokenSchema = z.object({
    email: z.string().email()
});

export const ResetPasswordSchema = z.object({
    token: z.string().min(1, "Token is required"),
    newPassword: z.string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
        .regex(/[0-9]/, "Password must contain at least one number")
        .regex(/[!@#$%^&*.]/, "Password must contain at least one special character"),
});

export const PaginatedDateParamSchema = z.object({
    pagesize: z.preprocess(
        (val) => {
            const strVal = String(val);

            if (!strVal || strVal.trim() === '') {
                throw new Error('pagesize must be a valid number as a string. Received empty value.');
            }

            parseInt(strVal, 10)
        },
        z.number().min(1).default(20)
    ),
    cursor: z.preprocess(
        (val) => {
            const strVal = String(val);

            // Throw error if empty or falsy value
            if (!strVal || strVal.trim() === '') {
                throw new Error('Cursor must be a valid date string. Received empty value.');
            }

            try {
                return new Date(strVal);
            } catch {
                // If parsing fails, return a default date far in the past
                const date = new Date();
                date.setFullYear(date.getFullYear() - 10);
                date.setDate(date.getDate() - 1);
                return date;
            }
        },
        z.date().default(() => {
            // Default to a date 10 years and 1 day ago
            const date = new Date();
            date.setFullYear(date.getFullYear() - 10);
            date.setDate(date.getDate() - 1);
            return date;
        })
    )
}).partial();

export const UpdateUserSchema = z.object({
    email: z.string().email().optional(),
    name: z.string().min(1).optional(),
    image: z.string().url().min(1).optional(),
    role: z.enum(["admin", "staff", "hoster", "user"]).optional(),
    banned: z.boolean().optional(),
    emailVerified: z.boolean().optional(),
    lastLogin: z.date().optional(),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
}).partial(); // All fields are optional for update

export const UpdateSocialAccountSchema = z.object({
    platform: z.enum(["facebook", "twitterX", "tiktok", "youtube", "instagram", "linkedin"]).optional(),
    url: z.string().url().min(1).optional(),
}).refine(data => data.platform !== null || data.url !== null, {
    message: "At least one field (platform or URL) is required for update.",
});

export const EmailVericationSchema = z.object({
    token: z.string({ error: "Token required" })
})

export const CreateGoogleUserSchema = z.object({
    email: z.string().email("Please enter a valid email address."),
    name: z.string().min(1, "Name is required."),
    avatar: z
        .string()
        .url("Image must be a valid URL.")
        .nullable()
        .optional(),
    emailVerified: z.boolean().default(true),
    role: z.enum(["admin", "staff", "hoster", "user"]).default("user"),
    googleId: z.string().min(1, "Google ID is required."),
});

export const resendEmailVerificationSchema = z.object({
    email: z.email("Please enter a valid email address."),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;