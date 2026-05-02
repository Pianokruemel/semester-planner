import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CatalogCourseCard,
  CatalogCourseDetail,
  CatalogSmallGroup,
  CatalogSmallGroupAppointment,
  fetchCatalogCourse,
  searchCatalogCourses
} from "../api/catalog";
import { usePlannerStore } from "../planner/store";

function formatDateRange(course: Pick<CatalogCourseCard, "first_date" | "last_date">) {
  if (!course.first_date && !course.last_date) {
    return "Keine Termine";
  }

  if (course.first_date === course.last_date) {
    return course.first_date;
  }

  return `${course.first_date ?? "?"} bis ${course.last_date ?? "?"}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0) : [];
}

function normalizeSmallGroupAppointments(value: unknown): CatalogSmallGroupAppointment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry): CatalogSmallGroupAppointment[] => {
    if (!isRecord(entry)) {
      return [];
    }

    if (
      typeof entry.date !== "string" ||
      typeof entry.time_from !== "string" ||
      typeof entry.time_to !== "string" ||
      typeof entry.room !== "string"
    ) {
      return [];
    }

    return [
      {
        date: entry.date,
        time_from: entry.time_from,
        time_to: entry.time_to,
        room: entry.room,
        type: typeof entry.type === "string" ? entry.type : "Uebung",
        position: typeof entry.position === "number" ? entry.position : undefined
      }
    ];
  });
}

function normalizeAppointmentInstructors(value: unknown): Array<{ position: number; instructors: string[] }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.position !== "number") {
      return [];
    }

    return [{ position: entry.position, instructors: normalizeStringArray(entry.instructors) }];
  });
}

function smallGroupsFromCourse(course: CatalogCourseDetail | null): CatalogSmallGroup[] {
  const details = course?.details_json;
  if (!isRecord(details) || !Array.isArray(details.small_groups)) {
    return [];
  }

  return details.small_groups.flatMap((entry): CatalogSmallGroup[] => {
    if (!isRecord(entry) || typeof entry.title !== "string" || !entry.title.trim()) {
      return [];
    }

    const key = typeof entry.key === "string" && entry.key.trim() ? entry.key : entry.title;
    return [
      {
        key,
        title: entry.title,
        instructors: normalizeStringArray(entry.instructors),
        schedule: typeof entry.schedule === "string" ? entry.schedule : "",
        appointments: normalizeSmallGroupAppointments(entry.appointments),
        appointment_instructors: normalizeAppointmentInstructors(entry.appointment_instructors)
      }
    ];
  });
}

function appointmentInstructors(group: CatalogSmallGroup, position: number) {
  return group.appointment_instructors.find((entry) => entry.position === position)?.instructors ?? group.instructors;
}

function appointmentTimePlaceKey(appointment: {
  date: string;
  time_from: string;
  time_to: string;
  room: string;
}) {
  return [appointment.date, appointment.time_from, appointment.time_to, appointment.room].join("|");
}

export function CatalogPage() {
  const navigate = useNavigate();
  const { importCatalogCourse } = usePlannerStore();
  const [query, setQuery] = useState("");
  const [courses, setCourses] = useState<CatalogCourseCard[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<CatalogCourseDetail | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [isCpPromptVisible, setIsCpPromptVisible] = useState(false);
  const [cpOverride, setCpOverride] = useState("6");
  const [selectedSubgroupKey, setSelectedSubgroupKey] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsSearching(true);
      setErrorText("");
      void searchCatalogCourses({ q: query, limit: 25 })
        .then((result) => setCourses(result.items))
        .catch((error) => setErrorText(error instanceof Error ? error.message : "Katalogsuche fehlgeschlagen."))
        .finally(() => setIsSearching(false));
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query]);

  async function openDetail(courseId: string) {
    setErrorText("");
    setIsCpPromptVisible(false);
    setCpOverride("6");
    try {
      const course = await fetchCatalogCourse(courseId);
      const groups = smallGroupsFromCourse(course);
      setSelectedCourse(course);
      setSelectedSubgroupKey(groups[0]?.key ?? null);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Katalogkurs konnte nicht geladen werden.");
    }
  }

  async function importSelectedCourse() {
    if (!selectedCourse) {
      return;
    }

    const needsCpOverride = selectedCourse.cp == null || selectedCourse.cp <= 0;
    if (needsCpOverride && !isCpPromptVisible) {
      setIsCpPromptVisible(true);
      return;
    }

    const parsedCpOverride = Number(cpOverride);
    if (needsCpOverride && (!Number.isInteger(parsedCpOverride) || parsedCpOverride <= 0)) {
      setErrorText("Bitte gültige CP größer als 0 eingeben.");
      return;
    }

    setIsImporting(true);
    setErrorText("");

    try {
      const result = await importCatalogCourse({
        catalog_course_id: selectedCourse.id,
        selected_subgroup_key: selectedSubgroupKey,
        ...(needsCpOverride ? { cp_override: parsedCpOverride } : {})
      });
      navigate(`/courses/${result.courseId}/edit`);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Katalogkurs konnte nicht importiert werden.");
    } finally {
      setIsImporting(false);
    }
  }

  const baseAppointmentKeys = new Set(selectedCourse?.appointments.map(appointmentTimePlaceKey) ?? []);
  const smallGroups = smallGroupsFromCourse(selectedCourse).map((group) => ({
    ...group,
    appointments: group.appointments.filter((appointment) => !baseAppointmentKeys.has(appointmentTimePlaceKey(appointment)))
  }));
  const selectedSubgroup = smallGroups.find((group) => group.key === selectedSubgroupKey) ?? null;

  return (
    <div className="catalog-layout">
      <section className="page-card catalog-search-panel">
        <h2>Katalog</h2>
        <p className="page-intro">Suche öffentliche TUCaN-Veranstaltungen und füge sie deinem Plan hinzu.</p>
        <label className="full-width">
          Suche
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Titel, Kursnummer, Dozent, Fachbereich"
          />
        </label>
        {isSearching ? <p className="page-intro">Suche läuft...</p> : null}
        {errorText ? <p className="error-text">{errorText}</p> : null}
        <div className="catalog-result-list">
          {courses.map((course) => (
            <button key={course.id} type="button" className="catalog-result" onClick={() => void openDetail(course.id)}>
              <strong>{course.title}</strong>
              <span>{[course.course_number, course.semester_key, course.faculty].filter(Boolean).join(" | ")}</span>
              <span>{course.instructors.join(", ") || "Keine Lehrenden erfasst"}</span>
              <span>
                {course.appointment_count} Termine · {formatDateRange(course)}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="page-card catalog-detail-panel">
        {selectedCourse ? (
          <>
            <div className="page-section">
              <div>
                <h2>{selectedCourse.title}</h2>
                <p className="page-intro">
                  {[selectedCourse.course_number, selectedCourse.semester_key, selectedCourse.faculty].filter(Boolean).join(" | ")}
                </p>
                <p className="page-intro">{selectedCourse.path.join(" / ")}</p>
                <p className="page-intro">{selectedCourse.instructors.join(", ") || "Keine Lehrenden erfasst"}</p>
                <p className="page-intro">CP: {selectedCourse.cp && selectedCourse.cp > 0 ? selectedCourse.cp : "fehlt"}</p>
              </div>
              <div className="catalog-import-actions">
                {isCpPromptVisible ? (
                  <label>
                    CP
                    <input
                      type="number"
                      min={1}
                      value={cpOverride}
                      onChange={(event) => setCpOverride(event.target.value)}
                      disabled={isImporting}
                    />
                  </label>
                ) : null}
                <button type="button" className="primary-btn" onClick={() => void importSelectedCourse()} disabled={isImporting}>
                  {isImporting ? "Importiere..." : isCpPromptVisible ? "CP bestätigen und hinzufügen" : "Zum Plan hinzufügen"}
                </button>
              </div>
            </div>
            {smallGroups.length > 0 ? (
              <div className="catalog-subgroup-section">
                <h3>Übungsgruppe</h3>
                <div className="catalog-subgroup-list">
                  <label className={`catalog-subgroup-option ${selectedSubgroupKey === null ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name="catalog-subgroup"
                      checked={selectedSubgroupKey === null}
                      onChange={() => setSelectedSubgroupKey(null)}
                    />
                    <span>
                      <strong>Nur Vorlesung</strong>
                      <small>Keine Übung importieren</small>
                    </span>
                  </label>
                  {smallGroups.map((group) => (
                    <label
                      key={group.key}
                      className={`catalog-subgroup-option ${selectedSubgroupKey === group.key ? "selected" : ""}`}
                    >
                      <input
                        type="radio"
                        name="catalog-subgroup"
                        checked={selectedSubgroupKey === group.key}
                        onChange={() => setSelectedSubgroupKey(group.key)}
                      />
                      <span>
                        <strong>{group.title}</strong>
                        <small>{group.schedule || "Termine siehe Detailtabelle"}</small>
                        <small>{group.instructors.join(", ") || "Keine Lehrenden erfasst"}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="table-scroll">
              <table className="exam-preview-table">
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Zeit</th>
                    <th>Raum</th>
                    <th>Typ</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedCourse.appointments.map((appointment) => (
                    <tr key={appointment.id}>
                      <td>{appointment.date}</td>
                      <td>
                        {appointment.time_from}-{appointment.time_to}
                      </td>
                      <td>{appointment.room}</td>
                      <td>{appointment.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selectedSubgroup ? (
              <div className="table-scroll catalog-subgroup-appointments">
                <table className="exam-preview-table">
                  <thead>
                    <tr>
                      <th>Übungsgruppe</th>
                      <th>Datum</th>
                      <th>Zeit</th>
                      <th>Raum</th>
                      <th>Lehrende</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSubgroup.appointments.length > 0 ? (
                      selectedSubgroup.appointments.map((appointment, index) => (
                        <tr key={`${selectedSubgroup.key}-${appointment.date}-${appointment.time_from}-${index}`}>
                          <td>{selectedSubgroup.title}</td>
                          <td>{appointment.date}</td>
                          <td>
                            {appointment.time_from}-{appointment.time_to}
                          </td>
                          <td>{appointment.room}</td>
                          <td>{appointmentInstructors(selectedSubgroup, appointment.position ?? index).join(", ") || "Keine Lehrenden erfasst"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td>{selectedSubgroup.title}</td>
                        <td colSpan={4}>{selectedSubgroup.schedule || "Keine Termine erfasst"}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <h2>Kurs auswählen</h2>
            <p className="page-intro">Wähle ein Suchergebnis aus, um Details und Termine zu sehen.</p>
          </>
        )}
      </section>
    </div>
  );
}
