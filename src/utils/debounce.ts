export class DebounceUtils {
    /**
     * Debounce function execution by delaying it until no further calls occur within the specified delay.
     * @param {Function} fn Function to debounce.
     * @param {number} delay Time delay in milliseconds.
     * @returns {Function} Debounced function.
     */
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    public static debounce(fn: Function, delay: number): Function {
        let timer: NodeJS.Timeout;
        return (...args: any[]) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    }

    /**
     * Throttles a function so that it executes at most once in the specified interval.
     * @param {Function} fn Function to throttle.
     * @param {number} limit Time limit in milliseconds.
     * @returns {Function} Throttled function.
     */
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    public static throttle(fn: Function, limit: number): Function {
        let lastCall = 0;
        return (...args: any[]) => {
            const now = Date.now();
            if (now - lastCall >= limit) {
                lastCall = now;
                fn(...args);
            }
        };
    }
}