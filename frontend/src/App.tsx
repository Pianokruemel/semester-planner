import { useEffect, useState } from "react";
import { NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { defaultSettings, Settings } from "./api/types";
import { useSettings, useUpdateSettings } from "./hooks/useSettings";
import { CalendarPage } from "./pages/CalendarPage";
import { CatalogPage } from "./pages/CatalogPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { CourseFormPage } from "./pages/CourseFormPage";
import { ExamsPage } from "./pages/ExamsPage";
import { usePlannerStore } from "./planner/store";

function App() {
  const navigate = useNavigate();
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const { hasCurrentPlanner, isLoadingPlan, startNewPlanner } = usePlannerStore();
  const mergedSettings = settings ?? defaultSettings;
  const [entryError, setEntryError] = useState("");
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", mergedSettings.dark_mode);
  }, [mergedSettings.dark_mode]);

  function saveSettings(next: Partial<Settings>) {
    updateSettings.mutate(next);
  }

  function toggleTheme() {
    saveSettings({ dark_mode: !mergedSettings.dark_mode });
  }

  async function handleNewPlanner() {
    setEntryError("");
    setIsCreatingPlan(true);

    try {
      await startNewPlanner();
      navigate("/");
    } catch (error) {
      setEntryError(error instanceof Error ? error.message : "Plan konnte nicht erstellt werden.");
    } finally {
      setIsCreatingPlan(false);
    }
  }

  if (isLoadingPlan) {
    return (
      <div className="app-shell">
        <section className="page-card entry-hero">
          <h1>Stundenplan wird geladen</h1>
          <p className="page-intro">Bitte warten.</p>
        </section>
      </div>
    );
  }

  if (!hasCurrentPlanner) {
    return (
      <div className="app-shell">
        <section className="page-card entry-hero">
          <span className="entry-kicker">Anonym planen</span>
          <h1>Plane dein Semester mit öffentlichem TUCaN-Katalog</h1>
          <p className="page-intro">
            Erstelle eine neue Planung. Der Browser speichert nur die Plan-ID; Kurse, Kategorien, Termine und Prüfungen
            werden in PostgreSQL gespeichert.
          </p>
          <div className="entry-actions">
            <button type="button" className="primary-btn" onClick={() => void handleNewPlanner()} disabled={isCreatingPlan}>
              {isCreatingPlan ? "Erstelle..." : "Neue Planung"}
            </button>
          </div>
          {entryError ? <p className="error-text">{entryError}</p> : null}

          <div className="entry-utility-row">
            <p>Darstellung und Filter bleiben auf diesem Gerät.</p>
            <button type="button" className="utility-btn" onClick={toggleTheme}>
              {mergedSettings.dark_mode ? "Hell" : "Dunkel"}
            </button>
          </div>

          <div className="entry-notes">
            <article className="entry-note">
              <strong>Plan-ID lokal</strong>
              <p>Die aktuelle anonyme Plan-ID liegt im Browser und öffnet diese Planung wieder.</p>
            </article>
            <article className="entry-note">
              <strong>Öffentlicher Katalog</strong>
              <p>Der Scanner lädt öffentliche Vorlesungsdaten aus TUCaN in den Katalog.</p>
            </article>
            <article className="entry-note">
              <strong>Teilen folgt später</strong>
              <p>Öffentliches Teilen ist in dieser Version bewusst nicht enthalten.</p>
            </article>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-group">
          <h1 className="brand-wordmark" aria-label="Semesti Plani">
            <span aria-hidden="true">Semesti</span>
            <span className="brand-logo-wrap" aria-hidden="true">
              <img className="brand-logo brand-logo-light" src="/brand/semesti-p-light.png" alt="" />
              <img className="brand-logo brand-logo-dark" src="/brand/semesti-p-dark.png" alt="" />
            </span>
            <span aria-hidden="true">lani</span>
          </h1>
        </div>
        <nav>
          <NavLink to="/">Kalender</NavLink>
          <NavLink to="/catalog">Katalog</NavLink>
          <NavLink to="/courses/new">Neuer Kurs</NavLink>
          <NavLink to="/categories">Kategorien</NavLink>
        </nav>
        <div className="topbar-controls">
          <div className="planner-status-chip">PostgreSQL</div>
          <div className="topbar-utilities">
            <button type="button" className="utility-btn" onClick={toggleTheme}>
              {mergedSettings.dark_mode ? "Hell" : "Dunkel"}
            </button>
          </div>
          <div className="topbar-actions">
            <button type="button" onClick={() => void handleNewPlanner()} disabled={isCreatingPlan}>
              Neue Planung
            </button>
          </div>
        </div>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<CalendarPage showFullName={mergedSettings.show_full_name} />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/exams" element={<ExamsPage />} />
          <Route path="/courses/new" element={<CourseFormPage mode="create" />} />
          <Route path="/courses/:id/edit" element={<CourseFormPage mode="edit" />} />
          <Route path="/categories" element={<CategoriesPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
