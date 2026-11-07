import { useEffect, useState, type CSSProperties } from "react";

// Shared across both GitHub Pages apps on the same origin.
const THEME_KEY = "melbourne-collection:theme";
type Theme = "navy" | "light";
const parseTheme = (value: string | null): Theme => value === "light" ? "light" : "navy";
const palettes = {
  navy: { name: "Navy & coral", label: "Navy, cream and coral theme", canvas: "#14213D", surface: "#f4ede0", accent: "#ff6b5b" },
  amber: { name: "Walnut & amber", label: "Walnut and amber colour theme", canvas: "#2c241b", surface: "#fff3df", accent: "#edbd69" },
  sunset: { name: "Sunset glow", label: "Sunset colour theme", canvas: "#210c22", surface: "#cc8b38", accent: "#ff542c" },
  forest: { name: "Forest & mint", label: "Forest and mint colour theme", canvas: "#102e29", surface: "#edf5e9", accent: "#9cdbbb" },
  iris: { name: "Indigo & iris", label: "Indigo and iris colour theme", canvas: "#252342", surface: "#f3f0ff", accent: "#bfb2ff" },
} as const;

function initialTheme(): Theme {
  const current = document.documentElement.dataset.theme;
  if (current === "navy" || current === "light") return current;
  try { return parseTheme(localStorage.getItem(THEME_KEY)); }
  catch { return "navy"; }
}

export default function ThemeSwitcher({ palette = "navy" }: { palette?: keyof typeof palettes }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const colours = palettes[palette];
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "navy" ? colours.canvas : "#f7f6fa");
  }, [theme, colours.canvas]);
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
      aria-label={colours.label} aria-checked={theme === "navy"}
      title={theme === "navy" ? "Switch to the original light theme" : `Use ${colours.name}`}
      onClick={toggle}>
      <span className="collection-theme-swatches" aria-hidden="true" style={{ "--swatch-base": colours.canvas, "--swatch-surface": colours.surface, "--swatch-accent": colours.accent } as CSSProperties}><i /><i /><i /></span>
      <span className="collection-theme-name" aria-hidden="true"><small>Colour theme</small><strong>{theme === "navy" ? colours.name : "Original light"}</strong></span>
      <span className="collection-theme-track" aria-hidden="true"><i /></span>
    </button>
  );
}
