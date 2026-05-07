import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppleBadge } from "../components/AppleBadge";
import { AppleBtn } from "../components/AppleBtn";
import { AppleCard } from "../components/AppleCard";
import { Icon } from "../components/Icon";
import { usePlan } from "../app/PlanProvider";
import {
  EXAM_SEVERITY,
  TYPE_SHORT,
  examSeverity,
  overlaps,
  type ExamSeverityKey
} from "../lib/conflicts";
import { DAYS_DE, fmtDate, fmtDay, fmtTime } from "../lib/formatDate";
import type { UIAppointment } from "../app/adapter";
import type { CourseColorTag } from "../api/types";

const COLOR_TAGS: CourseColorTag[] = [
  "chip-1",
  "chip-2",
  "chip-3",
  "chip-4",
  "chip-5",
  "chip-6",
  "chip-7",
  "chip-8"
];

export function CourseDetailView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { uiCourses, toggleCourseActive, removeCourse, updateCourseDetails } = usePlan();
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const [editing, setEditing] = useState(false);
  const [abbrDraft, setAbbrDraft] = useState("");
  const [colorDraft, setColorDraft] = useState<CourseColorTag>("chip-1");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const c = uiCourses.find((x) => x.id === id);
  useEffect(() => {
    if (c && !editing) {
      setAbbrDraft(c.abbreviation);
      setColorDraft(c.colorTag);
    }
  }, [c, editing]);

  if (!c) {
    return (
      <div>
        <button
          onClick={() => navigate("/")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            background: "none",
            border: "none",
            color: "var(--tint-blue)",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
            padding: "6px 0",
            marginBottom: 20
          }}
        >
          <Icon name="chevLeft" size={16} /> Zurück
        </button>
        <AppleCard>
          <div style={{ textAlign: "center", padding: 24, color: "var(--label-secondary)" }}>
            Kurs nicht gefunden.
          </div>
        </AppleCard>
      </div>
    );
  }

  const active = c.isActive;
  const picked = uiCourses.filter((x) => x.isActive);
  const vls = c.appointments.filter((a) => a.type === "vl");
  const ubs = c.appointments.filter((a) => a.type === "ub");
  const exams = c.appointments.filter((a) => a.type === "klausur");

  // Weekly schedule deduplicated by weekday + start + type
  const weeklySlots: { day: string; start: string; end: string; type: UIAppointment["type"] }[] = [];
  const seenSlots = new Set<string>();
  c.appointments
    .filter((a) => a.type !== "klausur")
    .forEach((a) => {
      const dt = new Date(a.start);
      const de = new Date(a.end);
      const day = DAYS_DE[dt.getDay()];
      const key = `${day}-${fmtTime(a.start)}-${a.type}`;
      if (seenSlots.has(key)) return;
      seenSlots.add(key);
      weeklySlots.push({ day, start: fmtTime(a.start), end: fmtTime(de), type: a.type });
    });

  // Conflicts with other selected courses
  const conflicts: { other: typeof c; clashes: { mine: UIAppointment; theirs: UIAppointment }[]; examSev: ExamSeverityKey | null }[] = [];
  picked.forEach((other) => {
    if (other.id === c.id) return;
    const clashes: { mine: UIAppointment; theirs: UIAppointment }[] = [];
    c.appointments.forEach((aa) => {
      other.appointments.forEach((bb) => {
        if (aa.type === "klausur" && bb.type === "klausur") return;
        if (overlaps(aa, bb)) clashes.push({ mine: aa, theirs: bb });
      });
    });
    const examA = c.appointments.find((x) => x.type === "klausur");
    const examB = other.appointments.find((x) => x.type === "klausur");
    let sev: ExamSeverityKey | null = null;
    if (examA && examB) sev = examSeverity(examA, examB);
    if (clashes.length > 0 || sev) conflicts.push({ other, clashes, examSev: sev });
  });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <button
          onClick={() => navigate("/")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            background: "none",
            border: "none",
            color: "var(--tint-blue)",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
            padding: "6px 0"
          }}
        >
          <Icon name="chevLeft" size={16} /> Zurück
        </button>
      </div>

      {/* Hero */}
      <AppleCard style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: `color-mix(in srgb, ${c.color} 18%, var(--bg-grouped-secondary))`,
              display: "grid",
              placeItems: "center",
              flexShrink: 0
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 700, color: c.color }}>{c.ects}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>
              {c.name}
            </div>
            {c.prof && <div style={{ fontSize: 14, color: "var(--label-secondary)" }}>{c.prof}</div>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              <AppleBadge color={c.color}>{c.ects} CP</AppleBadge>
              {c.abbreviation && (
                <AppleBadge color="var(--label-secondary)" bg="var(--fill-quaternary)">
                  {c.abbreviation}
                </AppleBadge>
              )}
              <AppleBadge color="var(--label-secondary)" bg="var(--fill-quaternary)">
                {vls.length} VL · {ubs.length} ÜB
              </AppleBadge>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
            <AppleBtn
              variant="secondary"
              size="sm"
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? "Schließen" : "Bearbeiten"}
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

        {editing && (
          <div
            style={{
              marginTop: 16,
              paddingTop: 16,
              borderTop: "0.5px solid var(--separator)",
              display: "flex",
              flexDirection: "column",
              gap: 16
            }}
          >
            <div>
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
                Abkürzung
              </div>
              <input
                type="text"
                value={abbrDraft}
                onChange={(e) => setAbbrDraft(e.target.value)}
                maxLength={16}
                placeholder="z. B. ALG2"
                style={{
                  width: "100%",
                  height: 36,
                  padding: "0 12px",
                  borderRadius: 10,
                  border: "0.5px solid var(--separator)",
                  background: "var(--bg-elevated)",
                  color: "var(--label-primary)",
                  fontSize: 14,
                  outline: "none"
                }}
              />
            </div>

            <div>
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
                Anzeigefarbe
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {COLOR_TAGS.map((tag) => {
                  const selected = colorDraft === tag;
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setColorDraft(tag)}
                      aria-label={tag}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 999,
                        background: `var(--${tag})`,
                        border: selected
                          ? "2px solid var(--label-primary)"
                          : "2px solid transparent",
                        boxShadow: selected ? "0 0 0 2px var(--bg-elevated) inset" : "none",
                        cursor: "pointer",
                        padding: 0
                      }}
                    />
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <AppleBtn
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (deleting) return;
                  if (!window.confirm(`„${c.name}" wirklich entfernen?`)) return;
                  setDeleting(true);
                  removeCourse(c.id)
                    .then(() => navigate("/"))
                    .catch(() => setDeleting(false));
                }}
                disabled={deleting || saving}
              >
                {deleting ? "Entfernen…" : "Kurs entfernen"}
              </AppleBtn>
              <div style={{ display: "flex", gap: 8 }}>
                <AppleBtn
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setAbbrDraft(c.abbreviation);
                    setColorDraft(c.colorTag);
                    setEditing(false);
                  }}
                  disabled={saving || deleting}
                >
                  Abbrechen
                </AppleBtn>
                <AppleBtn
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const trimmed = abbrDraft.trim();
                    if (trimmed.length === 0) return;
                    const patch: { abbreviation?: string; color_tag?: CourseColorTag } = {};
                    if (trimmed !== c.abbreviation) patch.abbreviation = trimmed;
                    if (colorDraft !== c.colorTag) patch.color_tag = colorDraft;
                    if (Object.keys(patch).length === 0) {
                      setEditing(false);
                      return;
                    }
                    setSaving(true);
                    updateCourseDetails(c.id, patch)
                      .then(() => setEditing(false))
                      .finally(() => setSaving(false));
                  }}
                  disabled={
                    saving ||
                    deleting ||
                    abbrDraft.trim().length === 0 ||
                    (abbrDraft.trim() === c.abbreviation && colorDraft === c.colorTag)
                  }
                >
                  {saving ? "Speichern…" : "Speichern"}
                </AppleBtn>
              </div>
            </div>
          </div>
        )}
      </AppleCard>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
        {/* Weekly schedule */}
        <AppleCard>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "var(--label-tertiary)",
              marginBottom: 12
            }}
          >
            Wöchentlicher Rhythmus
          </div>
          {weeklySlots.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--label-secondary)" }}>Keine wiederkehrenden Termine.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {weeklySlots.map((s, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    borderRadius: 10,
                    background: "var(--fill-quaternary)"
                  }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, width: 28 }}>{s.day}</span>
                  <span style={{ fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--label-secondary)" }}>
                    {s.start}–{s.end}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      marginLeft: "auto",
                      padding: "2px 7px",
                      borderRadius: 5,
                      background: `color-mix(in srgb, ${c.color} 12%, transparent)`,
                      color: c.color,
                      fontWeight: 600
                    }}
                  >
                    {TYPE_SHORT[s.type]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </AppleCard>

        {/* Right column: exam + all appointments */}
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          {exams.length > 0 && (
            <AppleCard>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "var(--label-tertiary)",
                  marginBottom: 12
                }}
              >
                Klausur
              </div>
              {exams.map((e, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "var(--fill-quaternary)"
                  }}
                >
                  <Icon name="calendar" size={16} color="var(--label-secondary)" />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{fmtDate(e.start)}</div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--label-secondary)",
                        fontFamily: "var(--font-mono)"
                      }}
                    >
                      {fmtTime(e.start)}–{fmtTime(e.end)}
                    </div>
                  </div>
                </div>
              ))}
            </AppleCard>
          )}

          <AppleCard>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: "var(--label-tertiary)",
                marginBottom: 12
              }}
            >
              Alle Termine ({c.appointments.length})
            </div>
            <div style={{ display: "grid", gap: 4, maxHeight: 260, overflowY: "auto" }}>
              {c.appointments.map((a, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "var(--label-secondary)"
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 6px",
                      borderRadius: 4,
                      fontWeight: 600,
                      background:
                        a.type === "klausur" ? "rgba(255,59,48,0.12)" : "var(--fill-quaternary)",
                      color: a.type === "klausur" ? "var(--tint-red)" : "inherit",
                      width: 48,
                      textAlign: "center",
                      flexShrink: 0
                    }}
                  >
                    {TYPE_SHORT[a.type]}
                  </span>
                  <span>
                    {fmtDay(a.start)} {fmtDate(a.start)}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)" }}>
                    {fmtTime(a.start)}–{fmtTime(a.end)}
                  </span>
                  {a.room && <span style={{ marginLeft: "auto" }}>{a.room}</span>}
                </div>
              ))}
            </div>
          </AppleCard>
        </div>
      </div>

      {conflicts.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "var(--label-tertiary)",
              marginBottom: 12
            }}
          >
            Konflikte mit gewählten Kursen
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {conflicts.map((cf, i) => {
              const sev = cf.examSev ? EXAM_SEVERITY[cf.examSev] : null;
              return (
                <AppleCard key={i}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: cf.other.color,
                        flexShrink: 0
                      }}
                    />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{cf.other.name}</span>
                    {cf.clashes.length > 0 && (
                      <AppleBadge color="var(--tint-orange)" bg="rgba(255,149,0,0.12)">
                        {cf.clashes.length} Terminkonflikt{cf.clashes.length > 1 ? "e" : ""}
                      </AppleBadge>
                    )}
                    {sev && (
                      <AppleBadge color={sev.color} bg={sev.bg}>
                        Klausur: {sev.label}
                      </AppleBadge>
                    )}
                  </div>
                </AppleCard>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
