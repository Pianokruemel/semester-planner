// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { fetchCatalogProgrammes } from "../api/catalog";
import { createPlan, fetchPlan, fetchPlanByToken, type BackendPlan } from "../api/plans";
import { PlanProvider } from "../app/PlanProvider";

vi.mock("../api/catalog", () => ({ fetchCatalogProgrammes: vi.fn() }));
vi.mock("../api/plans", () => ({
  createPlan: vi.fn(),
  fetchPlan: vi.fn(),
  fetchPlanByToken: vi.fn(),
  deleteCourse: vi.fn(),
  importCatalogCourse: vi.fn(),
  patchCourse: vi.fn()
}));
vi.mock("../shell/Shell", () => ({ Shell: () => <div>Plan geladen</div> }));

const programme = {
  program_key: "bsc-informatik",
  program_label: "B.Sc. Informatik",
  page_url: "https://example.test/programme",
  curriculum_categories: [],
  curriculum_requirement_groups: [],
  latest_document: null
};
const plan: BackendPlan = {
  id: "saved-plan",
  name: "Mein Semesterplan",
  export_version: "3.0",
  settings: {},
  share_token: "bbbb-bbbb-bbbb",
  preferred_study_program_key: programme.program_key,
  categories: [],
  requirement_groups: [],
  courses: []
};
const storageKey = "semester-planner:plan-id";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function apiError(status?: number, message?: string) {
  return {
    isAxiosError: true,
    message: status ? `Request failed with status code ${status}` : "Network Error",
    response: status ? { status, data: message ? { message } : {} } : undefined
  };
}

let container: HTMLDivElement;
let root: Root;

async function renderApp(path = "/") {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <PlanProvider><App /></PlanProvider>
      </MemoryRouter>
    );
  });
}

async function clickText(text: string) {
  const element = [...container.querySelectorAll("button, div")].find(
    (candidate) => candidate.textContent === text && candidate.children.length === 0
  );
  expect(element, `Missing clickable text: ${text}`).toBeDefined();
  await act(async () => {
    (element as HTMLElement).click();
  });
}

async function fill(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function chooseProgramme() {
  await clickText("Verstanden");
  await clickText(programme.program_label);
}

beforeAll(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  vi.mocked(fetchCatalogProgrammes).mockResolvedValue([programme]);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("onboarding requests", () => {
  it("preserves the token input through a delayed failure and allows a successful retry", async () => {
    const request = deferred<BackendPlan>();
    vi.mocked(fetchPlanByToken).mockReturnValueOnce(request.promise).mockResolvedValueOnce(plan);
    await renderApp();
    await chooseProgramme();
    await clickText("Bestehenden Plan öffnen");
    const input = container.querySelector<HTMLInputElement>("#plan-token")!;
    expect(input.labels?.[0]?.textContent).toBe("Token");
    await fill(input, "aaaa-aaaa-aaaa");
    await clickText("Plan laden");
    expect(container.querySelector("#plan-token")).toBe(input);
    expect(input.value).toBe("aaaa-aaaa-aaaa");
    expect(container.textContent).toContain("Lade…");

    await act(async () => request.reject(apiError(404, "Plan nicht gefunden.")));
    expect(container.querySelector("#plan-token")).toBe(input);
    expect(input.value).toBe("aaaa-aaaa-aaaa");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("plan-token-error");
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Plan nicht gefunden.");
    expect(container.textContent).not.toContain("Request failed");

    await fill(input, "bbbb-bbbb-bbbb");
    await clickText("Plan laden");
    expect(fetchPlanByToken).toHaveBeenLastCalledWith("bbbb-bbbb-bbbb");
    expect(container.textContent).toContain("Plan geladen");
    expect(localStorage.getItem(storageKey)).toBe(plan.id);
  });

  it("preserves the selected programme after a failed creation and supports retry", async () => {
    const request = deferred<BackendPlan>();
    vi.mocked(createPlan).mockReturnValueOnce(request.promise).mockResolvedValueOnce(plan);
    await renderApp();
    await chooseProgramme();
    await clickText("Neuen Plan erstellen");
    expect(container.textContent).toContain(programme.program_label);
    expect(container.textContent).toContain("Erstelle…");
    await act(async () => request.reject(apiError()));
    expect(container.textContent).toContain(programme.program_label);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "Plan konnte nicht erstellt werden. Bitte erneut versuchen."
    );
    await clickText("Neuen Plan erstellen");
    expect(createPlan).toHaveBeenLastCalledWith(programme.program_key);
    expect(container.textContent).toContain("Plan geladen");
  });

  it("names the programme search and keeps filtering usable", async () => {
    await renderApp();
    await clickText("Verstanden");
    const search = container.querySelector<HTMLInputElement>('[aria-label="Studiengang suchen"]')!;
    expect(search).not.toBeNull();
    await fill(search, "unbekannt");
    expect(container.textContent).toContain("Kein Studiengang gefunden");
    await fill(search, "Informatik");
    expect(container.textContent).toContain(programme.program_label);
  });
});

describe("stored-plan boot", () => {
  it("shows the boot loader until a stored plan is loaded", async () => {
    const request = deferred<BackendPlan>();
    localStorage.setItem(storageKey, plan.id);
    vi.mocked(fetchPlan).mockReturnValueOnce(request.promise);
    await renderApp();
    expect(container.textContent).toBe("Lade Plan…");
    expect(fetchPlan).toHaveBeenCalledWith(plan.id);
    await act(async () => request.resolve(plan));
    expect(container.textContent).toContain("Plan geladen");
  });

  it("forgets a missing stored plan and opens onboarding", async () => {
    localStorage.setItem(storageKey, plan.id);
    vi.mocked(fetchPlan).mockRejectedValueOnce(apiError(404, "Plan nicht gefunden."));
    await renderApp();
    expect(localStorage.getItem(storageKey)).toBeNull();
    expect(container.textContent).toContain("Verstanden");
  });

  it("retains a stored plan ID after a transient backend failure", async () => {
    localStorage.setItem(storageKey, plan.id);
    vi.mocked(fetchPlan).mockRejectedValueOnce(apiError(503));
    await renderApp();
    expect(localStorage.getItem(storageKey)).toBe(plan.id);
  });
});

describe("shared plan links", () => {
  it.each([
    [404, "Plan nicht gefunden.", "Plan nicht gefunden."],
    [400, "Invalid string: must match pattern", "Ungültiger Token. Bitte überprüfe deine Eingabe."],
    [undefined, undefined, "Plan konnte nicht geladen werden. Bitte erneut versuchen."]
  ])("shows a readable error for status %s", async (status, message, expected) => {
    vi.mocked(fetchPlanByToken).mockRejectedValueOnce(apiError(status, message));
    await renderApp("/share/aaaa-aaaa-aaaa");
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(expected);
    expect(container.textContent).not.toContain("Request failed");
    expect(container.textContent).not.toContain("Network Error");
  });

  it("opens a valid shared plan", async () => {
    vi.mocked(fetchPlanByToken).mockResolvedValueOnce(plan);
    await renderApp("/share/bbbb-bbbb-bbbb");
    expect(fetchPlanByToken).toHaveBeenCalledWith("bbbb-bbbb-bbbb");
    expect(container.textContent).toContain("Plan geladen");
    expect(localStorage.getItem(storageKey)).toBe(plan.id);
  });
});
