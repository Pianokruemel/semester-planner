import { useNavigate } from "react-router-dom";
import { AppleCard } from "../components/AppleCard";
import { Icon } from "../components/Icon";
import { PageHeader } from "../components/PageHeader";
import { SegmentedControl } from "../components/SegmentedControl";
import { usePlan } from "../app/PlanProvider";
import { computeConflicts, EXAM_SEVERITY } from "../lib/conflicts";
import { fmtDate, fmtTime } from "../lib/formatDate";

const SEGMENTS = ["Übersicht", "Stundenplan", "Konflikte"];
const SEGMENT_PATHS = ["/", "/stundenplan", "/konflikte"];

export function ConflictsView() {
  const navigate = useNavigate();
  const { uiCourses } = usePlan();

  const picked = uiCourses.filter((c) => c.isActive);
  const { pairs } = computeConflicts(picked);

  const examConflicts = pairs
    .filter((p) => p.examSev)
    .sort((a, b) => EXAM_SEVERITY[b.examSev!].rank - EXAM_SEVERITY[a.examSev!].rank);
  const scheduleConflicts = pairs
    .filter((p) => p.clashes.length > 0)
    .sort((a, b) => b.clashes.length - a.clashes.length);

  return (
    <div>
      <PageHeader title="Konflikte" sub={`${pairs.length} Kurspaare mit Überschneidungen`}>
        <SegmentedControl options={SEGMENTS} active={2} onChange={(i) => navigate(SEGMENT_PATHS[i])} />
      </PageHeader>

      {pairs.length === 0 ? (
        <AppleCard>
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <Icon name="check" size={48} color="var(--tint-green)" />
            <div style={{ fontSize: 17, fontWeight: 600, marginTop: 12, marginBottom: 4 }}>Keine Konflikte</div>
            <div style={{ fontSize: 14, color: "var(--label-secondary)" }}>
              Deine Auswahl hat keine Überschneidungen.
            </div>
          </div>
        </AppleCard>
      ) : (
        <div style={{ display: "grid", gap: 24 }}>
          {/* Klausurkonflikte */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--label-primary)" }}>Klausurkonflikte</div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 6,
                  background:
                    examConflicts.length > 0 ? "rgba(255,59,48,0.12)" : "rgba(48,209,88,0.12)",
                  color: examConflicts.length > 0 ? "var(--tint-red)" : "var(--tint-green)"
                }}
              >
                {examConflicts.length}
              </span>
            </div>
            {examConflicts.length === 0 ? (
              <AppleCard>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
                  <Icon name="check" size={20} color="var(--tint-green)" />
                  <span style={{ fontSize: 14, color: "var(--label-secondary)" }}>Keine Klausurkonflikte</span>
                </div>
              </AppleCard>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {examConflicts.map((pair, i) => {
                  const sev = EXAM_SEVERITY[pair.examSev!];
                  const examA = pair.a.appointments.find((x) => x.type === "klausur");
                  const examB = pair.b.appointments.find((x) => x.type === "klausur");
                  return (
                    <AppleCard key={i}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            background: sev.bg,
                            display: "grid",
                            placeItems: "center",
                            flexShrink: 0
                          }}
                        >
                          <Icon name="warning" size={20} color={sev.color} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: "var(--label-secondary)", marginBottom: 6 }}>
                            <span style={{ borderBottom: `2px solid ${pair.a.color}` }}>{pair.a.name}</span> ↔{" "}
                            <span style={{ borderBottom: `2px solid ${pair.b.color}` }}>{pair.b.name}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: sev.color }}>{sev.label}</span>
                            {examA && examB && (
                              <span style={{ fontSize: 11, color: "var(--label-tertiary)" }}>
                                {fmtDate(examA.start)} {fmtTime(examA.start)}–{fmtTime(examA.end)} /{" "}
                                {fmtDate(examB.start)} {fmtTime(examB.start)}–{fmtTime(examB.end)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </AppleCard>
                  );
                })}
              </div>
            )}
          </div>

          {/* Vorlesungs-/Übungskonflikte */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--label-primary)" }}>
                Vorlesungs- & Übungskonflikte
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 6,
                  background:
                    scheduleConflicts.length > 0 ? "rgba(255,149,0,0.12)" : "rgba(48,209,88,0.12)",
                  color: scheduleConflicts.length > 0 ? "var(--tint-orange)" : "var(--tint-green)"
                }}
              >
                {scheduleConflicts.length}
              </span>
            </div>
            {scheduleConflicts.length === 0 ? (
              <AppleCard>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
                  <Icon name="check" size={20} color="var(--tint-green)" />
                  <span style={{ fontSize: 14, color: "var(--label-secondary)" }}>Keine Terminkonflikte</span>
                </div>
              </AppleCard>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {scheduleConflicts.map((pair, i) => (
                  <AppleCard key={i}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 12,
                          background: "rgba(255,149,0,0.12)",
                          display: "grid",
                          placeItems: "center",
                          flexShrink: 0
                        }}
                      >
                        <Icon name="warning" size={20} color="var(--tint-orange)" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: "var(--label-secondary)", marginBottom: 6 }}>
                          <span style={{ borderBottom: `2px solid ${pair.a.color}` }}>{pair.a.name}</span> ↔{" "}
                          <span style={{ borderBottom: `2px solid ${pair.b.color}` }}>{pair.b.name}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>
                            {pair.clashes.length} Terminkonflikt{pair.clashes.length > 1 ? "e" : ""}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              padding: "2px 8px",
                              borderRadius: 6,
                              fontWeight: 600,
                              background: "rgba(255,149,0,0.12)",
                              color: "var(--tint-orange)"
                            }}
                          >
                            {pair.clashes
                              .map((c) => `${fmtDate(c.apptA.start)} ${fmtTime(c.apptA.start)}`)
                              .slice(0, 3)
                              .join(", ")}
                            {pair.clashes.length > 3 ? ` +${pair.clashes.length - 3}` : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                  </AppleCard>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
