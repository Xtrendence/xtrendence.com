import { useCallback, useSyncExternalStore } from "react";

type TTheme = "dark" | "light";

const STORAGE_KEY = "clicker-theme";
const root = document.documentElement;

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

function current(): TTheme {
	return root.classList.contains("light") ? "light" : "dark";
}

// The class is already on <html> from the pre-paint script in index.html, so
// this only has to keep React in step with it
export function useTheme() {
	const theme = useSyncExternalStore(subscribe, current, () => "dark" as TTheme);

	const setTheme = useCallback((next: TTheme) => {
		root.classList.toggle("light", next === "light");
		root.classList.toggle("dark", next !== "light");

		try {
			localStorage.setItem(STORAGE_KEY, next);
		} catch {
			// Private mode, the class still applies for this page view
		}

		for (const listener of listeners) listener();
	}, []);

	const toggleTheme = useCallback(() => {
		setTheme(current() === "light" ? "dark" : "light");
	}, [setTheme]);

	return { theme, setTheme, toggleTheme };
}
