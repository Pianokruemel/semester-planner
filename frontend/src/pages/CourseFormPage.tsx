import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { formatAppointmentType } from "../api/types";
import { useCategories } from "../hooks/useCategories";
import { useCourses } from "../hooks/useCourses";
import { useCreateCourse, useDeleteCourse, useUpdateCourse } from "../hooks/useCourseMutations";
import { formatAppointmentsForTextarea, summarizeAppointments } from "../planner/appointmentParser";

type Props = {
  mode: "create" | "edit";
};

export function CourseFormPage({ mode }: Props) {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: categories = [] } = useCategories();
  const { data: courses = [], isLoading: isLoadingCourses } = useCourses();
  const createCourse = useCreateCourse();
  const updateCourse = useUpdateCourse();
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
  const [appointmentsRaw, setAppointmentsRaw] = useState("");
  const [errorText, setErrorText] = useState("");
  const [preview, setPreview] = useState<ReturnType<typeof summarizeAppointments> | null>(null);
  const [previewError, setPreviewError] = useState("");
  const isSaving = createCourse.isPending || updateCourse.isPending;
  const isDeleting = deleteCourse.isPending;
  const isBusy = isSaving || isDeleting || (mode === "edit" && isLoadingCourses);

  useEffect(() => {
    if (!existingCourse) {
      return;
    }

    setName(existingCourse.name);
    setAbbreviation(existingCourse.abbreviation);
    setCp(existingCourse.cp);
    setCategoryId(existingCourse.categoryId ?? "");
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
          appointments_raw: appointmentsRaw
        });
      } else if (id) {
        await updateCourse.mutateAsync({
          id,
          name,
          abbreviation,
          cp,
          category_id: categoryId || null,
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
            min={1}
            value={cp}
            onChange={(event) => setCp(Number(event.target.value))}
            required
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
