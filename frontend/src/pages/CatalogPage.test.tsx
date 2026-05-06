import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchCatalogCourse,
  fetchCatalogProgrammes,
  searchCatalogCourses,
  type CatalogCourseCard,
  type CatalogCourseDetail
} from "../api/catalog";
import { usePlannerStore } from "../planner/store";
import { CatalogPage } from "./CatalogPage";

vi.mock("../api/catalog", () => ({
  searchCatalogCourses: vi.fn(),
  fetchCatalogCourse: vi.fn(),
  fetchCatalogProgrammes: vi.fn()
}));

vi.mock("../planner/store", () => ({
  usePlannerStore: vi.fn()
}));

const mockedSearchCatalogCourses = vi.mocked(searchCatalogCourses);
const mockedFetchCatalogCourse = vi.mocked(fetchCatalogCourse);
const mockedFetchCatalogProgrammes = vi.mocked(fetchCatalogProgrammes);
const mockedUsePlannerStore = vi.mocked(usePlannerStore);
const importCatalogCourse = vi.fn();

const catalogCard: CatalogCourseCard = {
  id: "catalog-1",
  semester_key: "SoSe 2026",
  title: "Sehr lange Veranstaltung zur mobilen Katalogansicht",
  course_number: "20-00-1234",
  abbreviation: "Mobile UI",
  cp: 6,
  event_type: "Vorlesung",
  faculty: "FB20 Informatik",
  path: ["Vorlesungsverzeichnis", "Informatik"],
  instructors: ["Ada Lovelace"],
  programmes: [
    {
      program_key: "bsc-informatik",
      program_label: "B. Sc. Informatik",
      po_label: "PO 2023",
      cp: 5,
      class_path: ["Pflichtbereich"],
      category_key: "pflichtbereich",
      category_name: "Pflichtbereich",
      category_required_cp_min: 114,
      category_required_cp_max: 114,
      module_number: "20-00-1234",
      module_title: "Mobile UI"
    }
  ],
  appointment_count: 1,
  first_date: "2026-04-27",
  last_date: "2026-04-27"
};

const catalogDetail: CatalogCourseDetail = {
  ...catalogCard,
  source_url: null,
  language: "Deutsch",
  details_json: {
    small_groups: [
      {
        key: "group-1",
        title: "Uebung 1",
        instructors: ["Grace Hopper"],
        schedule: "Mo 10:00",
        appointments: [
          {
            date: "2026-04-28",
            time_from: "10:00",
            time_to: "11:30",
            room: "S2|02 A020",
            type: "Uebung",
            position: 0
          }
        ]
      }
    ]
  },
  raw_appointment_text: null,
  appointments: [
    {
      id: "appointment-1",
      date: "2026-04-27",
      time_from: "08:00",
      time_to: "09:30",
      room: "S1|01 A001",
      type: "Vorlesung"
    }
  ]
};

function renderCatalogPage() {
  return render(
    <MemoryRouter>
      <CatalogPage />
    </MemoryRouter>
  );
}

describe("CatalogPage mobile detail sheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSearchCatalogCourses.mockResolvedValue({ items: [catalogCard], page: 1, limit: 25, has_more: false });
    mockedFetchCatalogCourse.mockResolvedValue(catalogDetail);
    mockedFetchCatalogProgrammes.mockResolvedValue([
      {
        program_key: "bsc-informatik",
        program_label: "B. Sc. Informatik",
        page_url: "https://example.test/bsc",
        curriculum_categories: [],
        curriculum_requirement_groups: [],
        latest_document: null
      }
    ]);
    mockedUsePlannerStore.mockReturnValue({
      importCatalogCourse,
      preferredStudyProgramKey: "bsc-informatik",
      setPreferredStudyProgram: vi.fn()
    } as unknown as ReturnType<typeof usePlannerStore>);
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(max-width: 1000px)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    });
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
  });

  it("opens selected course details in a mobile sheet and can close it", async () => {
    renderCatalogPage();

    const result = await screen.findByRole("button", { name: /Sehr lange Veranstaltung/ });
    fireEvent.click(result);

    const detailPanel = document.querySelector(".catalog-detail-panel");
    expect(detailPanel).toHaveClass("mobile-open");
    expect(result).toHaveClass("selected");

    expect(await screen.findByRole("heading", { name: catalogDetail.title })).toBeInTheDocument();
    expect(screen.getAllByText("Uebung 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/B\. Sc\. Informatik/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Zurück" }));

    await waitFor(() => expect(detailPanel).not.toHaveClass("mobile-open"));
  });

  it("keeps the imported subgroup selection when adding the course", async () => {
    importCatalogCourse.mockResolvedValue({ courseId: "planned-1" });
    renderCatalogPage();

    fireEvent.click(await screen.findByRole("button", { name: /Sehr lange Veranstaltung/ }));
    await screen.findByRole("heading", { name: catalogDetail.title });
    fireEvent.click(screen.getByRole("button", { name: "Zum Plan hinzufügen" }));

    await waitFor(() =>
      expect(importCatalogCourse).toHaveBeenCalledWith({
        catalog_course_id: "catalog-1",
        selected_subgroup_key: "group-1"
      })
    );
  });

  it("prompts for CP and category when the selected programme has no handbook match", async () => {
    mockedFetchCatalogCourse.mockResolvedValue({ ...catalogDetail, cp: 6, programmes: [] });
    importCatalogCourse.mockResolvedValue({ courseId: "planned-1" });
    renderCatalogPage();

    fireEvent.click(await screen.findByRole("button", { name: /Sehr lange Veranstaltung/ }));
    await screen.findByRole("heading", { name: catalogDetail.title });
    fireEvent.click(screen.getByRole("button", { name: "Zum Plan hinzufügen" }));

    expect(importCatalogCourse).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Angaben bestätigen und hinzufügen" })).toBeInTheDocument();
  });
});
