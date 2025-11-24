export class Validators {
	/** Validates an email format. */
	public static isValidEmail(email: string): boolean {
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
	}

	/** Validates phone numbers (supports multiple country formats). */
	public static isValidPhoneNumber(phone: string): boolean {
		if (!phone.startsWith('+')) {
			throw new Error(
				'Invalid phone number format. Please include a country code (e.g., +1, +44, +91).',
			);
		}

		return /^\+?[1-9]\d{7,14}$/.test(phone); // Supports E.164 format
	}

	public static isValidObjectId(id: string): boolean {
		// Basic check for MongoDB ObjectId format (24 hex characters)
		return /^[a-fA-F0-9]{32}$/.test(id);
	}

	/** Ensures a password meets complexity requirements. */
	public static validatePassword(password: string): string {
		if (password.length < 8) {
			throw new Error('Password must be at least 8 characters long.');
		}

		const hasUppercase = /[A-Z]/.test(password);
		const hasNumber = /\d/.test(password);
		const hasSpecialChar = /[@$!%*?&.\\+\^()\[\]{}<>]/.test(password);
		const hasLowercase = /[a-z]/.test(password); // Ensures mixed case presence

		const complexityCount = [hasUppercase, hasNumber, hasSpecialChar, hasLowercase].filter(
			Boolean,
		).length;

		switch (complexityCount) {
			case 1:
				return 'Fair';
			case 2:
				return 'Moderate';
			case 3:
				return 'Good';
			case 4:
				return 'Excellent';
			default:
				return 'Weak';
		}
	}

	/**
	 * Calculates the Levenshtein distance between two strings.
	 * This method calculates the Levenshtein distance between two strings.
	 * @param a The first string.
	 * @param b The second string.
	 * @returns The Levenshtein distance.
	 */
	public static async levenshteinDistance(a: string, b: string): Promise<number> {
		const m = a.length;
		const n = b.length;

		if (m === 0) return n;
		if (n === 0) return m;

		// Create a 2D array and initialize the first row
		const matrix = new Array(n + 1);
		for (let j = 0; j <= n; j++) {
			matrix[j] = new Array(m + 1);
			matrix[j][0] = j;
		}

		// Initialize the first column
		for (let i = 0; i <= m; i++) {
			matrix[0][i] = i;
		}

		// Fill the matrix
		for (let j = 1; j <= n; j++) {
			for (let i = 1; i <= m; i++) {
				const cost = a[i - 1] === b[j - 1] ? 0 : 1;
				matrix[j][i] = Math.min(
					matrix[j][i - 1] + 1, // Deletion
					matrix[j - 1][i] + 1, // Insertion
					matrix[j - 1][i - 1] + cost, // Substitution
				);
			}
		}

		return matrix[n][m];
	}

	/**
	 * @description Checks if a provided bank account name is similar to the user or organiser name.
	 * This helps prevent the use of fraudulent or spam-related bank accounts.
	 * @param bankAccountName The name on the bank account.
	 * @param user The authenticated user object.
	 * @param organiser The organiser object linked to the user.
	 * @returns A boolean indicating if the name is considered valid.
	 */
	public static async checkNameSimilarity(
		bankAccountName: string,
		username: string,
		organiserName: string,
	): Promise<boolean> {
		const lowerBankAccountName = bankAccountName.toLowerCase();
		const lowerUserName = username.toLowerCase();
		const lowerOrganiserName = organiserName.toLowerCase();

		// Set a similarity threshold. This value might need tuning.
		const SIMILARITY_THRESHOLD = 0.5;

		// Check for exact matches
		if (lowerBankAccountName === lowerUserName || lowerBankAccountName === lowerOrganiserName) {
			return true;
		}

		// Check for word inclusion (e.g., "John Doe" vs "Doe John")
		const bankNameWords = lowerBankAccountName.split(/\s+/);
		const userWords = lowerUserName.split(/\s+/);
		const organiserWords = lowerOrganiserName.split(/\s+/);

		const checkWordInclusion = (words1: string[], words2: string[]): boolean => {
			return (
				words1.some((word) => words2.includes(word)) ||
				words2.some((word) => words1.includes(word))
			);
		};

		if (
			checkWordInclusion(bankNameWords, userWords) ||
			checkWordInclusion(bankNameWords, organiserWords)
		) {
			return true;
		}

		// Check for a high degree of string similarity (e.g., "Jonh Doe" vs "John Doe")
		const userDistance = await this.levenshteinDistance(lowerBankAccountName, lowerUserName);
		const organiserDistance = await this.levenshteinDistance(lowerBankAccountName, lowerOrganiserName);

		// Calculate a score where 1 is identical, 0 is completely different
		const userSimilarity =
			1 - userDistance / Math.max(lowerBankAccountName.length, lowerUserName.length);
		const organiserSimilarity =
			1 -
			organiserDistance / Math.max(lowerBankAccountName.length, lowerOrganiserName.length);

		if (userSimilarity > SIMILARITY_THRESHOLD || organiserSimilarity > SIMILARITY_THRESHOLD) {
			return true;
		}

		return false;
	}
}
