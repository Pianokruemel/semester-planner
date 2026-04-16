import { NavLink, Route, Routes } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { defaultSettings } from "./api/types";
import { useSettings, useUpdateSettings } from "./hooks/useSettings";
import { CalendarPage } from "./pages/CalendarPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { CourseFormPage } from "./pages/CourseFormPage";

function App() {
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();

  const mergedSettings = useMemo(() => settings ?? defaultSettings, [settings]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", mergedSettings.dark_mode);
  }, [mergedSettings.dark_mode]);

  function saveSettings(next: typeof mergedSettings) {
    updateSettings.mutate(next);
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
                ...mergedSettings,
                show_full_name: !mergedSettings.show_full_name
              })
            }
          >
            {mergedSettings.show_full_name ? "Abk. anzeigen" : "Vollen Namen anzeigen"}
          </button>
          <button
            type="button"
            onClick={() =>
              saveSettings({
                ...mergedSettings,
                dark_mode: !mergedSettings.dark_mode
              })
            }
          >
            {mergedSettings.dark_mode ? "Hell" : "Dunkel"}
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
