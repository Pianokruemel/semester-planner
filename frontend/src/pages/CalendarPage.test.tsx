import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSettings, type PlannerAppointment, type PlannerCourse, type Settings } from "../api/types";
import { useCourses, useToggleCourse } from "../hooks/useCourses";
import { useSettings, useUpdateSettings } from "../hooks/useSettings";
import { CalendarPage } from "./CalendarPage";

let lastCalendarProps: Record<string, unknown> | null = null;

vi.mock("react-big-calendar", () => ({
  Calendar: (props: Record<string, unknown>) => {
    lastCalendarProps = props;
    return <div data-testid="calendar-view">{String(props.view)}</div>;
  },
  Views: {
    WEEK: "week",
    WORK_WEEK: "work_week",
    DAY: "day",
    MONTH: "month"
  },
  dayjsLocalizer: vi.fn(() => ({}))
}));

vi.mock("../hooks/useCourses", () => ({
  useCourses: vi.fn(),
  useToggleCourse: vi.fn()
}));

vi.mock("../hooks/useSettings", () => ({
  useSettings: vi.fn(),
  useUpdateSettings: vi.fn()
}));

const mockedUseCourses = vi.mocked(useCourses);
const mockedUseToggleCourse = vi.mocked(useToggleCourse);
const mockedUseSettings = vi.mocked(useSettings);
const mockedUseUpdateSettings = vi.mocked(useUpdateSettings);

const toggleCourse = vi.fn();
const mutateSettings = vi.fn();

function makeAppointment(overrides: Partial<PlannerAppointment>): PlannerAppointment {
  return {
    id: overrides.id ?? "appointment-1",
    courseId: overrides.courseId ?? "course-1",
    date: overrides.date ?? "2026-04-27",
    timeFrom: overrides.timeFrom ?? "08:00",
    timeTo: overrides.timeTo ?? "09:30",
    room: overrides.room ?? "S 1.01",
    type: overrides.type ?? "Vorlesung"
  };
}

function makeCourse(overrides: Partial<PlannerCourse> = {}): PlannerCourse {
  return {
    id: overrides.id ?? "course-1",
    name: overrides.name ?? "Softwaretechnik",
    abbreviation: overrides.abbreviation ?? "SWT",
    cp: overrides.cp ?? 5,
    categoryId: overrides.categoryId ?? null,
    courseNumber: overrides.courseNumber ?? null,
    isActive: overrides.isActive ?? true,
    category: overrides.category ?? null,
    exam: overrides.exam ?? null,
    appointments: overrides.appointments ?? [makeAppointment({})]
  };
}

function setup({ courses = [], settings = defaultSettings }: { courses?: PlannerCourse[]; settings?: Settings } = {}) {
  mockedUseCourses.mockReturnValue({
    data: courses,
    isLoading: false
  });
  mockedUseToggleCourse.mockReturnValue({
    mutate: toggleCourse,
    mutateAsync: vi.fn().mockResolvedValue(undefined)
  });
  mockedUseSettings.mockReturnValue({
    data: settings,
    isLoading: false
  });
  mockedUseUpdateSettings.mockReturnValue({
    isPending: false,
    mutate: mutateSettings,
    mutateAsync: vi.fn().mockResolvedValue(settings)
  } as ReturnType<typeof useUpdateSettings>);
}

function renderCalendarPage() {
  return render(
    <MemoryRouter>
      <CalendarPage showFullName={false} />
    </MemoryRouter>
  );
}

describe("CalendarPage week view", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 27, 9, 0, 0));
    vi.clearAllMocks();
    lastCalendarProps = null;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("defaults to a Monday-Friday work week when no visible weekend lecture exists", () => {
    setup({
      courses: [
        makeCourse({
          appointments: [
            makeAppointment({ id: "weekday-lecture", date: "2026-04-28", type: "Vorlesung" }),
            makeAppointment({ id: "weekday-exercise", date: "2026-04-30", type: "Uebung" })
          ]
        })
      ]
    });

    renderCalendarPage();

    expect(screen.getByTestId("calendar-view")).toHaveTextContent("work_week");
    expect(screen.getByText("27.04. - 01.05.2026")).toBeInTheDocument();
    expect(lastCalendarProps?.view).toBe("work_week");
  });

  it("expands to the full Monday-Sunday week when a visible Sunday lecture exists", () => {
    setup({
      courses: [
        makeCourse({
          appointments: [
            makeAppointment({ id: "weekday-lecture", date: "2026-04-28", type: "Vorlesung" }),
            makeAppointment({ id: "sunday-lecture", date: "2026-05-03", type: "Vorlesung" })
          ]
        })
      ]
    });

    renderCalendarPage();

    expect(screen.getByTestId("calendar-view")).toHaveTextContent("week");
    expect(screen.getByText("27.04. - 03.05.2026")).toBeInTheDocument();
    expect(lastCalendarProps?.view).toBe("week");
  });

  it("keeps the work-week layout when weekend lectures are hidden by filters", async () => {
    setup({
      courses: [
        makeCourse({
          appointments: [makeAppointment({ id: "saturday-lecture", date: "2026-05-02", type: "Vorlesung" })]
        })
      ],
      settings: {
        ...defaultSettings,
        active_filters: {
          ...defaultSettings.active_filters,
          hideTypes: ["Vorlesung"]
        }
      }
    });

    renderCalendarPage();

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("calendar-view")).toHaveTextContent("work_week");
    expect(screen.getByText("27.04. - 01.05.2026")).toBeInTheDocument();
    expect(lastCalendarProps?.view).toBe("work_week");
  });

  it("ignores weekend lectures from inactive courses", () => {
    setup({
      courses: [
        makeCourse({
          id: "inactive-weekend-course",
          isActive: false,
          appointments: [makeAppointment({ id: "inactive-saturday", date: "2026-05-02", type: "Vorlesung" })]
        }),
        makeCourse({
          id: "active-weekday-course",
          appointments: [makeAppointment({ id: "active-weekday", date: "2026-04-29", type: "Vorlesung" })]
        })
      ]
    });

    renderCalendarPage();

    expect(screen.getByTestId("calendar-view")).toHaveTextContent("work_week");
    expect(screen.getByText("27.04. - 01.05.2026")).toBeInTheDocument();
    expect(lastCalendarProps?.view).toBe("work_week");
  });
});