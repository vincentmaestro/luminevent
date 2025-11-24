import { TimeFormatOptions } from "../types/index"
import { v4 as uuidv4, validate as isUuid, stringify, parse } from 'uuid';
import type { ZodIssue } from 'zod';

export class Utils {
    public getCurrentDate = () => {
        const today = new Date();
        return today.toISOString().split("T")[0]; // Format the date to YYYY-MM-DD
    };

    public getInitials(name: string | null | null): string {
        if (!name) return ''

        // Remove extra spaces and split into parts
        const parts = name.trim().split(/\s+/)

        // Get first letter of first word
        const firstInitial = parts[0]?.[0]?.toUpperCase() || ''

        // Get first letter of last word (if different from first)
        const lastInitial = parts.length > 1
            ? parts[parts.length - 1]?.[0]?.toUpperCase()
            : ''

        return `${firstInitial}${lastInitial}`
    };


    /**
     * Formats a date object into a readable string.
     * @param date The Date object to format.
     * @returns Formatted date string (e.g., "YYYY-MM-DD HH:mm:ss").
     */
    public formatDateTime(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    /**
     * Converts a string to title case.
     * @param str The input string.
     * @returns The string in title case.
     */
    public capitalize(str: string): string {
        return str.replace(/\w\S*/g, (txt) => {
            return txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase();
        });
    }

    /**
     * Sanitizes a string to prevent XSS attacks (basic example).
     * For production, consider a dedicated library like 'dompurify' for HTML.
     * @param input The string to sanitize.
     * @returns The sanitized string.
     */
    public sanitizeString(input: string): string {
        return input.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Generates a random alphanumeric string.
     * @param {number} length Length of the string.
     * @returns {string} Random string.
     */
    public static generateRandomString(length: number = 10): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    }

    /**
     * Formats numbers with commas for better readability.
     * @param {number} num Number to format.
     * @returns {string} Formatted number with commas.
     */
    public static formatNumber(num: number): string {
        return num.toLocaleString();
    }

    /**
     * Escapes HTML characters to prevent XSS attacks.
     * @param {string} str Input string.
     * @returns {string} Escaped HTML string.
     */
    public static escapeHTML(str: string): string {
        // @ts-expect-error missmatch errors
        return str.replace(/[&<>"']/g, (match) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
        })[match]);
    }

    /**
     * Generates a random HEX color.
     * @returns {string} Random hex color string.
     */
    public static generateRandomHexColor(): string {
        return `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
    }

    /**
     * Checks if an object is empty (has no keys).
     * @param {object} obj Object to check.
     * @returns {boolean} True if object is empty, false otherwise.
     */
    public static isObjectEmpty(obj: object): boolean {
        return Object.keys(obj).length === 0;
    }

    /**
     * Converts camelCase to kebab-case.
     * @param {string} str Input camelCase string.
     * @returns {string} Kebab-case formatted string.
     */
    public static camelToKebab(str: string): string {
        return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    }

    /**
     * Determines if the given string is in ISO 8601 date format.
     * This regex is designed to match standard ISO 8601 formats including
     * optional milliseconds and timezone designators (Z or +/-HH:MM).
     *
     * @param {string | any} value - The value to test.
     * @returns {boolean} True if the value is a string and a valid ISO 8601 date string, false otherwise.
     *
     * @example
     * ```ts
     * Utils.isIsoDateString("2024-01-01T12:00:00Z"); // true
     * Utils.isIsoDateString("2024-01-01T12:00:00.123Z"); // true
     * Utils.isIsoDateString("2024-01-01T12:00:00+05:00"); // true
     * Utils.isIsoDateString("2024-01-01"); // false (missing time part)
     * Utils.isIsoDateString("not-a-date"); // false
     * Utils.isIsoDateString(new Date()); // false (not a string)
     * ```
     */
    public static isIsoDateString(value: string | any): boolean {
        if (typeof value !== 'string') {
            return false;
        }
        // Regex to match ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ or YYYY-MM-DDTHH:mm:ss.sss+/-HH:MM
        return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(value);
    }

    /**
     * Returns the ordinal suffix for a given number (e.g., 1st, 2nd, 3rd, 4th).
     * Handles numbers ending in 11, 12, and 13 correctly.
     *
     * @param {number} num - The number to evaluate.
     * @returns {string} The ordinal suffix ("st", "nd", "rd", or "th").
     *
     * @example
     * ```ts
     * Utils.getOrdinalSuffix(1); // "st"
     * Utils.getOrdinalSuffix(2); // "nd"
     * Utils.getOrdinalSuffix(3); // "rd"
     * Utils.getOrdinalSuffix(4); // "th"
     * Utils.getOrdinalSuffix(11); // "th"
     * Utils.getOrdinalSuffix(12); // "th"
     * Utils.getOrdinalSuffix(13); // "th"
     * Utils.getOrdinalSuffix(21); // "st"
     * Utils.getOrdinalSuffix(22); // "nd"
     * Utils.getOrdinalSuffix(101); // "st"
     * ```
     */
    public static getOrdinalSuffix(num: number): string {
        const j = num % 10;
        const k = num % 100;

        if (j === 1 && k !== 11) return 'st';
        if (j === 2 && k !== 12) return 'nd';
        if (j === 3 && k !== 13) return 'rd';
        return 'th';
    }

    /**
     * Formats the time elapsed since a given date into a human-readable string.
     * Provides different formats based on the time difference (seconds, minutes, hours, days, months/days, years).
     *
     * @param {string | Date} dateString - The date to compare against the current time. Can be an ISO 8601 string or a Date object.
     * @param {TimeFormatOptions} [options] - Optional formatting settings.
     * @returns {string} Human-readable elapsed time string (e.g., "Just now", "30s ago", "5m ago", "2h ago", "3d ago", "Jan 1", "2 yrs ago").
     *
     * @example
     * ```ts
     * // Assuming current time is May 9, 2025 12:00:00Z
     *
     * // Less than a minute ago
     * Utils.formatTimeSince(new Date(Date.now() - 10000)); // "Just now"
     * Utils.formatTimeSince(new Date(Date.now() - 10000), { showSeconds: true }); // "10s ago"
     * Utils.formatTimeSince(new Date(Date.now() - 10000), { showSeconds: true, longForm: true }); // "10 seconds ago"
     *
     * // Less than an hour ago
     * Utils.formatTimeSince(new Date(Date.now() - 5 * 60 * 1000)); // "5m ago"
     *
     * // Less than a day ago
     * Utils.formatTimeSince(new Date(Date.now() - 3 * 60 * 60 * 1000)); // "3h ago"
     *
     * // Less than 7 days ago
     * Utils.formatTimeSince(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)); // "2d ago"
     *
     * // Less than a year ago (formats as Month Day)
     * Utils.formatTimeSince("2025-04-15T10:00:00Z"); // "Apr 15"
     * Utils.formatTimeSince("2025-04-15T10:00:00Z", { locale: "fr-FR" }); // "15 avr." (Example for French locale)
     *
     * // More than a year ago
     * Utils.formatTimeSince("2023-05-01T12:00:00Z"); // "2 yrs ago"
     * Utils.formatTimeSince("2024-05-01T12:00:00Z"); // "1 yr ago"
     * ```
     */
    public static formatTimeSince(
        dateString: string | Date,
        options: TimeFormatOptions = {}
    ): string {
        const { showSeconds = false, longForm = false, locale = "en-US" } = options;
        const date = typeof dateString === "string" ? new Date(dateString) : dateString;
        const now = new Date();
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (showSeconds && seconds < 60) {
            return longForm ? `${seconds} seconds ago` : `${seconds}s ago`;
        }

        if (seconds < 60) return "Just now";

        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;

        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;

        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;

        // First check year threshold before checking current year
        const years = Math.floor(days / 365);
        if (years >= 1) {
            return `${years} yr${years > 1 ? "s" : ""} ago`;
        }

        // If less than 1 year but more than 7 days, show month/day
        return date.toLocaleDateString(locale, {
            month: "short",
            day: "numeric",
        });
    }

    /**
     * Generates a unique identifier (UUID v4).
     * @returns {string} UUID string.
     */
    public static generateUUID(): string {
        return uuidv4();
    }

    /**
     * Formats zod validation errors.
     * @returns {string}.
     */
    public static formatZodErrors(issues: ZodIssue[]): string {
        return issues
            .map(i => `${i.message} for field/s [${i.path.join(',')}]`)
            .join(', ');
    }

    /**
     * Normalize a UUID string into its canonical format.
     *
     * @param id - The UUID string to normalize.
     * @returns The normalized UUID string, or `null` if the input is not a valid UUID.
     */
    public static normalizeUuid(id: string): string | null {
        if (!isUuid(id)) return null;
        return stringify(parse(id));

    }
}
