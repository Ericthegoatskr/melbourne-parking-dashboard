import { CarFront, CloudSun, LayoutGrid, TrainFront, Wind } from "lucide-react";
import "./CollectionNav.css";
import ThemeSwitcher from "./ThemeSwitcher";

// Keep this component and its stylesheet identical in both dashboard repositories.
// The collection shares one GitHub Pages origin, including the separate parking app.
const pages = [
  { id: "home", label: "Home", shortLabel: "Home", href: "/melbourne-daily/", Icon: LayoutGrid },
  { id: "parking", label: "Parking", shortLabel: "Parking", href: "/melbourne-parking-dashboard/", Icon: CarFront },
  { id: "weather", label: "Weather & UV", shortLabel: "Weather", href: "/melbourne-daily/weather.html", Icon: CloudSun },
  { id: "air", label: "Air quality", shortLabel: "Air", href: "/melbourne-daily/air.html", Icon: Wind },
  { id: "transport", label: "Transport", shortLabel: "Transport", href: "/melbourne-daily/transport.html", Icon: TrainFront },
] as const;

export default function CollectionNav({ current, placement, onNavigate, hidden = false }: {
  current: typeof pages[number]["id"];
  placement: "sidebar" | "mobile";
  onNavigate?: () => void;
  hidden?: boolean;
}) {
  return (
    <nav className={`collection-nav collection-nav--${placement}`} aria-label={placement === "mobile" ? "Dashboard series mobile" : "Dashboard series"} hidden={hidden}>
      {placement === "sidebar" && <span className="collection-label">THE MELBOURNE COLLECTION</span>}
      {pages.map(({ id, label, shortLabel, href, Icon }) => (
        <a key={id} className="collection-link" href={href} aria-label={label} aria-current={current === id ? "page" : undefined} onClick={onNavigate}>
          <Icon size={20} strokeWidth={1.7} aria-hidden="true" />
          <span className="collection-link-label" aria-hidden="true">{label}</span>
          <span className="collection-link-short" aria-hidden="true">{shortLabel}</span>
          {current === id && <span className="collection-current-dot" aria-hidden="true" />}
        </a>
      ))}
      {placement === "sidebar" && <ThemeSwitcher palette={({ home: "navy", parking: "amber", weather: "sunset", air: "forest", transport: "iris" } as const)[current]} />}
    </nav>
  );
}
