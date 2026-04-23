import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, View, Views, dayjsLocalizer } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { AppointmentType } from "../api/types";
import { useCourses, useToggleCourse } from "../hooks/useCourses";
import { useSettings, useUpdateSettings } from "../hooks/useSettings";
import { ExportAppointment, buildIcs } from "../planner/icsExporter";

const localizer = dayjsLocalizer(dayjs);

type Props = {
  showFullName: boolean;
};

type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  courseId: string;
  color: string;
  room: string;
  type: AppointmentType;
};

function parseLocalDateParts(date: string) {
  const [year, month, day] = date.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return { year, month: month - 1, day };
}

function parseLocalTimeParts(time: string) {
  const [hour, minute] = time.split(":").map(Number);

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return null;
  }

  return { hour, minute };
}

export function CalendarPage({ showFullName }: Props) {
  const navigate = useNavigate();
  const { data: courses = [], isLoading } = useCourses();
  const toggleCourse = useToggleCourse();
  const { data: settings } = useSettings();
  const { mutate: patchSettings } = useUpdateSettings();
  const [selectedCps, setSelectedCps] = useState<number[]>([]);
  const [hideTypes, setHideTypes] = useState<AppointmentType[]>([]);
  const [showRoom, setShowRoom] = useState(true);
  const [showType, setShowType] = useState(true);
  const [showTime, setShowTime] = useState(true);
  const [showTotalCp, setShowTotalCp] = useState(true);
  const [view, setView] = useState<"week" | "day" | "month">("week");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [actionStatus, setActionStatus] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const hasHydratedFilters = useRef(false);
  const lastSavedFiltersKey = useRef("");
  const showFullNameSetting = settings?.show_full_name === true;

  useEffect(() => {
    if (!isFilterOpen) {
      return;
    }

    // Only disable scrolling on mobile/tablet (<1000px) where sidebar is a fixed overlay
    const isNarrowViewport = window.innerWidth < 1000;
    if (!isNarrowViewport) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFilterOpen]);

  useEffect(() => {
    if (!settings || hasHydratedFilters.current) {
      return;
    }

    const persisted = settings.active_filters;
    const normalizedFilters = {
      cp: Array.isArray(persisted.cp) ? persisted.cp : [],
      hideTypes: Array.isArray(persisted.hideTypes) ? persisted.hideTypes : [],
      showRoom: typeof persisted.showRoom === "boolean" ? persisted.showRoom : true,
      showType: typeof persisted.showType === "boolean" ? persisted.showType : true,
      showTime: typeof persisted.showTime === "boolean" ? persisted.showTime : true,
      showTotalCp: typeof persisted.showTotalCp === "boolean" ? persisted.showTotalCp : true
    };

    setSelectedCps(normalizedFilters.cp);
    setHideTypes(normalizedFilters.hideTypes);
    setShowRoom(normalizedFilters.showRoom);
    setShowType(normalizedFilters.showType);
    setShowTime(normalizedFilters.showTime);
    setShowTotalCp(normalizedFilters.showTotalCp);
    lastSavedFiltersKey.current = JSON.stringify(normalizedFilters);
    hasHydratedFilters.current = true;
  }, [settings]);

  useEffect(() => {
    if (!hasHydratedFilters.current) {
      return;
    }

    const nextFilters = {
      cp: selectedCps,
      hideTypes,
      showRoom,
      showType,
      showTime,
      showTotalCp
    };
    const nextFiltersKey = JSON.stringify(nextFilters);

    if (nextFiltersKey === lastSavedFiltersKey.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      patchSettings({
        active_filters: nextFilters
      });
      lastSavedFiltersKey.current = nextFiltersKey;
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [hideTypes, patchSettings, selectedCps, showRoom, showTime, showTotalCp, showType]);

  const cpChoices = useMemo(
    () => Array.from(new Set(courses.map((course) => course.cp))).sort((a, b) => a - b),
    [courses]
  );

  const totalSelectedCp = useMemo(() => {
    return courses
      .filter((course) => course.isActive)
      .filter((course) => selectedCps.length === 0 || selectedCps.includes(course.cp))
      .reduce((sum, course) => sum + course.cp, 0);
  }, [courses, selectedCps]);

  const events = useMemo(() => {
    return courses
      .filter((course) => course.isActive)
      .filter((course) => selectedCps.length === 0 || selectedCps.includes(course.cp))
      .flatMap((course) =>
        course.appointments
          .filter((appointment) => !hideTypes.includes(appointment.type))
          .map((appointment) => {
            const appointmentDate = parseLocalDateParts(appointment.date);
            const from = parseLocalTimeParts(appointment.timeFrom);
            const to = parseLocalTimeParts(appointment.timeTo);

            if (!appointmentDate || !from || !to) {
              return null;
            }

            const start = new Date(
              appointmentDate.year,
              appointmentDate.month,
              appointmentDate.day,
              from.hour,
              from.minute,
              0,
              0
            );
            const end = new Date(
              appointmentDate.year,
              appointmentDate.month,
              appointmentDate.day,
              to.hour,
              to.minute,
              0,
              0
            );

            const fromText = `${String(from.hour).padStart(2, "0")}:${String(from.minute).padStart(2, "0")}`;
            const toText = `${String(to.hour).padStart(2, "0")}:${String(to.minute).padStart(2, "0")}`;

            const label = showFullName ? course.name : course.abbreviation;
            const details = [
              showTime ? `${fromText}-${toText}` : "",
              showRoom ? appointment.room : "",
              showType ? appointment.type : ""
            ]
              .filter(Boolean)
              .join(" | ");

            return {
              id: appointment.id,
              title: details ? `${label} - ${details}` : label,
              start,
              end,
              courseId: course.id,
              color: course.category?.color ?? "#6366F1",
              room: appointment.room,
              type: appointment.type
            } satisfies CalendarEvent;
          })
          .filter((event): event is CalendarEvent => event !== null)
      );
  }, [courses, hideTypes, selectedCps, showFullName, showRoom, showTime, showType]);

  const visibleRangeLabel = useMemo(() => {
    if (view === "day") {
      return dayjs(currentDate).format("dd, DD.MM.YYYY");
    }

    if (view === "week") {
      const start = dayjs(currentDate).startOf("week");
      const end = dayjs(currentDate).endOf("week");
      return `${start.format("DD.MM.")} - ${end.format("DD.MM.YYYY")}`;
    }

    return dayjs(currentDate).format("MMMM YYYY");
  }, [currentDate, view]);

  function navigateCalendar(direction: "prev" | "next" | "today") {
    if (direction === "today") {
      setCurrentDate(new Date());
      return;
    }

    const amount = direction === "next" ? 1 : -1;
    const unit = view === "month" ? "month" : view === "week" ? "week" : "day";
    setCurrentDate((previous) => dayjs(previous).add(amount, unit).toDate());
  }

  function handleEventClick(event: CalendarEvent) {
    navigate(`/courses/${event.courseId}/edit`);
  }

  async function exportIcs() {
    setActionStatus("");
    try {
      const appointments: ExportAppointment[] = courses
        .filter((course) => course.isActive)
        .filter((course) => selectedCps.length === 0 || selectedCps.includes(course.cp))
        .flatMap((course) =>
          course.appointments
            .filter((appointment) => !hideTypes.includes(appointment.type))
            .map((appointment) => ({
              id: appointment.id,
              courseName: course.name,
              courseAbbreviation: course.abbreviation,
              cp: course.cp,
              categoryName: course.category?.name ?? null,
              date: appointment.date,
              timeFrom: appointment.timeFrom,
              timeTo: appointment.timeTo,
              room: appointment.room
            }))
        );

      if (appointments.length === 0) {
        throw new Error("Keine Termine fuer den Export gefunden.");
      }

      const blob = new Blob([buildIcs(appointments, showFullName)], { type: "text/calendar;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "stundenplan.ics";
      link.click();
      window.URL.revokeObjectURL(url);
      setActionStatus("ICS Export erstellt.");
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : "ICS Export fehlgeschlagen.");
    }
  }

  return (
    <section className="calendar-layout">
      <button type="button" className="mobile-filter-toggle" onClick={() => setIsFilterOpen(true)}>
        Filter anzeigen
      </button>

      <div
        className={`sidebar-overlay ${isFilterOpen ? "open" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => setIsFilterOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
            setIsFilterOpen(false);
          }
        }}
      />

      <aside className={`sidebar-card responsive-sidebar ${isFilterOpen ? "open" : ""}`}>
        <div className="sidebar-top">
          <h2>Filter</h2>
          <button type="button" className="close-sidebar" onClick={() => setIsFilterOpen(false)}>
            Schliessen
          </button>
        </div>

        <div className="filter-group">
          <h3>Kurse</h3>
          {courses.map((course) => (
            <label key={course.id} className="check-row">
              <span className="color-dot" style={{ backgroundColor: course.category?.color ?? "#64748B" }} />
              <input
                type="checkbox"
                checked={course.isActive}
                onChange={() => {
                  toggleCourse.mutate(course.id);
                }}
              />
              <span>{course.name}</span>
            </label>
          ))}
        </div>

        <div className="filter-group">
          <h3>CP</h3>
          {cpChoices.map((cp) => (
            <label key={cp} className="check-row">
              <input
                type="checkbox"
                checked={selectedCps.includes(cp)}
                onChange={() => {
                  setSelectedCps((current) =>
                    current.includes(cp) ? current.filter((value) => value !== cp) : [...current, cp]
                  );
                }}
              />
              <span>{cp} CP</span>
            </label>
          ))}
        </div>

        <div className="filter-group">
          <h3>Typ</h3>
          {(["Vorlesung", "Uebung"] as AppointmentType[]).map((type) => (
            <label key={type} className="check-row">
              <input
                type="checkbox"
                checked={hideTypes.includes(type)}
                onChange={() => {
                  setHideTypes((current) =>
                    current.includes(type) ? current.filter((value) => value !== type) : [...current, type]
                  );
                }}
              />
              <span>{type} ausblenden</span>
            </label>
          ))}
        </div>

        <div className="filter-group">
          <h3>Anzeige</h3>
          <label className="check-row">
            <input
              type="checkbox"
              checked={showFullNameSetting}
              onChange={() =>
                patchSettings({
                  show_full_name: !showFullNameSetting
                })
              }
            />
            <span>Vollen Kursnamen anzeigen</span>
          </label>
          <label className="check-row">
            <input type="checkbox" checked={showRoom} onChange={() => setShowRoom((v) => !v)} />
            <span>Raum anzeigen</span>
          </label>
          <label className="check-row">
            <input type="checkbox" checked={showType} onChange={() => setShowType((v) => !v)} />
            <span>Typ anzeigen</span>
          </label>
          <label className="check-row">
            <input type="checkbox" checked={showTime} onChange={() => setShowTime((v) => !v)} />
            <span>Uhrzeit anzeigen</span>
          </label>
          <label className="check-row">
            <input type="checkbox" checked={showTotalCp} onChange={() => setShowTotalCp((v) => !v)} />
            <span>CP-Summe anzeigen</span>
          </label>
          <div className="filter-actions">
            <button
              type="button"
              onClick={() => {
                setSelectedCps([]);
                setHideTypes([]);
                setShowRoom(true);
                setShowType(true);
                setShowTime(true);
                setShowTotalCp(true);
              }}
            >
              Filter zuruecksetzen
            </button>
          </div>
        </div>

        <div className="filter-group">
          <h3>Aktionen</h3>
          <div className="button-stack">
            <button type="button" className="primary-btn" onClick={() => void exportIcs()}>
              ICS exportieren
            </button>
            <small>Freigabelinks und das Öffnen geteilter Pläne findest du oben in der Kopfzeile.</small>
            {actionStatus ? <small>{actionStatus}</small> : null}
          </div>
        </div>
      </aside>

      <div className="calendar-card">
        <div className="calendar-head">
          <div className="calendar-toolbar-left">
            <button type="button" className="toggle-chip" onClick={() => setIsFilterOpen(true)}>
              Filter
            </button>
            <button type="button" onClick={() => navigateCalendar("prev")}>Zurueck</button>
            <button type="button" onClick={() => navigateCalendar("today")}>Heute</button>
            <button type="button" onClick={() => navigateCalendar("next")}>Weiter</button>
            <span className="calendar-range-label">{visibleRangeLabel}</span>
            {showTotalCp ? <span className="cp-total-badge">Gesamt: {totalSelectedCp} CP</span> : null}
          </div>
          <div className="view-tabs">
            <button type="button" className={view === "week" ? "active" : ""} onClick={() => setView("week")}>
              Woche
            </button>
            <button type="button" className={view === "day" ? "active" : ""} onClick={() => setView("day")}>
              Tag
            </button>
            <button type="button" className={view === "month" ? "active" : ""} onClick={() => setView("month")}>
              Monat
            </button>
          </div>
        </div>
        <p className="page-intro">Plane deine Woche, blende Termine gezielt aus und exportiere die aktuelle Ansicht.</p>

        {isLoading ? (
          <p>Lade Kurse...</p>
        ) : (
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            titleAccessor="title"
            style={{ height: "76vh" }}
            toolbar={false}
            date={currentDate}
            view={view}
            onNavigate={(nextDate: Date) => setCurrentDate(nextDate)}
            onView={(newView: View) => setView(newView as "week" | "day" | "month")}
            onSelectEvent={handleEventClick}
            views={[Views.WEEK, Views.DAY, Views.MONTH]}
            min={new Date(1970, 1, 1, 7, 0, 0)}
            max={new Date(1970, 1, 1, 20, 0, 0)}
            formats={{
              timeGutterFormat: "HH:mm",
              eventTimeRangeFormat: ({ start, end }) =>
                `${dayjs(start).format("HH:mm")} - ${dayjs(end).format("HH:mm")}`
            }}
            eventPropGetter={(event: CalendarEvent) => ({
              style: {
                backgroundColor: event.color,
                borderRadius: "10px",
                border: "none",
                color: "#ffffff",
                cursor: "pointer"
              }
            })}
          />
        )}

        {actionStatus ? <p className="status-text">{actionStatus}</p> : null}
      </div>
    </section>
  );
}
