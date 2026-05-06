import { useNavigate } from "react-router-dom";
import { AppleBadge } from "../components/AppleBadge";
import { AppleBtn } from "../components/AppleBtn";
import { AppleCard } from "../components/AppleCard";
import { GradientProgress } from "../components/GradientProgress";
import { Icon } from "../components/Icon";
import { PageHeader } from "../components/PageHeader";
import { SegmentedControl } from "../components/SegmentedControl";
import { usePlan } from "../app/PlanProvider";
import { computeConflicts, EXAM_SEVERITY } from "../lib/conflicts";
import { fmtDate, fmtTime } from "../lib/formatDate";

const SEGMENTS = ["Übersicht", "Stundenplan", "Konflikte"];
const SEGMENT_PATHS = ["/", "/stundenplan", "/konflikte"];

export function SemesterOverview() {
  const navigate = useNavigate();
  const { uiCourses, toggleCourseActive, removeCourse } = usePlan();
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const picked = uiCourses.filter((c) => c.isActive);
  const totalEcts = picked.reduce((s, c) => s + c.ects, 0);
  const { pairs, perCourse } = computeConflicts(picked);

  const stats = [
    { label: "Kurse", value: picked.length, max: Math.max(8, picked.length || 1) },
    { label: "ECTS", value: totalEcts, max: Math.max(36, totalEcts || 1) },
    {
      label: "Klausuren",
      value: picked.filter((c) => c.appointments.some((a) => a.type === "klausur")).length,
      max: Math.max(8, picked.length || 1)
    },
    { label: "Konflikte", value: pairs.length, max: Math.max(picked.length || 1, pairs.length), warn: true }
  ];

  return (
    <div>
      <PageHeader title="Semesterübersicht" sub={`${picked.length} Kurse · ${totalEcts} ECTS`}>
        <SegmentedControl options={SEGMENTS} active={0} onChange={(i) => navigate(SEGMENT_PATHS[i])} />
      </PageHeader>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 20
        }}
      >
        {stats.map((s, i) => (
          <AppleCard key={i}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "var(--label-tertiary)",
                marginBottom: 6
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: s.warn && s.value > 0 ? "var(--tint-orange)" : "var(--label-primary)"
              }}
            >
              {s.value}
            </div>
            <div style={{ marginTop: 8 }}>
              <GradientProgress pct={Math.min(100, (s.value / s.max) * 100)} />
            </div>
          </AppleCard>
        ))}
      </div>

      {/* Course list */}
      {uiCourses.length === 0 ? (
        <AppleCard>
          <div style={{ textAlign: "center", padding: "32px 16px" }}>
            <Icon name="layer" size={36} color="var(--label-tertiary)" />
            <div style={{ fontSize: 17, fontWeight: 600, marginTop: 12, marginBottom: 4 }}>Noch keine Kurse</div>
            <div style={{ fontSize: 14, color: "var(--label-secondary)" }}>
              Klicke oben auf „Vorlesung hinzufügen", um aus dem Katalog zu wählen.
            </div>
          </div>
        </AppleCard>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
          {uiCourses.map((c) => {
            const active = c.isActive;
            const info = active ? perCourse[c.id] : null;
            const hasClash = info && info.clashCount > 0;
            const examAppt = c.appointments.find((a) => a.type === "klausur");
            const examSev = info && info.worstExamSev ? EXAM_SEVERITY[info.worstExamSev] : null;

            return (
              <AppleCard
                key={c.id}
                style={{
                  outline: active ? "2px solid var(--tint-blue)" : "none",
                  outlineOffset: -1,
                  opacity: active ? 1 : 0.7
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      flexShrink: 0,
                      background: `color-mix(in srgb, ${c.color} 18%, var(--bg-grouped-secondary))`,
                      display: "grid",
                      placeItems: "center"
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, color: c.color }}>{c.ects}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>{c.name}</span>
                      {examSev && (
                        <AppleBadge color={examSev.color} bg={examSev.bg}>
                          {examSev.label}
                        </AppleBadge>
                      )}
                      {hasClash && (
                        <AppleBadge color="var(--tint-orange)" bg="rgba(255,149,0,0.12)">
                          {info!.clashCount} von {info!.totalAppts} Terminen
                        </AppleBadge>
                      )}
                    </div>
                    {c.prof && (
                      <div style={{ fontSize: 13, color: "var(--label-secondary)", marginTop: 2 }}>{c.prof}</div>
                    )}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                      <span
                        style={{
                          fontSize: 11,
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: "var(--fill-quaternary)"
                        }}
                      >
                        {c.appointments.filter((a) => a.type === "vl").length} VL ·{" "}
                        {c.appointments.filter((a) => a.type === "ub").length} ÜB
                      </span>
                      {examAppt && (
                        <span
                          style={{
                            fontSize: 11,
                            padding: "3px 8px",
                            borderRadius: 6,
                            fontWeight: examSev ? 600 : 400,
                            background: examSev ? examSev.bg : "var(--fill-quaternary)",
                            color: examSev ? examSev.color : "inherit"
                          }}
                        >
                          Klausur: {fmtDate(examAppt.start)} {fmtTime(examAppt.start)}–{fmtTime(examAppt.end)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                    {!active && (
                      <button
                        onClick={() => void removeCourse(c.id)}
                        title="Aus Übersicht entfernen"
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 8,
                          border: "none",
                          background: "rgba(255,59,48,0.1)",
                          cursor: "pointer",
                          display: "grid",
                          placeItems: "center",
                          color: "var(--tint-red)",
                          transition: "background 0.15s"
                        }}
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    )}
                    <AppleBtn variant="secondary" size="sm" onClick={() => navigate(`/course/${c.id}`)}>
                      Details
                    </AppleBtn>
                    <AppleBtn
                      variant={active ? "primary" : "secondary"}
                      size="sm"
                      onClick={() => void toggleCourseActive(c.id, !active)}
                    >
                      {active ? "Gewählt" : "Wählen"}
                    </AppleBtn>
                  </div>
                </div>
              </AppleCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
