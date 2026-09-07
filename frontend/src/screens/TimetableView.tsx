import { Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { AppleCard } from "../components/AppleCard";
import { AppleBtn } from "../components/AppleBtn";
import { EventChip } from "../components/EventChip";
import { PageHeader } from "../components/PageHeader";
import { SegmentedControl } from "../components/SegmentedControl";
import { usePlan } from "../app/PlanProvider";
import { TYPE_SHORT } from "../lib/conflicts";
import { downloadCalendar } from "../lib/calendarExport";
import type { UICourse } from "../app/adapter";

const SEGMENTS = ["Übersicht", "Stundenplan", "Konflikte"];
const SEGMENT_PATHS = ["/", "/stundenplan", "/konflikte"];
const DAYS = ["Mo", "Di", "Mi", "Do", "Fr"];
const ROW_H = 52;
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 18;

type GridEntry = UICourse & { di: number; startHour: number; startMin: number; spanH: number; apptType: "vl" | "ub" };

export function TimetableView() {
  const navigate = useNavigate();
  const { uiCourses } = usePlan();

  const picked = uiCourses.filter((c) => c.isActive);
  const slots = new Map<string, { entry: GridEntry; count: number }>();

  picked.forEach((c) => {
    c.appointments.forEach((a) => {
      if (a.type === "klausur") return;
      const dt = new Date(a.start);
      const de = new Date(a.end);
      const di = dt.getDay(); // 0=Sun
      if (di < 1 || di > 5) return;
      const startH = dt.getHours();
      const startMin = dt.getMinutes();
      const spanH = (de.getTime() - dt.getTime()) / (1000 * 60 * 60);
      const key = `${c.id}-${di - 1}-${startH}-${startMin}-${a.type}`;
      const existing = slots.get(key);
      if (existing) {
        existing.count += 1;
        return;
      }
      slots.set(key, {
        entry: { ...c, di: di - 1, startHour: startH, startMin, spanH, apptType: a.type },
        count: 1
      });
    });
  });

  const grid: GridEntry[] = Array.from(slots.values())
    .filter((s) => s.count > 3)
    .map((s) => s.entry);

  // Widen the visible window so events outside the default 08:00–18:00 range
  // (early-morning or evening lectures) are never clipped off the grid.
  let startHour = DEFAULT_START_HOUR;
  let endHour = DEFAULT_END_HOUR;
  for (const e of grid) {
    startHour = Math.min(startHour, Math.floor(e.startHour));
    endHour = Math.max(endHour, Math.ceil(e.startHour + e.spanH));
  }
  startHour = Math.max(0, startHour);
  endHour = Math.min(24, endHour);
  const HOURS = Array.from({ length: Math.max(1, endHour - startHour) }, (_, i) => String(startHour + i).padStart(2, "0"));

  return (
    <div>
      <PageHeader title="Stundenplan" sub="Typische Woche">
        <AppleBtn icon="export2" disabled={!picked.some((c) => c.appointments.length > 0)} onClick={() => downloadCalendar(picked)}>
          ICS exportieren
        </AppleBtn>
        <SegmentedControl options={SEGMENTS} active={1} onChange={(i) => navigate(SEGMENT_PATHS[i])} />
      </PageHeader>
      <p style={{ fontSize: 13, color: "var(--label-secondary)", marginBottom: 16 }}>
        Der ICS-Export enthält alle Termine und Klausuren der aktiven Kurse, auch Einzeltermine außerhalb der typischen Woche.
      </p>
      <AppleCard noPad style={{ overflow: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "48px repeat(5, 1fr)", minWidth: 650 }}>
          <div style={{ borderBottom: "0.5px solid var(--separator)" }} />
          {DAYS.map((d, i) => (
            <div
              key={i}
              style={{
                padding: "10px 0",
                textAlign: "center",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--label-secondary)",
                borderBottom: "0.5px solid var(--separator)",
                borderLeft: "0.5px solid var(--separator)"
              }}
            >
              {d}
            </div>
          ))}
          {HOURS.map((h, hi) => (
            <Fragment key={hi}>
              <div
                style={{
                  height: ROW_H,
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "flex-end",
                  padding: "2px 6px 0 0",
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  color: "var(--label-tertiary)",
                  borderTop: "0.5px solid var(--separator)"
                }}
              >
                {h}:00
              </div>
              {DAYS.map((_, di) => {
                const ev = grid.filter((e) => e.di === di && e.startHour - startHour === hi);
                return (
                  <div
                    key={di}
                    style={{
                      position: "relative",
                      height: ROW_H,
                      borderTop: "0.5px solid var(--separator)",
                      borderLeft: "0.5px solid var(--separator)"
                    }}
                  >
                    {ev.map((e, i) => (
                      <div
                        key={i}
                        style={{
                          position: "absolute",
                          top: (e.startMin / 60) * ROW_H + 2,
                          left: ev.length > 1 ? `${(i / ev.length) * 100}%` : 2,
                          right: ev.length > 1 ? `${((ev.length - i - 1) / ev.length) * 100}%` : 2,
                          height: e.spanH * ROW_H - 4,
                          zIndex: 2,
                          marginLeft: ev.length > 1 ? 1 : 0,
                          marginRight: ev.length > 1 ? 1 : 0
                        }}
                      >
                        <EventChip title={e.name} sub={TYPE_SHORT[e.apptType]} color={e.color} tall />
                      </div>
                    ))}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </AppleCard>
    </div>
  );
}
