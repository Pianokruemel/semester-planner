import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PlannerCourse, defaultUiPreferences, formatAppointmentType } from "../api/types";
import { useCategories } from "../hooks/useCategories";
import { useCourses } from "../hooks/useCourses";
import { useUpdateSettings } from "../hooks/useSettings";
import { useCreateCourse, useDeleteCourse, useRefreshCatalogCourse, useUpdateCourse } from "../hooks/useCourseMutations";
import { formatAppointmentsForTextarea, summarizeAppointments } from "../planner/appointmentParser";

type Props = {
  mode: "create" | "edit";
};

function formatDateTime(value: string | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function catalogStatusText(course: PlannerCourse) {
  if (course.catalogStatus === "manual") {
    return "Manueller Kurs";
  }

  if (course.catalogStatus === "missing") {
    return "Katalogkurs nicht mehr verfügbar";
  }

  if (course.catalogStatus === "modified") {
    return course.catalogHasUpdate ? "Lokal geändert, neuer Katalogstand verfügbar" : "Lokal geändert";
  }

  if (course.catalogStatus === "outdated") {
    return "Neuer Katalogstand verfügbar";
  }

  return "Katalogdaten aktuell";
}

export function CourseFormPage({ mode }: Props) {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: categories = [] } = useCategories();
  const { data: courses = [], isLoading: isLoadingCourses } = useCourses();
  const updateSettings = useUpdateSettings();
  const createCourse = useCreateCourse();
  const updateCourse = useUpdateCourse();
  const refreshCatalogCourse = useRefreshCatalogCourse();
  const deleteCourse = useDeleteCourse();

  const existingCourse = useMemo(
    () => (mode === "edit" && id ? courses.find((course) => course.id === id) : undefined),
    [courses, id, mode]
  );

  const courseNotFound = useMemo(
    () => mode === "edit" && id && !isLoadingCourses && !existingCourse,
    [mode, id, isLoadingCourses, existingCourse]
  );

  const [name, setName] = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  const [cp, setCp] = useState(6);
  const [categoryId, setCategoryId] = useState<string>("");
  const [courseNumber, setCourseNumber] = useState("");
  const [appointmentsRaw, setAppointmentsRaw] = useState("");
  const [errorText, setErrorText] = useState("");
  const [preview, setPreview] = useState<ReturnType<typeof summarizeAppointments> | null>(null);
  const [previewError, setPreviewError] = useState("");
  const isSaving = createCourse.isPending || updateCourse.isPending || updateSettings.isPending;
  const isRefreshingCatalog = refreshCatalogCourse.isPending;
  const isDeleting = deleteCourse.isPending;
  const isBusy = isSaving || isRefreshingCatalog || isDeleting || (mode === "edit" && isLoadingCourses);

  useEffect(() => {
    if (!existingCourse) {
      return;
    }

    setName(existingCourse.name);
    setAbbreviation(existingCourse.abbreviation);
    setCp(existingCourse.cp);
    setCategoryId(existingCourse.categoryId ?? "");
    setCourseNumber(existingCourse.courseNumber ?? "");
    setAppointmentsRaw(formatAppointmentsForTextarea(existingCourse.appointments));
  }, [existingCourse]);

  useEffect(() => {
    const trimmed = appointmentsRaw.trim();
    if (!trimmed) {
      setPreview(null);
      setPreviewError("");
      return;
    }

    const timer = window.setTimeout(() => {
      try {
        setPreview(summarizeAppointments(appointmentsRaw));
        setPreviewError("");
      } catch (error) {
        setPreview(null);
        setPreviewError(error instanceof Error ? error.message : "Parsing fehlgeschlagen.");
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [appointmentsRaw]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorText("");

    if (courseNotFound) {
      setErrorText("Kurs nicht gefunden. Bitte zur Übersicht zurückkehren.");
      return;
    }

    try {
      if (mode === "create") {
        await createCourse.mutateAsync({
          name,
          abbreviation,
          cp,
          category_id: categoryId || null,
          course_number: courseNumber.trim() || null,
          appointments_raw: appointmentsRaw
        });
        await updateSettings.mutateAsync({
          active_filters: defaultUiPreferences.active_filters
        });
      } else if (id) {
        await updateCourse.mutateAsync({
          id,
          name,
          abbreviation,
          cp,
          category_id: categoryId || null,
          course_number: courseNumber.trim() || null,
          appointments_raw: appointmentsRaw
        });
      }

      navigate("/");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    }
  }

  async function onDelete() {
    if (!id) {
      return;
    }

    const ok = window.confirm("Kurs wirklich löschen? Alle zugehörigen Termine werden entfernt.");
    if (!ok) {
      return;
    }

    try {
      await deleteCourse.mutateAsync(id);
      navigate("/");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Löschen fehlgeschlagen.");
    }
  }

  async function onRefreshCatalog() {
    if (!existingCourse) {
      return;
    }

    if (existingCourse.catalogIsModified) {
      const ok = window.confirm("Katalogdaten aktualisieren? Deine lokal bearbeiteten Termine werden ersetzt.");
      if (!ok) {
        return;
      }
    }

    try {
      await refreshCatalogCourse.mutateAsync(existingCourse.id);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Katalogdaten konnten nicht aktualisiert werden.");
    }
  }

  if (isLoadingCourses && mode === "edit") {
    return (
      <section className="page-card">
        <h2>Kurs wird geladen...</h2>
        <p className="page-intro">Bitte warten.</p>
      </section>
    );
  }

  if (courseNotFound) {
    return (
      <section className="page-card">
        <h2>Kurs nicht gefunden</h2>
        <p className="page-intro">Der Kurs mit der ID {id} konnte nicht gefunden werden.</p>
        <div className="button-row full-width">
          <button type="button" className="primary-btn" onClick={() => navigate("/")}>
            Zur Übersicht
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="page-card">
      <h2>{mode === "create" ? "Kurs erstellen" : "Kurs bearbeiten"}</h2>
      <p className="page-intro">Fülle Kursdaten aus und füge den tabellarischen TUCaN-Export direkt ein.</p>
      {mode === "edit" && existingCourse && existingCourse.catalogStatus !== "manual" ? (
        <div className={`catalog-sync-banner ${existingCourse.catalogStatus}`}>
          <div>
            <strong>{catalogStatusText(existingCourse)}</strong>
            <span>
              {formatDateTime(existingCourse.catalogSyncedAt)
                ? `Zuletzt in deinen Plan übernommen: ${formatDateTime(existingCourse.catalogSyncedAt)}`
                : "Noch kein Katalog-Sync-Zeitpunkt gespeichert."}
            </span>
            {formatDateTime(existingCourse.catalogLastScannedAt) ? (
              <span>Katalog zuletzt gescannt: {formatDateTime(existingCourse.catalogLastScannedAt)}</span>
            ) : null}
          </div>
          {existingCourse.catalogStatus !== "missing" ? (
            <button type="button" className="primary-btn" onClick={() => void onRefreshCatalog()} disabled={isBusy}>
              {isRefreshingCatalog ? "Aktualisiere..." : "Termine aus Katalog aktualisieren"}
            </button>
          ) : null}
        </div>
      ) : null}
      <form className="form-grid" onSubmit={onSubmit}>
        <label>
          Kursname
          <input value={name} onChange={(event) => setName(event.target.value)} required disabled={isBusy} />
        </label>
        <label>
          Abkürzung
          <input
            value={abbreviation}
            onChange={(event) => setAbbreviation(event.target.value.slice(0, 15))}
            required
            disabled={isBusy}
          />
        </label>
        <label>
          CP
          <input
            type="number"
            min={0}
            value={cp}
            onChange={(event) => setCp(Number(event.target.value))}
            required
            disabled={isBusy}
          />
        </label>
        <label>
          Kursnummer
          <input
            value={courseNumber}
            onChange={(event) => setCourseNumber(event.target.value)}
            placeholder="z. B. 20-00-1234"
            disabled={isBusy}
          />
        </label>
        <label>
          Kategorie
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} disabled={isBusy}>
            <option value="">Ohne Kategorie</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <small>
            Kategorie fehlt? <Link to="/categories">Neue Kategorie erstellen</Link>
          </small>
        </label>
        <label className="full-width">
          Termine (TUCaN-Format)
          <textarea
            value={appointmentsRaw}
            onChange={(event) => setAppointmentsRaw(event.target.value)}
            rows={14}
            placeholder="Tabellarischen TUCaN-Export einfügen: Nr, Datum, Von, Bis, Raum, Lehrende"
            disabled={isBusy}
          />
        </label>

        {preview ? (
          <div className="preview-box full-width">
            <strong>{preview.count} Termine erkannt</strong>
            <span>
              Zeitraum: {preview.date_from ?? "-"} bis {preview.date_to ?? "-"}
            </span>
            <span>Typen: {preview.types.length > 0 ? preview.types.map(formatAppointmentType).join(", ") : "-"}</span>
          </div>
        ) : null}

        {previewError ? <p className="error-text full-width">{previewError}</p> : null}

        {errorText ? <p className="error-text">{errorText}</p> : null}

        <div className="button-row full-width">
          <button type="submit" className="primary-btn" disabled={isBusy}>
            {isSaving ? "Speichern..." : "Speichern"}
          </button>
          <button type="button" onClick={() => navigate("/")} disabled={isBusy}>
            Abbrechen
          </button>
          {mode === "edit" ? (
            <button type="button" className="danger-btn" onClick={onDelete} disabled={isBusy}>
              {isDeleting ? "Löschen..." : "Kurs löschen"}
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
