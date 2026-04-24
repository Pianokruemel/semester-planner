import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SnapshotExam } from "../api/types";
import { useCourses } from "../hooks/useCourses";
import { useLocalMutation } from "../hooks/useLocalMutation";
import { buildExamConflictMap, type ExamConflictSeverity } from "../planner/examConflicts";
import {
  buildExamImportPreview,
  parseExamWorkbook,
  type ExamImportPreviewRow,
  type ParsedExamImportRow
} from "../planner/examImport";
import { usePlannerStore } from "../planner/store";

function compareExamDates(left: SnapshotExam, right: SnapshotExam): number {
  return `${left.date}:${left.time_from}:${left.time_to}`.localeCompare(`${right.date}:${right.time_from}:${right.time_to}`);
}

function formatExamDate(date: string, timeFrom: string, timeTo: string): string {
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year} · ${timeFrom}-${timeTo} Uhr`;
}

function getConflictLabel(severity: ExamConflictSeverity): string {
  if (severity === "red") {
    return "Rot";
  }

  if (severity === "orange") {
    return "Orange";
  }

  if (severity === "yellow") {
    return "Gelb";
  }

  return "Gruen";
}

function getImportStatusLabel(row: ExamImportPreviewRow): string {
  if (row.status === "matched") {
    return "Treffer";
  }

  if (row.status === "ambiguous") {
    return "Mehrdeutig";
  }

  if (row.status === "invalid") {
    return "Ungueltig";
  }

  return "Ohne Treffer";
}

export function ExamsPage() {
  const { data: courses = [] } = useCourses();
  const { setCourseExam, clearCourseExam, applyImportedExams } = usePlannerStore();
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [manualDate, setManualDate] = useState("");
  const [manualTimeFrom, setManualTimeFrom] = useState("");
  const [manualTimeTo, setManualTimeTo] = useState("");
  const [manualError, setManualError] = useState("");
  const [manualNotice, setManualNotice] = useState("");
  const [importError, setImportError] = useState("");
  const [importNotice, setImportNotice] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [parsedImportRows, setParsedImportRows] = useState<ParsedExamImportRow[]>([]);
  const saveExamMutation = useLocalMutation(async (payload: { courseId: string; exam: SnapshotExam }) =>
    setCourseExam(payload.courseId, payload.exam)
  );
  const clearExamMutation = useLocalMutation(async (courseId: string) => clearCourseExam(courseId));
  const importExamMutation = useLocalMutation(
    async (payload: Array<{ courseId: string; exam: SnapshotExam }>) => applyImportedExams(payload)
  );

  const sortedCourses = useMemo(() => {
    return [...courses].sort((left, right) => {
      if (left.isActive !== right.isActive) {
        return left.isActive ? -1 : 1;
      }

      return left.name.localeCompare(right.name, "de");
    });
  }, [courses]);

  const savedExamCourses = useMemo(() => {
    return sortedCourses
      .filter((course) => course.exam)
      .sort((left, right) => {
        if (!left.exam || !right.exam) {
          return 0;
        }

        return compareExamDates(
          {
            date: left.exam.date,
            time_from: left.exam.timeFrom,
            time_to: left.exam.timeTo
          },
          {
            date: right.exam.date,
            time_from: right.exam.timeFrom,
            time_to: right.exam.timeTo
          }
        );
      });
  }, [sortedCourses]);

  const selectedCourse = useMemo(
    () => sortedCourses.find((course) => course.id === selectedCourseId) ?? null,
    [selectedCourseId, sortedCourses]
  );

  const conflictMap = useMemo(() => buildExamConflictMap(courses), [courses]);
  const previewRows = useMemo(() => buildExamImportPreview(parsedImportRows, courses), [parsedImportRows, courses]);
  const matchedRows = useMemo(
    () => previewRows.filter((row) => row.status === "matched" && row.matchedCourseId && row.candidateExam),
    [previewRows]
  );

  useEffect(() => {
    if (sortedCourses.length === 0) {
      setSelectedCourseId("");
      return;
    }

    if (!selectedCourseId || !sortedCourses.some((course) => course.id === selectedCourseId)) {
      setSelectedCourseId(sortedCourses[0].id);
    }
  }, [selectedCourseId, sortedCourses]);

  useEffect(() => {
    if (!selectedCourse) {
      setManualDate("");
      setManualTimeFrom("");
      setManualTimeTo("");
      return;
    }

    setManualDate(selectedCourse.exam?.date ?? "");
    setManualTimeFrom(selectedCourse.exam?.timeFrom ?? "");
    setManualTimeTo(selectedCourse.exam?.timeTo ?? "");
  }, [selectedCourse]);

  async function handleWorkbookUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setImportError("");
    setImportNotice("");

    try {
      const rows = await parseExamWorkbook(file);
      setParsedImportRows(rows);
      setImportFileName(file.name);

      if (rows.length === 0) {
        setImportNotice("Keine Datenzeilen im Arbeitsblatt gefunden.");
      }
    } catch (error) {
      setParsedImportRows([]);
      setImportFileName("");
      setImportError(error instanceof Error ? error.message : "Excel-Datei konnte nicht gelesen werden.");
    } finally {
      event.target.value = "";
    }
  }

  async function handleImportMatchedRows() {
    if (matchedRows.length === 0) {
      setImportError("Es gibt keine eindeutigen Treffer zum Importieren.");
      return;
    }

    if (
      matchedRows.some((row) => row.overwritesExistingExam) &&
      !window.confirm("Vorhandene Prüfungen werden überschrieben. Fortfahren?")
    ) {
      return;
    }

    setImportError("");

    await importExamMutation.mutateAsync(
      matchedRows.flatMap((row) =>
        row.matchedCourseId && row.candidateExam
          ? [
              {
                courseId: row.matchedCourseId,
                exam: row.candidateExam
              }
            ]
          : []
      )
    );

    setImportNotice(`${matchedRows.length} Prüfungen importiert.`);
  }

  async function handleImportSingleRow(row: ExamImportPreviewRow) {
    if (!row.matchedCourseId || !row.candidateExam) {
      return;
    }

    const needsConfirmation = row.status === "ambiguous" || row.overwritesExistingExam;

    if (needsConfirmation && !window.confirm("Diese Prüfungszeile speichern und vorhandene Werte überschreiben?")) {
      return;
    }

    setImportError("");
    await importExamMutation.mutateAsync([
      {
        courseId: row.matchedCourseId,
        exam: row.candidateExam
      }
    ]);
    setImportNotice(`Prüfung für ${row.matchedCourses[0]?.name ?? "den Kurs"} gespeichert.`);
  }

  async function handleManualSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setManualError("");
    setManualNotice("");

    if (!selectedCourse) {
      setManualError("Bitte zuerst einen Kurs auswählen.");
      return;
    }

    if (!manualDate || !manualTimeFrom || !manualTimeTo) {
      setManualError("Datum, Beginn und Ende sind Pflichtfelder.");
      return;
    }

    if (manualTimeTo <= manualTimeFrom) {
      setManualError("Das Ende muss nach dem Beginn liegen.");
      return;
    }

    try {
      await saveExamMutation.mutateAsync({
        courseId: selectedCourse.id,
        exam: {
          date: manualDate,
          time_from: manualTimeFrom,
          time_to: manualTimeTo
        }
      });
      setManualNotice("Prüfung gespeichert.");
    } catch (error) {
      setManualError(error instanceof Error ? error.message : "Prüfung konnte nicht gespeichert werden.");
    }
  }

  async function handleClearManualExam() {
    if (!selectedCourse) {
      return;
    }

    setManualError("");
    setManualNotice("");

    try {
      await clearExamMutation.mutateAsync(selectedCourse.id);
      setManualDate("");
      setManualTimeFrom("");
      setManualTimeTo("");
      setManualNotice("Prüfung entfernt.");
    } catch (error) {
      setManualError(error instanceof Error ? error.message : "Prüfung konnte nicht entfernt werden.");
    }
  }

  if (courses.length === 0) {
    return (
      <section className="page-card">
        <h2>Prüfungen</h2>
        <p className="page-intro">Lege zuerst einen Kurs an, damit Prüfungen einem Fach zugeordnet werden können.</p>
        <div className="button-row full-width">
          <Link className="primary-btn" to="/courses/new">
            Kurs erstellen
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="section-stack">
      <section className="page-card">
        <h2>Prüfungen</h2>
        <p className="page-intro">
          Lade eine Excel-Datei hoch oder pflege Prüfungstermine manuell pro Kurs. Konflikte werden nur aus aktiven Kursen
          berechnet.
        </p>
      </section>

      <section className="page-card page-section">
        <div>
          <h2>Import</h2>
          <p className="page-intro">
            Erwartete Spalten: Wochentag, Datum, Beginn, Ende, Terminart (Veranstaltungsart), DozentIn,
            Veranstaltungsname.
          </p>
        </div>
        <div className="button-row">
          <label className="import-label">
            Excel-Datei auswählen
            <input type="file" accept=".xlsx,.xls" onChange={(event) => void handleWorkbookUpload(event)} />
          </label>
          <button
            type="button"
            className="primary-btn"
            onClick={() => void handleImportMatchedRows()}
            disabled={matchedRows.length === 0 || importExamMutation.isPending}
          >
            {importExamMutation.isPending ? "Importiere..." : `Eindeutige Treffer importieren (${matchedRows.length})`}
          </button>
        </div>
        {importFileName ? <p className="page-intro">Geladen: {importFileName}</p> : null}
        {importError ? <p className="error-text">{importError}</p> : null}
        {importNotice ? <p className="status-text">{importNotice}</p> : null}
        {previewRows.length > 0 ? (
          <div className="table-scroll">
            <table className="exam-preview-table">
              <thead>
                <tr>
                  <th>Zeile</th>
                  <th>Veranstaltung</th>
                  <th>Kursnummern</th>
                  <th>Zuordnung</th>
                  <th>Termin</th>
                  <th>Status</th>
                  <th>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr key={`${row.rowNumber}:${row.courseName}`}>
                    <td>{row.rowNumber}</td>
                    <td>
                      <strong>{row.courseName}</strong>
                      <span className="muted-text">{row.appointmentType ?? "Unbekannte Terminart"}</span>
                    </td>
                    <td>{row.normalizedCourseNumbers.length > 0 ? row.normalizedCourseNumbers.join(", ") : "-"}</td>
                    <td>
                      {row.matchedCourses.length > 0
                        ? row.matchedCourses.map((course) => course.name).join(", ")
                        : "Kein Kurs"}
                    </td>
                    <td>{row.date && row.timeFrom && row.timeTo ? formatExamDate(row.date, row.timeFrom, row.timeTo) : "-"}</td>
                    <td>
                      <strong>{getImportStatusLabel(row)}</strong>
                      <span className="muted-text">{row.message}</span>
                    </td>
                    <td>
                      {row.matchedCourseId && row.candidateExam && row.status === "ambiguous" ? (
                        <button type="button" onClick={() => void handleImportSingleRow(row)} disabled={importExamMutation.isPending}>
                          Diese Zeile übernehmen
                        </button>
                      ) : row.status === "matched" ? (
                        <span className="muted-text">Wird mit Sammelimport übernommen</span>
                      ) : (
                        <span className="muted-text">Nur Vorschau</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="page-card page-section">
        <div>
          <h2>Gespeicherte Prüfungen</h2>
          <p className="page-intro">Inaktive Kurse bleiben sichtbar, werden aber nicht in die Konfliktbewertung einbezogen.</p>
        </div>
        {savedExamCourses.length === 0 ? (
          <p className="page-intro">Noch keine Prüfungen gespeichert.</p>
        ) : (
          <div className="exam-list">
            {savedExamCourses.map((course) => {
              if (!course.exam) {
                return null;
              }

              const conflict = course.isActive ? conflictMap.get(course.id) : null;
              const severity = course.isActive ? conflict?.severity ?? "green" : null;

              return (
                <article key={course.id} className={`exam-card${course.isActive ? "" : " exam-card-muted"}`}>
                  <div className="exam-card-head">
                    <div>
                      <h3>{course.name}</h3>
                      <p className="page-intro">{course.courseNumber ? `Kursnummer: ${course.courseNumber}` : "Keine Kursnummer hinterlegt"}</p>
                    </div>
                    <span className={`exam-badge${severity ? ` exam-badge-${severity}` : " exam-badge-muted"}`}>
                      {course.isActive && severity ? getConflictLabel(severity) : "Inaktiv"}
                    </span>
                  </div>
                  <strong>{formatExamDate(course.exam.date, course.exam.timeFrom, course.exam.timeTo)}</strong>
                  <p className="page-intro">
                    {course.isActive
                      ? conflict?.explanation ?? "Kein enger Konflikt mit anderen aktiven Prüfungen."
                      : "Dieser Kurs ist inaktiv und beeinflusst die Konfliktbewertung nicht."}
                  </p>
                  <div className="button-row">
                    <button type="button" onClick={() => setSelectedCourseId(course.id)}>
                      Im Formular bearbeiten
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="page-card page-section">
        <div>
          <h2>Manuell pflegen</h2>
          <p className="page-intro">Nutze diese Eingabe für einzelne Prüfungen oder wenn eine Importzeile nicht eindeutig war.</p>
        </div>
        <form className="form-grid" onSubmit={handleManualSubmit}>
          <label className="full-width">
            Kurs
            <select value={selectedCourseId} onChange={(event) => setSelectedCourseId(event.target.value)}>
              {sortedCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                  {course.courseNumber ? ` (${course.courseNumber})` : ""}
                  {course.isActive ? "" : " [inaktiv]"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Datum
            <input type="date" value={manualDate} onChange={(event) => setManualDate(event.target.value)} />
          </label>
          <label>
            Beginn
            <input type="time" value={manualTimeFrom} onChange={(event) => setManualTimeFrom(event.target.value)} />
          </label>
          <label>
            Ende
            <input type="time" value={manualTimeTo} onChange={(event) => setManualTimeTo(event.target.value)} />
          </label>
          {manualError ? <p className="error-text full-width">{manualError}</p> : null}
          {manualNotice ? <p className="status-text full-width">{manualNotice}</p> : null}
          <div className="button-row full-width">
            <button type="submit" className="primary-btn" disabled={saveExamMutation.isPending || clearExamMutation.isPending}>
              {saveExamMutation.isPending ? "Speichere..." : "Prüfung speichern"}
            </button>
            <button
              type="button"
              onClick={() => void handleClearManualExam()}
              disabled={!selectedCourse?.exam || saveExamMutation.isPending || clearExamMutation.isPending}
            >
              {clearExamMutation.isPending ? "Entferne..." : "Prüfung löschen"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}