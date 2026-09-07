import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { usePlan } from "../app/PlanProvider";

export function ShareLoader() {
  const { token } = useParams<{ token: string }>();
  const { loadPlanByToken } = usePlan();
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("Kein Token angegeben.");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await loadPlanByToken(token);
        if (!cancelled) setStatus("done");
      } catch (e) {
        if (!cancelled) {
          setStatus("error");
          setErrorMsg(e instanceof Error ? e.message : "Plan nicht gefunden.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, loadPlanByToken]);

  if (status === "done") {
    return <Navigate to="/" replace />;
  }

  return (
    <div
      role={status === "error" ? "alert" : "status"}
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "var(--bg-grouped)",
        color: status === "error" ? "var(--tint-red)" : "var(--label-secondary)",
        fontSize: 15,
        padding: 24,
        textAlign: "center"
      }}
    >
      {status === "error" ? errorMsg ?? "Plan nicht gefunden." : "Lade geteilten Plan…"}
    </div>
  );
}
