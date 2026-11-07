import { useEffect, useState } from "react";

// Shared across both GitHub Pages apps on the same origin.
const THEME_KEY = "melbourne-collection:theme";
type Theme = "navy" | "light";
const parseTheme = (value: string | null): Theme => value === "light" ? "light" : "navy";

function initialTheme(): Theme {
  const current = document.documentElement.dataset.theme;
  if (current === "navy" || current === "light") return current;
  try { return parseTheme(localStorage.getItem(THEME_KEY)); }
  catch { return "navy"; }
}

export default function ThemeSwitcher({ palette = "navy" }: { palette?: "navy" | "sunset" }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const sunset = palette === "sunset";
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "navy" ? sunset ? "#210c22" : "#14213D" : "#f7f6fa");
  }, [theme, sunset]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === THEME_KEY || event.key === null) setTheme(parseTheme(event.newValue));
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const toggle = () => {
    const next = theme === "navy" ? "light" : "navy";
    setTheme(next);
    try { localStorage.setItem(THEME_KEY, next); }
    catch { /* The current page still switches when browser storage is unavailable. */ }
  };

  return (
    <button className="collection-theme-switch" type="button" role="switch"
      aria-label={sunset ? "Sunset colour theme" : "Navy, cream and coral theme"} aria-checked={theme === "navy"}
      title={theme === "navy" ? "Switch to the original light theme" : sunset ? "Try the sunset colour theme" : "Try the navy, cream and coral theme"}
      onClick={toggle}>
      <span className="collection-theme-swatches" aria-hidden="true"><i /><i /><i /></span>
      <span className="collection-theme-name" aria-hidden="true"><small>Colour theme</small><strong>{theme === "navy" ? sunset ? "Sunset glow" : "Navy & coral" : "Original light"}</strong></span>
      <span className="collection-theme-track" aria-hidden="true"><i /></span>
    </button>
  );
}
