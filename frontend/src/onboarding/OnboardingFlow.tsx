import { useEffect, useState } from "react";
import { AppleBtn } from "../components/AppleBtn";
import { AppleCard } from "../components/AppleCard";
import { Icon } from "../components/Icon";
import { fetchCatalogProgrammes, type CatalogStudyProgram } from "../api/catalog";
import { usePlan } from "../app/PlanProvider";

type Step = "disclaimer" | "studiengang" | "planChoice" | "token";

export function OnboardingFlow() {
  const { startNewPlan, loadPlanByToken } = usePlan();
  const [step, setStep] = useState<Step>("disclaimer");
  const [programmes, setProgrammes] = useState<CatalogStudyProgram[] | null>(null);
  const [programmesError, setProgrammesError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [selectedProgram, setSelectedProgram] = useState<CatalogStudyProgram | null>(null);
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (step !== "studiengang" || programmes !== null) return;
    void (async () => {
      try {
        const list = await fetchCatalogProgrammes();
        setProgrammes(list);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Studiengänge konnten nicht geladen werden.";
        setProgrammesError(msg);
      }
    })();
  }, [step, programmes]);

  const filtered = (programmes ?? []).filter((p) =>
    filter ? p.program_label.toLowerCase().includes(filter.toLowerCase()) : true
  );

  const handleCreate = async () => {
    if (!selectedProgram) return;
    setSubmitting(true);
    setCreateError(null);
    try {
      await startNewPlan(selectedProgram.program_key);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Plan konnte nicht erstellt werden.";
      setCreateError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoadToken = async () => {
    const trimmed = token.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setTokenError(null);
    try {
      await loadPlanByToken(trimmed);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Plan nicht gefunden.";
      setTokenError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "var(--bg-grouped)",
        padding: 24
      }}
    >
      <div style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
        <div
          style={{
            font: "italic 700 32px/1 var(--font-serif)",
            letterSpacing: "-0.03em",
            background: "var(--plani-gradient)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            marginBottom: 6,
            marginTop: 32
          }}
        >
          Semesti.
        </div>
        <div style={{ fontSize: 15, color: "var(--label-secondary)", marginBottom: 32 }}>Plane dein Semester.</div>

        {step === "disclaimer" && (
          <AppleCard style={{ textAlign: "left" }}>
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "var(--tint-orange)",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0
                  }}
                >
                  <Icon name="warning" size={20} color="#fff" />
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "var(--label-primary)" }}>Hinweis</div>
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.55, color: "var(--label-secondary)" }}>
                Die in Semesti angezeigten Kursdaten, Zeiten und Prüfungsinformationen werden automatisch
                zusammengestellt und können fehlerhaft oder veraltet sein. Bitte überprüfe alle Angaben immer
                anhand der offiziellen Quellen deiner Hochschule.
              </div>
              <div
                style={{
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: "var(--label-tertiary)",
                  padding: "10px 12px",
                  background: "var(--fill-quaternary)",
                  borderRadius: 10
                }}
              >
                Semesti übernimmt keine Gewähr für die Richtigkeit oder Vollständigkeit der dargestellten
                Informationen.
              </div>
              <AppleBtn variant="gradient" size="lg" full onClick={() => setStep("studiengang")}>
                Verstanden
              </AppleBtn>
            </div>
          </AppleCard>
        )}

        {step === "studiengang" && (
          <AppleCard style={{ textAlign: "left" }}>
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: "var(--label-primary)" }}>Dein Studiengang</div>
              <div style={{ fontSize: 14, color: "var(--label-secondary)", lineHeight: 1.5 }}>
                Wähle deinen Studiengang, damit wir dir passende Kurse anzeigen können.
              </div>
              <input
                type="text"
                aria-label="Studiengang suchen"
                placeholder="Studiengang suchen…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                style={{
                  height: 40,
                  padding: "0 12px",
                  borderRadius: 10,
                  background: "var(--fill-quaternary)",
                  border: "0.5px solid var(--separator)",
                  fontSize: 15,
                  outline: "none",
                  color: "var(--label-primary)"
                }}
              />
              <div style={{ maxHeight: 240, overflowY: "auto", display: "grid", gap: 2 }}>
                {programmesError && (
                  <div style={{ padding: "16px 12px", fontSize: 14, color: "var(--tint-red)", textAlign: "center" }}>
                    {programmesError}
                  </div>
                )}
                {!programmes && !programmesError && (
                  <div
                    style={{
                      padding: "16px 12px",
                      fontSize: 14,
                      color: "var(--label-tertiary)",
                      textAlign: "center"
                    }}
                  >
                    Lade Studiengänge…
                  </div>
                )}
                {programmes &&
                  filtered.map((p) => (
                    <div
                      key={p.program_key}
                      onClick={() => {
                        setSelectedProgram(p);
                        setStep("planChoice");
                      }}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 500,
                        color: "var(--label-primary)",
                        cursor: "pointer",
                        transition: "background 0.15s"
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--fill-quaternary)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {p.program_label}
                    </div>
                  ))}
                {programmes && filtered.length === 0 && (
                  <div
                    style={{
                      padding: "16px 12px",
                      fontSize: 14,
                      color: "var(--label-tertiary)",
                      textAlign: "center"
                    }}
                  >
                    Kein Studiengang gefunden
                  </div>
                )}
              </div>
            </div>
          </AppleCard>
        )}

        {step === "planChoice" && (
          <AppleCard style={{ textAlign: "left" }}>
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "var(--label-primary)", marginBottom: 4 }}>
                  Semesterplan
                </div>
                <div style={{ fontSize: 13, color: "var(--label-tertiary)" }}>
                  {selectedProgram?.program_label}
                </div>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <button
                  onClick={() => void handleCreate()}
                  disabled={submitting}
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    border: "0.5px solid var(--separator)",
                    background: "var(--fill-quaternary)",
                    cursor: submitting ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    transition: "background 0.15s",
                    textAlign: "left"
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: "var(--tint-blue)",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0
                    }}
                  >
                    <Icon name="plus" size={20} color="#fff" />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--label-primary)" }}>
                      {submitting ? "Erstelle…" : "Neuen Plan erstellen"}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--label-tertiary)", marginTop: 2 }}>
                      Starte mit einer leeren Semesterplanung
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => setStep("token")}
                  disabled={submitting}
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    border: "0.5px solid var(--separator)",
                    background: "var(--fill-quaternary)",
                    cursor: submitting ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    transition: "background 0.15s",
                    textAlign: "left"
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: "var(--tint-green)",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0
                    }}
                  >
                    <Icon name="folder" size={20} color="#fff" />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--label-primary)" }}>
                      Bestehenden Plan öffnen
                    </div>
                    <div style={{ fontSize: 13, color: "var(--label-tertiary)", marginTop: 2 }}>
                      Lade einen zuvor gespeicherten Plan
                    </div>
                  </div>
                </button>
              </div>
              {createError && (
                <div role="alert" style={{ fontSize: 13, color: "var(--tint-red)" }}>{createError}</div>
              )}
              <button
                onClick={() => setStep("studiengang")}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 13,
                  color: "var(--tint-blue)",
                  cursor: "pointer",
                  fontWeight: 500,
                  padding: 0,
                  textAlign: "left"
                }}
              >
                ← Studiengang ändern
              </button>
            </div>
          </AppleCard>
        )}

        {step === "token" && (
          <AppleCard style={{ textAlign: "left" }}>
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "var(--label-primary)", marginBottom: 4 }}>
                  Plan öffnen
                </div>
                <div style={{ fontSize: 14, color: "var(--label-secondary)", lineHeight: 1.5 }}>
                  Gib deinen Zugangstoken ein, um einen bestehenden Semesterplan zu laden.
                </div>
              </div>
              <div style={{ display: "grid", gap: 5 }}>
                <label htmlFor="plan-token" style={{ fontSize: 13, fontWeight: 500, color: "var(--label-secondary)" }}>Token</label>
                <input
                  id="plan-token"
                  type="text"
                  aria-invalid={!!tokenError}
                  aria-describedby={tokenError ? "plan-token-error" : undefined}
                  placeholder="z.B. a3f8-k29x-m4pq"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  style={{
                    height: 40,
                    padding: "0 12px",
                    borderRadius: 10,
                    background: "var(--fill-quaternary)",
                    border: "0.5px solid var(--separator)",
                    fontSize: 15,
                    outline: "none",
                    color: "var(--label-primary)",
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "0.04em"
                  }}
                />
                {tokenError && (
                  <div id="plan-token-error" role="alert" style={{ fontSize: 13, color: "var(--tint-red)", marginTop: 4 }}>{tokenError}</div>
                )}
              </div>
              <AppleBtn
                variant="gradient"
                size="lg"
                full
                onClick={() => void handleLoadToken()}
                disabled={submitting || !token.trim()}
              >
                {submitting ? "Lade…" : "Plan laden"}
              </AppleBtn>
              <button
                onClick={() => setStep("planChoice")}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 13,
                  color: "var(--tint-blue)",
                  cursor: "pointer",
                  fontWeight: 500,
                  padding: 0,
                  textAlign: "left"
                }}
              >
                ← Zurück
              </button>
            </div>
          </AppleCard>
        )}
      </div>
    </div>
  );
}
