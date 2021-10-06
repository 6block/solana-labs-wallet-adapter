import { customRef, Ref } from '@vue/reactivity';

export function useLocalStorage<T> (key: string, defaultValue: T | null = null): Ref<T | null> {
    return customRef<T | null>((track, trigger) => ({
        get: () => {
            track();
            const value = localStorage.getItem(key);
            try {
                return value ? JSON.parse(value) : defaultValue;
            } catch (error) {
                console.warn("Couldn't parse the following value from the local storage", value);
                return defaultValue;
            }
        },
        set: value => {
            if (value === null) {
                localStorage.removeItem(key);
            } else {
                try {
                    localStorage.setItem(key, JSON.stringify(value));
                } catch (error) {
                    console.error("Couldn't save the following value to the local storage", value);
                }
            }
            trigger();
        },
    }))
}
