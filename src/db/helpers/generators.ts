export const generateSlug = (words: string[] | null, randomLength = 4): string => {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    // Process the input words
    let cleanWords: string[]
    let baseSlug = ""

    if (words !== null) {
        cleanWords = words
            .filter(word => word.trim().length > 0)
            .map(word => word.trim().toLowerCase().replace(/[^a-z0-9]+/g, ''));
        // Generate the base slug from words
        baseSlug = cleanWords.join('+');
    }

    // Generate random string for uniqueness
    let randomString = '';
    for (let i = 0; i < randomLength; i++) {
        randomString += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    // Combine base slug with random string
    const slug = baseSlug.length > 0
        ? `${baseSlug}${Date.now()}${randomString}`
        : `${Date.now()}${randomString}`;

    return slug;
};
