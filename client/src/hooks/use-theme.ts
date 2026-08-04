import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function useTheme(initial: Theme = "system") {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem("neko-theme") as Theme | null) || initial,
  );
  const effectiveTheme = resolveTheme(theme);

  // Apply theme to <html> and persist
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(effectiveTheme);
    localStorage.setItem("neko-theme", theme);
  }, [theme, effectiveTheme]);

  // Follow live OS theme changes in "system" mode
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const root = document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(mq.matches ? "dark" : "light");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  return { theme, setTheme, effectiveTheme };
}
