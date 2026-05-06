import { Navigate, Route, Routes } from "react-router-dom";
import { usePlan } from "./app/PlanProvider";
import { OnboardingFlow } from "./onboarding/OnboardingFlow";
import { Shell } from "./shell/Shell";
import { SemesterOverview } from "./screens/SemesterOverview";
import { TimetableView } from "./screens/TimetableView";
import { ConflictsView } from "./screens/ConflictsView";
import { CourseDetailView } from "./screens/CourseDetailView";

export default function App() {
  const { plan, isLoading } = usePlan();

  if (isLoading && !plan) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "var(--bg-grouped)",
          color: "var(--label-secondary)",
          fontSize: 15
        }}
      >
        Lade Plan…
      </div>
    );
  }

  if (!plan) {
    return <OnboardingFlow />;
  }

  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<SemesterOverview />} />
        <Route path="stundenplan" element={<TimetableView />} />
        <Route path="konflikte" element={<ConflictsView />} />
        <Route path="course/:id" element={<CourseDetailView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
