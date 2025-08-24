import { useTheme as useNextTheme } from "next-themes";

export function useTheme() {
  const { theme, setTheme } = useNextTheme();
  return {
    theme: (["system", "dark", undefined, null].includes(theme) ? "dark" : "light") as
      | "dark"
      | "light",
    setTheme,
  };
}
