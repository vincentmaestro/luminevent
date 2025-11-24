export const obfuscateUrl = (url: string): string => {
    try {
        const parsed = new URL(url);
        if (parsed.password) {
            parsed.password = '*****';
        }
        return parsed.toString();
    } catch {
        return '*****'; // Return masked if URL parsing fails
    }
}
