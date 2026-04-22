import { NavLink, Route, Routes } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { defaultSettings, Settings } from "./api/types";
import { useSettings, useUpdateSettings } from "./hooks/useSettings";
import { CalendarPage } from "./pages/CalendarPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { CourseFormPage } from "./pages/CourseFormPage";

const themeStorageKey = "theme_mode";

function readStoredTheme(): "light" | "dark" | null {
  const raw = window.localStorage.getItem(themeStorageKey);
  return raw === "light" || raw === "dark" ? raw : null;
}

function App() {
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const [themeMode, setThemeMode] = useState<"light" | "dark">(() => readStoredTheme() ?? "light");
  const hasHydratedThemeFromSettings = useRef(false);

  const mergedSettings = useMemo(() => settings ?? defaultSettings, [settings]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", themeMode === "dark");
  }, [themeMode]);

  useEffect(() => {
    if (hasHydratedThemeFromSettings.current || !settings) {
      return;
    }

    const storedTheme = readStoredTheme();
    if (storedTheme) {
      setThemeMode(storedTheme);
      hasHydratedThemeFromSettings.current = true;
      return;
    }

    const nextTheme = settings.dark_mode ? "dark" : "light";
    setThemeMode(nextTheme);
    window.localStorage.setItem(themeStorageKey, nextTheme);
    hasHydratedThemeFromSettings.current = true;
  }, [settings]);

  function saveSettings(next: Partial<Settings>) {
    updateSettings.mutate(next);
  }

  function toggleTheme() {
    setThemeMode((current) => {
      const next = current === "dark" ? "light" : "dark";
      window.localStorage.setItem(themeStorageKey, next);
      saveSettings({ dark_mode: next === "dark" });
      return next;
    });
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-group">
          <h1>Stundenplan</h1>
          <p>Semesterplanung mit Live-Import und smarten Filtern</p>
        </div>
        <nav>
          <NavLink to="/">Kalender</NavLink>
          <NavLink to="/courses/new">Neuer Kurs</NavLink>
          <NavLink to="/categories">Kategorien</NavLink>
        </nav>
        <div className="topbar-actions">
          <button
            type="button"
            onClick={() =>
              saveSettings({
                show_full_name: !mergedSettings.show_full_name
              })
            }
          >
            {mergedSettings.show_full_name ? "Abk. anzeigen" : "Vollen Namen anzeigen"}
          </button>
          <button
            type="button"
            onClick={toggleTheme}
          >
            {themeMode === "dark" ? "Hell" : "Dunkel"}
          </button>
        </div>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<CalendarPage showFullName={mergedSettings.show_full_name} />} />
          <Route path="/courses/new" element={<CourseFormPage mode="create" />} />
          <Route path="/courses/:id/edit" element={<CourseFormPage mode="edit" />} />
          <Route path="/categories" element={<CategoriesPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
