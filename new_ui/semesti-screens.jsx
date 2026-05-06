/* Semesti — screens */

/* ===== HELPERS ===== */
const DAYS_DE = ["So","Mo","Di","Mi","Do","Fr","Sa"];
const MONTHS_DE = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];

function parseISO(s) { return new Date(s); }
function fmtDate(d) { const dt = new Date(d); return `${dt.getDate()}. ${MONTHS_DE[dt.getMonth()]}`; }
function fmtTime(d) { const dt = new Date(d); return `${String(dt.getHours()).padStart(2,"0")}:${String(dt.getMinutes()).padStart(2,"0")}`; }
function fmtDay(d) { return DAYS_DE[new Date(d).getDay()]; }
function fmtSlot(a) { return `${fmtDay(a.start)} ${fmtDate(a.start)} ${fmtTime(a.start)}–${fmtTime(a.end)}`; }
function fmtShort(a) { return `${fmtDay(a.start)} ${fmtTime(a.start)}–${fmtTime(a.end)}`; }

function overlaps(a, b) {
  const s1 = new Date(a.start).getTime(), e1 = new Date(a.end).getTime();
  const s2 = new Date(b.start).getTime(), e2 = new Date(b.end).getTime();
  return s1 < e2 && s2 < e1;
}

function hoursBetween(a, b) {
  const e1 = new Date(a.end).getTime(), s2 = new Date(b.start).getTime();
  const e2 = new Date(b.end).getTime(), s1 = new Date(a.start).getTime();
  const gap = Math.min(Math.abs(s2 - e1), Math.abs(s1 - e2));
  return gap / (1000 * 60 * 60);
}

const TYPE_LABELS = { vl: "Vorlesung", ub: "Übung", klausur: "Klausur" };
const TYPE_SHORT = { vl: "VL", ub: "ÜB", klausur: "Klausur" };

/* ===== COURSE DATA ===== */
const COURSES_DB = [
  { id: 1, name: "Analysis II", ects: 9, prof: "Prof. Müller", color: "var(--chip-1)",
    appointments: [
      { type: "vl", start: "2026-04-14T10:00", end: "2026-04-14T12:00" },
      { type: "vl", start: "2026-04-16T10:00", end: "2026-04-16T12:00" },
      { type: "ub", start: "2026-04-17T14:00", end: "2026-04-17T15:30" },
      { type: "vl", start: "2026-04-21T10:00", end: "2026-04-21T12:00" },
      { type: "vl", start: "2026-04-23T10:00", end: "2026-04-23T12:00" },
      { type: "ub", start: "2026-04-24T14:00", end: "2026-04-24T15:30" },
      { type: "vl", start: "2026-04-28T10:00", end: "2026-04-28T12:00" },
      { type: "vl", start: "2026-04-30T10:00", end: "2026-04-30T12:00" },
      { type: "ub", start: "2026-05-04T16:00", end: "2026-05-04T17:30" },
      { type: "vl", start: "2026-05-05T10:00", end: "2026-05-05T12:00" },
      { type: "vl", start: "2026-05-07T10:00", end: "2026-05-07T12:00" },
      { type: "ub", start: "2026-05-08T14:00", end: "2026-05-08T15:30" },
      { type: "klausur", start: "2026-07-12T09:00", end: "2026-07-12T12:00" },
    ]},
  { id: 2, name: "Lineare Algebra II", ects: 9, prof: "Prof. Weber", color: "var(--chip-2)",
    appointments: [
      { type: "vl", start: "2026-04-14T14:00", end: "2026-04-14T16:00" },
      { type: "vl", start: "2026-04-16T14:00", end: "2026-04-16T16:00" },
      { type: "ub", start: "2026-04-18T10:00", end: "2026-04-18T11:30" },
      { type: "vl", start: "2026-04-21T14:00", end: "2026-04-21T16:00" },
      { type: "vl", start: "2026-04-23T14:00", end: "2026-04-23T16:00" },
      { type: "ub", start: "2026-04-25T10:00", end: "2026-04-25T11:30" },
      { type: "vl", start: "2026-04-28T14:00", end: "2026-04-28T16:00" },
      { type: "vl", start: "2026-04-30T14:00", end: "2026-04-30T16:00" },
      { type: "ub", start: "2026-05-02T10:00", end: "2026-05-02T11:30" },
      { type: "vl", start: "2026-05-05T14:00", end: "2026-05-05T16:00" },
      { type: "klausur", start: "2026-07-18T10:00", end: "2026-07-18T13:00" },
    ]},
  { id: 3, name: "Stochastik", ects: 6, prof: "Prof. Schmidt", color: "var(--chip-4)",
    appointments: [
      { type: "vl", start: "2026-04-15T10:00", end: "2026-04-15T12:00" },
      { type: "vl", start: "2026-04-17T10:00", end: "2026-04-17T11:00" },
      { type: "ub", start: "2026-04-16T11:00", end: "2026-04-16T12:30" }, /* overlaps Analysis VL on 16. Apr */
      { type: "vl", start: "2026-04-22T10:00", end: "2026-04-22T12:00" },
      { type: "ub", start: "2026-04-23T11:00", end: "2026-04-23T12:30" }, /* overlaps Analysis VL on 23. Apr */
      { type: "vl", start: "2026-04-29T10:00", end: "2026-04-29T12:00" },
      { type: "ub", start: "2026-04-30T11:00", end: "2026-04-30T12:30" }, /* overlaps Analysis VL on 30. Apr */
      { type: "vl", start: "2026-05-06T10:00", end: "2026-05-06T12:00" },
      { type: "klausur", start: "2026-07-12T14:00", end: "2026-07-12T16:00" }, /* same day as Analysis exam, <24h */
    ]},
  { id: 4, name: "Theoretische Informatik", ects: 6, prof: "Prof. Klein", color: "var(--chip-7)",
    appointments: [
      { type: "vl", start: "2026-04-14T08:00", end: "2026-04-14T10:00" },
      { type: "vl", start: "2026-04-21T08:00", end: "2026-04-21T10:00" },
      { type: "ub", start: "2026-04-22T16:00", end: "2026-04-22T17:30" },
      { type: "vl", start: "2026-04-28T08:00", end: "2026-04-28T10:00" },
      { type: "ub", start: "2026-04-29T16:00", end: "2026-04-29T17:30" },
      { type: "vl", start: "2026-05-05T08:00", end: "2026-05-05T10:00" },
      { type: "ub", start: "2026-05-06T16:00", end: "2026-05-06T17:30" },
      { type: "klausur", start: "2026-07-25T09:00", end: "2026-07-25T11:00" },
    ]},
  { id: 5, name: "Datenbanken", ects: 6, prof: "Prof. Berger", color: "var(--chip-6)",
    appointments: [
      { type: "vl", start: "2026-04-16T08:00", end: "2026-04-16T10:00" },
      { type: "ub", start: "2026-04-17T15:00", end: "2026-04-17T16:30" }, /* overlaps Analysis ÜB 14:00–15:30 partially */
      { type: "vl", start: "2026-04-23T08:00", end: "2026-04-23T10:00" },
      { type: "ub", start: "2026-04-24T15:00", end: "2026-04-24T16:30" }, /* overlaps Analysis ÜB partially */
      { type: "vl", start: "2026-04-30T08:00", end: "2026-04-30T10:00" },
      { type: "vl", start: "2026-05-07T08:00", end: "2026-05-07T10:00" },
      { type: "ub", start: "2026-05-08T15:00", end: "2026-05-08T16:30" }, /* overlaps Analysis ÜB partially */
      { type: "klausur", start: "2026-07-13T10:00", end: "2026-07-13T12:00" }, /* ~22h after Analysis exam ends = <24h */
    ]},
  { id: 6, name: "Algorithmen & Datenstrukturen", ects: 9, prof: "Prof. Hoffmann", color: "var(--chip-3)",
    appointments: [
      { type: "vl", start: "2026-04-15T14:00", end: "2026-04-15T16:00" },
      { type: "vl", start: "2026-04-17T14:00", end: "2026-04-17T16:00" },
      { type: "ub", start: "2026-04-16T10:00", end: "2026-04-16T11:00" }, /* overlaps Analysis VL 10–12 partially */
      { type: "vl", start: "2026-04-22T14:00", end: "2026-04-22T16:00" },
      { type: "ub", start: "2026-04-23T10:00", end: "2026-04-23T11:00" }, /* overlaps Analysis VL 10–12 partially */
      { type: "vl", start: "2026-04-29T14:00", end: "2026-04-29T16:00" },
      { type: "ub", start: "2026-04-30T10:00", end: "2026-04-30T11:00" }, /* overlaps Analysis VL 10–12 partially */
      { type: "vl", start: "2026-05-06T14:00", end: "2026-05-06T16:00" },
      { type: "ub", start: "2026-05-07T10:00", end: "2026-05-07T11:00" }, /* overlaps Analysis VL */
      { type: "klausur", start: "2026-07-15T09:00", end: "2026-07-15T12:00" },
    ]},
  { id: 7, name: "Numerik", ects: 6, prof: "Prof. Braun", color: "var(--chip-8)",
    appointments: [
      { type: "vl", start: "2026-04-14T14:00", end: "2026-04-14T16:00" }, /* overlaps LinAlg VL fully */
      { type: "ub", start: "2026-04-15T12:00", end: "2026-04-15T13:30" },
      { type: "vl", start: "2026-04-21T14:00", end: "2026-04-21T16:00" }, /* overlaps LinAlg VL fully */
      { type: "ub", start: "2026-04-22T12:00", end: "2026-04-22T13:30" },
      { type: "vl", start: "2026-04-28T14:00", end: "2026-04-28T16:00" }, /* overlaps LinAlg VL fully */
      { type: "vl", start: "2026-05-05T14:00", end: "2026-05-05T16:00" }, /* overlaps LinAlg VL fully */
      { type: "klausur", start: "2026-07-12T14:00", end: "2026-07-12T16:00" }, /* overlaps Stochastik exam exactly = red */
    ]},
  { id: 8, name: "Softwaretechnik", ects: 6, prof: "Prof. Lang", color: "var(--chip-5)",
    appointments: [
      { type: "vl", start: "2026-04-17T10:00", end: "2026-04-17T12:00" },
      { type: "ub", start: "2026-04-18T14:00", end: "2026-04-18T15:30" },
      { type: "vl", start: "2026-04-24T10:00", end: "2026-04-24T12:00" },
      { type: "ub", start: "2026-04-25T14:00", end: "2026-04-25T15:30" },
      { type: "vl", start: "2026-05-08T10:00", end: "2026-05-08T12:00" },
      { type: "klausur", start: "2026-07-27T09:00", end: "2026-07-27T11:00" }, /* ~46h after TheoInf exam = <48h yellow */
    ]},
];

/* ===== CONFLICT ENGINE ===== */

function examSeverity(examA, examB) {
  if (overlaps(examA, examB)) return "overlap";
  const gap = hoursBetween(examA, examB);
  if (gap < 24) return "24h";
  if (gap < 48) return "48h";
  return null;
}

const EXAM_SEVERITY = {
  overlap: { color: "var(--tint-red)",    bg: "rgba(255,59,48,0.12)",  label: "Zeitgleich",     rank: 3 },
  "24h":   { color: "var(--tint-orange)", bg: "rgba(255,149,0,0.12)",  label: "Innerhalb 24h",  rank: 2 },
  "48h":   { color: "oklch(0.75 0.15 85)", bg: "oklch(0.75 0.15 85 / 0.12)", label: "Innerhalb 48h", rank: 1 },
};

function computeConflicts(picked) {
  const pairs = []; // { a, b, clashes: [{apptA, apptB}], examSev }
  const perCourse = {}; // id -> { clashCount, totalAppts, worstExamSev }

  picked.forEach(c => {
    if (!perCourse[c.id]) perCourse[c.id] = { clashCount: 0, totalAppts: c.appointments.length, worstExamSev: null };
  });

  picked.forEach((a, i) => {
    picked.slice(i + 1).forEach(b => {
      const clashes = [];
      const examA = a.appointments.find(x => x.type === "klausur");
      const examB = b.appointments.find(x => x.type === "klausur");

      // Check all non-exam appointment overlaps
      a.appointments.forEach(aa => {
        b.appointments.forEach(bb => {
          if (aa.type === "klausur" && bb.type === "klausur") return; // handle separately
          if (overlaps(aa, bb)) clashes.push({ apptA: aa, apptB: bb });
        });
      });

      // Exam proximity
      let examSev = null;
      if (examA && examB) {
        examSev = examSeverity(examA, examB);
      }

      if (clashes.length > 0 || examSev) {
        pairs.push({ a, b, clashes, examSev });

        // Update per-course stats
        const uniqueA = new Set(clashes.map(c => c.apptA.start));
        const uniqueB = new Set(clashes.map(c => c.apptB.start));
        perCourse[a.id].clashCount += uniqueA.size;
        perCourse[b.id].clashCount += uniqueB.size;

        if (examSev) {
          const rank = EXAM_SEVERITY[examSev].rank;
          [a.id, b.id].forEach(id => {
            const cur = perCourse[id].worstExamSev;
            if (!cur || rank > EXAM_SEVERITY[cur].rank) perCourse[id].worstExamSev = examSev;
          });
        }
      }
    });
  });

  return { pairs, perCourse };
}

/* ===== COURSE CATALOGUE (additional courses not in overview by default) ===== */
const CATALOGUE_EXTRA = [
  { id: 101, name: "Diskrete Mathematik", ects: 6, prof: "Prof. Fischer", color: "var(--chip-3)",
    appointments: [
      { type: "vl", start: "2026-04-15T08:00", end: "2026-04-15T10:00" },
      { type: "vl", start: "2026-04-17T08:00", end: "2026-04-17T10:00" },
      { type: "ub", start: "2026-04-18T12:00", end: "2026-04-18T13:30" },
      { type: "klausur", start: "2026-07-20T09:00", end: "2026-07-20T11:00" },
    ]},
  { id: 102, name: "Betriebssysteme", ects: 6, prof: "Prof. Richter", color: "var(--chip-5)",
    appointments: [
      { type: "vl", start: "2026-04-14T12:00", end: "2026-04-14T14:00" },
      { type: "ub", start: "2026-04-16T16:00", end: "2026-04-16T17:30" },
      { type: "klausur", start: "2026-07-22T10:00", end: "2026-07-22T12:00" },
    ]},
  { id: 103, name: "Rechnerarchitektur", ects: 6, prof: "Prof. Neumann", color: "var(--chip-8)",
    appointments: [
      { type: "vl", start: "2026-04-15T16:00", end: "2026-04-15T18:00" },
      { type: "ub", start: "2026-04-17T16:00", end: "2026-04-17T17:30" },
      { type: "klausur", start: "2026-07-24T09:00", end: "2026-07-24T11:00" },
    ]},
  { id: 104, name: "Einführung in Machine Learning", ects: 6, prof: "Prof. Schneider", color: "var(--chip-1)",
    appointments: [
      { type: "vl", start: "2026-04-14T16:00", end: "2026-04-14T18:00" },
      { type: "vl", start: "2026-04-16T16:00", end: "2026-04-16T18:00" },
      { type: "ub", start: "2026-04-18T08:00", end: "2026-04-18T09:30" },
      { type: "klausur", start: "2026-07-28T09:00", end: "2026-07-28T12:00" },
    ]},
  { id: 105, name: "Computergrafik", ects: 6, prof: "Prof. Hartmann", color: "var(--chip-4)",
    appointments: [
      { type: "vl", start: "2026-04-15T12:00", end: "2026-04-15T14:00" },
      { type: "ub", start: "2026-04-16T12:00", end: "2026-04-16T13:30" },
      { type: "klausur", start: "2026-07-21T09:00", end: "2026-07-21T11:00" },
    ]},
  { id: 106, name: "Funktionale Programmierung", ects: 6, prof: "Prof. Seidel", color: "var(--chip-2)",
    appointments: [
      { type: "vl", start: "2026-04-14T10:00", end: "2026-04-14T12:00" },
      { type: "ub", start: "2026-04-15T10:00", end: "2026-04-15T11:30" },
      { type: "klausur", start: "2026-07-19T09:00", end: "2026-07-19T11:00" },
    ]},
];

/* ===== ADD COURSE MODAL ===== */
function AddCourseModal({ visible, onClose, onAdd, onRemove, visibleIds, selected }) {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    if (visible && inputRef.current) setTimeout(() => inputRef.current.focus(), 100);
    if (visible) setQuery("");
  }, [visible]);

  if (!visible) return null;

  const allCourses = [...COURSES_DB, ...CATALOGUE_EXTRA];
  const filtered = allCourses.filter(c => {
    if (query && !c.name.toLowerCase().includes(query.toLowerCase()) && !c.prof.toLowerCase().includes(query.toLowerCase())) return false;
    if (category === "added") return visibleIds.includes(c.id);
    if (category === "catalogue") return !visibleIds.includes(c.id);
    return true;
  });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "grid", placeItems: "center", padding: 24 }} onClick={onClose}>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}></div>
      <div onClick={e => e.stopPropagation()} style={{
        position: "relative", zIndex: 1, width: "100%", maxWidth: 560,
        background: "var(--bg-elevated)", borderRadius: 16,
        boxShadow: "var(--shadow-lg)", overflow: "hidden",
        display: "flex", flexDirection: "column", maxHeight: "80vh",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 20px 12px", borderBottom: "0.5px solid var(--separator)", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Vorlesung hinzufügen</div>
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 999, background: "var(--fill-tertiary)", border: "none", display: "grid", placeItems: "center", cursor: "pointer", color: "var(--label-secondary)" }}>
              <Icon name="x" size={14} />
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, height: 36, padding: "0 12px", background: "var(--fill-quaternary)", borderRadius: 10 }}>
            <Icon name="search" size={16} color="var(--label-tertiary)" />
            <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Kurs oder Dozent suchen…"
              style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 15, color: "var(--label-primary)" }} />
            {query && <button onClick={() => setQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--label-tertiary)", padding: 0 }}><Icon name="x" size={14} /></button>}
          </div>
          <SegmentedControl options={["Alle", "Im Plan", "Katalog"]} active={category === "all" ? 0 : category === "added" ? 1 : 2} onChange={i => setCategory(["all","added","catalogue"][i])} />
        </div>

        {/* List */}
        <div style={{ overflowY: "auto", flex: 1, padding: "8px 0" }}>
          {filtered.length === 0 && (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--label-tertiary)", fontSize: 14 }}>Keine Kurse gefunden</div>
          )}
          {filtered.map(c => {
            const inPlan = visibleIds.includes(c.id);
            const isSelected = selected.includes(c.id);
            const examAppt = c.appointments.find(a => a.type === "klausur");
            return (
              <div key={c.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 20px",
                transition: "background 0.12s",
              }} onMouseEnter={e => e.currentTarget.style.background = "var(--fill-quaternary)"}
                 onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: `color-mix(in srgb, ${c.color} 18%, var(--bg-grouped-secondary))`,
                  display: "grid", placeItems: "center",
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: c.color }}>{c.ects}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: "var(--label-secondary)", marginTop: 1 }}>
                    {c.prof} · {c.ects} CP{examAppt ? ` · Klausur ${fmtDate(examAppt.start)}` : ""}
                  </div>
                </div>
                {inPlan ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {isSelected && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--tint-blue)" }}>Gewählt</span>}
                    <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "var(--fill-quaternary)", color: "var(--label-tertiary)" }}>Im Plan</span>
                  </div>
                ) : (
                  <AppleBtn variant="primary" size="sm" icon="plus" onClick={() => onAdd(c)}>Hinzufügen</AppleBtn>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ===== OVERVIEW ===== */
function SemesterOverview({ selected, setSelected, onCourseDetail, visibleCourseIds, setVisibleCourseIds, onOpenCatalogue }) {
  const visibleCourses = COURSES_DB.filter(c => visibleCourseIds.includes(c.id))
    .concat(CATALOGUE_EXTRA.filter(c => visibleCourseIds.includes(c.id)));
  const picked = visibleCourses.filter(c => selected.includes(c.id));
  const totalEcts = picked.reduce((s, c) => s + c.ects, 0);
  const isMobile = window.innerWidth < 768;

  const { pairs, perCourse } = computeConflicts(picked);
  const totalClashPairs = pairs.length;

  const handleRemoveFromOverview = (courseId) => {
    setVisibleCourseIds(visibleCourseIds.filter(id => id !== courseId));
    setSelected(selected.filter(id => id !== courseId));
  };

  return (
    <div>
      <PageHeader title="SS 2026" sub={`${picked.length} Kurse · ${totalEcts} CP`}>
        <SegmentedControl options={["Übersicht","Stundenplan","Konflikte"]} active={0} />
      </PageHeader>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Kurse", value: picked.length, max: 8 },
          { label: "CP", value: totalEcts, max: 36 },
          { label: "Klausuren", value: picked.filter(c => c.appointments.some(a => a.type === "klausur")).length, max: 8 },
          { label: "Konflikte", value: totalClashPairs, max: picked.length, warn: true },
        ].map((s, i) => (
          <AppleCard key={i}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--label-tertiary)", marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: s.warn && s.value > 0 ? "var(--tint-orange)" : "var(--label-primary)" }}>{s.value}</div>
            <div style={{ marginTop: 8 }}>
              <GradientProgress pct={Math.min(100, (s.value / s.max) * 100)} />
            </div>
          </AppleCard>
        ))}
      </div>

      {/* Course list */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
        {visibleCourses.map(c => {
          const active = selected.includes(c.id);
          const info = active ? perCourse[c.id] : null;
          const hasClash = info && info.clashCount > 0;
          const hasExam = info && info.worstExamSev;
          const examAppt = c.appointments.find(a => a.type === "klausur");
          const examSev = hasExam ? EXAM_SEVERITY[info.worstExamSev] : null;

          return (
            <AppleCard key={c.id} style={{
              outline: active ? "2px solid var(--tint-blue)" : "none",
              outlineOffset: -1,
              opacity: active ? 1 : 0.7,
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                  background: `color-mix(in srgb, ${c.color} 18%, var(--bg-grouped-secondary))`,
                  display: "grid", placeItems: "center",
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: c.color }}>{c.ects}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{c.name}</span>
                    {hasExam && <AppleBadge color={examSev.color} bg={examSev.bg}>{examSev.label}</AppleBadge>}
                    {hasClash && <AppleBadge color="var(--tint-orange)" bg="rgba(255,149,0,0.12)">{info.clashCount} von {info.totalAppts} Terminen</AppleBadge>}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--label-secondary)", marginTop: 2 }}>{c.prof}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "var(--fill-quaternary)" }}>
                      {c.appointments.filter(a => a.type === "vl").length} VL · {c.appointments.filter(a => a.type === "ub").length} ÜB
                    </span>
                    {examAppt && (
                      <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, fontWeight: examSev ? 600 : 400, background: examSev ? examSev.bg : "var(--fill-quaternary)", color: examSev ? examSev.color : "inherit" }}>
                        Klausur: {fmtDate(examAppt.start)} {fmtTime(examAppt.start)}–{fmtTime(examAppt.end)}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                  {!active && (
                    <button onClick={() => handleRemoveFromOverview(c.id)} title="Aus Übersicht entfernen"
                      style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "rgba(255,59,48,0.1)", cursor: "pointer", display: "grid", placeItems: "center", color: "var(--tint-red)", transition: "opacity 0.15s, background 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,59,48,0.2)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,59,48,0.1)"; }}>
                      <Icon name="trash" size={16} />
                    </button>
                  )}
                  <AppleBtn variant="secondary" size="sm" onClick={() => onCourseDetail(c.id)}>Details</AppleBtn>
                  <AppleBtn variant={active ? "primary" : "secondary"} size="sm"
                    onClick={() => setSelected(active ? selected.filter(x => x !== c.id) : [...selected, c.id])}>
                    {active ? "Gewählt" : "Wählen"}
                  </AppleBtn>
                </div>
              </div>
            </AppleCard>
          );
        })}

        {/* Add course card */}
        <div onClick={onOpenCatalogue} style={{
          borderRadius: "var(--radius-md)", border: "1.5px dashed var(--separator)",
          display: "grid", placeItems: "center", minHeight: 100, cursor: "pointer",
          transition: "border-color 0.15s, background 0.15s",
        }} onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--tint-blue)"; e.currentTarget.style.background = "rgba(10,132,255,0.04)"; }}
           onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--separator)"; e.currentTarget.style.background = "transparent"; }}>
          <div style={{ textAlign: "center", color: "var(--label-tertiary)" }}>
            <Icon name="plus" size={24} color="var(--tint-blue)" />
            <div style={{ fontSize: 14, fontWeight: 500, marginTop: 6, color: "var(--tint-blue)" }}>Vorlesung hinzufügen</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== TIMETABLE VIEW ===== */
function TimetableView({ selected }) {
  const picked = COURSES_DB.filter(c => selected.includes(c.id));
  const days = ["Mo","Di","Mi","Do","Fr"];
  const hours = ["08","09","10","11","12","13","14","15","16","17"];
  const ROW_H = 52;

  // For the timetable we show a "typical week" by grouping appointments by weekday
  // Show the first occurrence per weekday+time combo
  const grid = [];
  const seen = new Set();
  picked.forEach(c => {
    c.appointments.forEach(a => {
      if (a.type === "klausur") return;
      const dt = new Date(a.start);
      const de = new Date(a.end);
      const di = dt.getDay(); // 0=So
      const dayIdx = [0,1,2,3,4,5,6].indexOf(di); // map to Mo=1..Fr=5
      const mappedDi = di >= 1 && di <= 5 ? di - 1 : -1;
      if (mappedDi < 0) return;
      const startH = dt.getHours();
      const spanH = (de.getTime() - dt.getTime()) / (1000*60*60);
      const key = `${c.id}-${mappedDi}-${startH}`;
      if (seen.has(key)) return;
      seen.add(key);
      grid.push({ ...c, di: mappedDi, startH: startH - 8, spanH, apptType: a.type });
    });
  });

  return (
    <div>
      <PageHeader title="Stundenplan" sub="SS 2026 · Typische Woche">
        <SegmentedControl options={["Übersicht","Stundenplan","Konflikte"]} active={1} />
      </PageHeader>
      <AppleCard noPad style={{ overflow: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "48px repeat(5,1fr)", minWidth: 650 }}>
          <div style={{ borderBottom: "0.5px solid var(--separator)" }}></div>
          {days.map((d, i) => (
            <div key={i} style={{ padding: "10px 0", textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--label-secondary)", borderBottom: "0.5px solid var(--separator)", borderLeft: "0.5px solid var(--separator)" }}>{d}</div>
          ))}
          {hours.map((h, hi) => (
            <React.Fragment key={hi}>
              <div style={{ height: ROW_H, display: "flex", alignItems: "flex-start", justifyContent: "flex-end", padding: "2px 6px 0 0", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--label-tertiary)", borderTop: "0.5px solid var(--separator)" }}>{h}:00</div>
              {days.map((_, di) => {
                const ev = grid.filter(e => e.di === di && e.startH === hi);
                return (
                  <div key={di} style={{ position: "relative", height: ROW_H, borderTop: "0.5px solid var(--separator)", borderLeft: "0.5px solid var(--separator)" }}>
                    {ev.map((e, i) => (
                      <div key={i} style={{ position: "absolute", top: 2, left: ev.length > 1 ? `${(i / ev.length) * 100}%` : 2, right: ev.length > 1 ? `${((ev.length - i - 1) / ev.length) * 100}%` : 2, height: e.spanH * ROW_H - 4, zIndex: 2, marginLeft: ev.length > 1 ? 1 : 0, marginRight: ev.length > 1 ? 1 : 0 }}>
                        <EventChip title={e.name} sub={TYPE_SHORT[e.apptType]} color={e.color} tall />
                      </div>
                    ))}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </AppleCard>
    </div>
  );
}

/* ===== CONFLICTS VIEW ===== */
function ConflictsView({ selected }) {
  const picked = COURSES_DB.filter(c => selected.includes(c.id));
  const { pairs } = computeConflicts(picked);

  // Split into exam conflicts and schedule conflicts
  const examConflicts = pairs.filter(p => p.examSev).sort((a, b) => {
    const sevA = EXAM_SEVERITY[a.examSev].rank;
    const sevB = EXAM_SEVERITY[b.examSev].rank;
    return sevB - sevA;
  });
  const scheduleConflicts = pairs.filter(p => p.clashes.length > 0).sort((a, b) => b.clashes.length - a.clashes.length);

  const totalCount = new Set([...examConflicts.map((_,i)=>i), ...scheduleConflicts.map((_,i)=>i)]).size;

  return (
    <div>
      <PageHeader title="Konflikte" sub={`${pairs.length} Kurspaare mit Überschneidungen`}>
        <SegmentedControl options={["Übersicht","Stundenplan","Konflikte"]} active={2} />
      </PageHeader>

      {pairs.length === 0 ? (
        <AppleCard>
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <Icon name="check" size={48} color="var(--tint-green)" />
            <div style={{ fontSize: 17, fontWeight: 600, marginTop: 12, marginBottom: 4 }}>Keine Konflikte</div>
            <div style={{ fontSize: 14, color: "var(--label-secondary)" }}>Deine Auswahl hat keine Überschneidungen.</div>
          </div>
        </AppleCard>
      ) : (
        <div style={{ display: "grid", gap: 24 }}>
          {/* --- Klausurkonflikte --- */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--label-primary)" }}>Klausurkonflikte</div>
              <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: examConflicts.length > 0 ? "rgba(255,59,48,0.12)" : "rgba(48,209,88,0.12)", color: examConflicts.length > 0 ? "var(--tint-red)" : "var(--tint-green)" }}>
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
                  const examSev = EXAM_SEVERITY[pair.examSev];
                  const examA = pair.a.appointments.find(x => x.type === "klausur");
                  const examB = pair.b.appointments.find(x => x.type === "klausur");
                  return (
                    <AppleCard key={i}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: examSev.bg, display: "grid", placeItems: "center", flexShrink: 0 }}>
                          <Icon name="warning" size={20} color={examSev.color} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: "var(--label-secondary)", marginBottom: 6 }}>
                            <span style={{ borderBottom: `2px solid ${pair.a.color}` }}>{pair.a.name}</span>
                            {" "}↔{" "}
                            <span style={{ borderBottom: `2px solid ${pair.b.color}` }}>{pair.b.name}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: examSev.color }}>{examSev.label}</span>
                            {examA && examB && (
                              <span style={{ fontSize: 11, color: "var(--label-tertiary)" }}>
                                {fmtDate(examA.start)} {fmtTime(examA.start)}–{fmtTime(examA.end)} / {fmtDate(examB.start)} {fmtTime(examB.start)}–{fmtTime(examB.end)}
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

          {/* --- Vorlesungs-/Übungskonflikte --- */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--label-primary)" }}>Vorlesungs- & Übungskonflikte</div>
              <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: scheduleConflicts.length > 0 ? "rgba(255,149,0,0.12)" : "rgba(48,209,88,0.12)", color: scheduleConflicts.length > 0 ? "var(--tint-orange)" : "var(--tint-green)" }}>
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
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,149,0,0.12)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                        <Icon name="warning" size={20} color="var(--tint-orange)" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: "var(--label-secondary)", marginBottom: 6 }}>
                          <span style={{ borderBottom: `2px solid ${pair.a.color}` }}>{pair.a.name}</span>
                          {" "}↔{" "}
                          <span style={{ borderBottom: `2px solid ${pair.b.color}` }}>{pair.b.name}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{pair.clashes.length} Terminkonflikt{pair.clashes.length > 1 ? "e" : ""}</span>
                          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, fontWeight: 600, background: "rgba(255,149,0,0.12)", color: "var(--tint-orange)" }}>
                            {pair.clashes.map(c => `${fmtDate(c.apptA.start)} ${fmtTime(c.apptA.start)}`).slice(0, 3).join(", ")}{pair.clashes.length > 3 ? ` +${pair.clashes.length - 3}` : ""}
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

/* ===== COURSE DETAIL VIEW ===== */
function CourseDetailView({ courseId, selected, setSelected, onBack }) {
  const c = COURSES_DB.find(x => x.id === courseId);
  if (!c) return null;
  const active = selected.includes(c.id);
  const picked = COURSES_DB.filter(x => selected.includes(x.id));
  const isMobile = window.innerWidth < 768;

  // Appointments grouped by type
  const vls = c.appointments.filter(a => a.type === "vl");
  const ubs = c.appointments.filter(a => a.type === "ub");
  const exams = c.appointments.filter(a => a.type === "klausur");

  // Weekly schedule (deduplicated by weekday+time)
  const weeklySlots = [];
  const seenSlots = new Set();
  c.appointments.filter(a => a.type !== "klausur").forEach(a => {
    const dt = new Date(a.start);
    const de = new Date(a.end);
    const day = DAYS_DE[dt.getDay()];
    const key = `${day}-${fmtTime(a.start)}-${a.type}`;
    if (seenSlots.has(key)) return;
    seenSlots.add(key);
    weeklySlots.push({ day, start: fmtTime(a.start), end: fmtTime(de), type: a.type });
  });

  // Conflicts with other selected courses
  const conflicts = [];
  picked.forEach(other => {
    if (other.id === c.id) return;
    const clashes = [];
    c.appointments.forEach(aa => {
      other.appointments.forEach(bb => {
        if (aa.type === "klausur" && bb.type === "klausur") return;
        if (overlaps(aa, bb)) clashes.push({ mine: aa, theirs: bb });
      });
    });
    const examA = c.appointments.find(x => x.type === "klausur");
    const examB = other.appointments.find(x => x.type === "klausur");
    let examSev = null;
    if (examA && examB) examSev = examSeverity(examA, examB);
    if (clashes.length > 0 || examSev) conflicts.push({ other, clashes, examSev });
  });

  return (
    <div>
      {/* Back + header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "var(--tint-blue)", fontSize: 14, fontWeight: 500, cursor: "pointer", padding: "6px 0" }}>
          <Icon name="chevron-left" size={16} /> Zurück
        </button>
      </div>

      {/* Hero card */}
      <AppleCard style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: `color-mix(in srgb, ${c.color} 18%, var(--bg-grouped-secondary))`, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: c.color }}>{c.ects}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>{c.name}</div>
            <div style={{ fontSize: 14, color: "var(--label-secondary)" }}>{c.prof}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              <AppleBadge color={c.color} bg={`color-mix(in srgb, ${c.color} 14%, transparent)`}>{c.ects} CP</AppleBadge>
              <AppleBadge color="var(--label-secondary)" bg="var(--fill-quaternary)">{vls.length} VL · {ubs.length} ÜB</AppleBadge>
            </div>
          </div>
          <AppleBtn variant={active ? "primary" : "secondary"} size="sm"
            onClick={() => setSelected(active ? selected.filter(x => x !== c.id) : [...selected, c.id])}>
            {active ? "Gewählt" : "Wählen"}
          </AppleBtn>
        </div>
      </AppleCard>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
        {/* Weekly schedule */}
        <AppleCard>
          <div style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--label-tertiary)", marginBottom: 12 }}>Wöchentlicher Rhythmus</div>
          <div style={{ display: "grid", gap: 8 }}>
            {weeklySlots.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: "var(--fill-quaternary)" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.color, flexShrink: 0 }}></div>
                <span style={{ fontSize: 13, fontWeight: 600, width: 28 }}>{s.day}</span>
                <span style={{ fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--label-secondary)" }}>{s.start}–{s.end}</span>
                <span style={{ fontSize: 11, marginLeft: "auto", padding: "2px 7px", borderRadius: 5, background: `color-mix(in srgb, ${c.color} 12%, transparent)`, color: c.color, fontWeight: 600 }}>{TYPE_SHORT[s.type]}</span>
              </div>
            ))}
          </div>
        </AppleCard>

        {/* Exam */}
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          {exams.length > 0 && (
            <AppleCard>
              <div style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--label-tertiary)", marginBottom: 12 }}>Klausur</div>
              {exams.map((e, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: "var(--fill-quaternary)" }}>
                  <Icon name="calendar" size={16} color="var(--label-secondary)" />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{fmtDate(e.start)}</div>
                    <div style={{ fontSize: 12, color: "var(--label-secondary)", fontFamily: "var(--font-mono)" }}>{fmtTime(e.start)}–{fmtTime(e.end)}</div>
                  </div>
                </div>
              ))}
            </AppleCard>
          )}

          {/* Alle Termine */}
          <AppleCard>
            <div style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--label-tertiary)", marginBottom: 12 }}>Alle Termine ({c.appointments.length})</div>
            <div style={{ display: "grid", gap: 4, maxHeight: 260, overflowY: "auto" }}>
              {c.appointments.map((a, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, fontSize: 12, color: "var(--label-secondary)" }}>
                  <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, fontWeight: 600, background: a.type === "klausur" ? "rgba(255,59,48,0.12)" : "var(--fill-quaternary)", color: a.type === "klausur" ? "var(--tint-red)" : "inherit", width: 48, textAlign: "center", flexShrink: 0 }}>{TYPE_SHORT[a.type]}</span>
                  <span>{fmtDay(a.start)} {fmtDate(a.start)}</span>
                  <span style={{ fontFamily: "var(--font-mono)" }}>{fmtTime(a.start)}–{fmtTime(a.end)}</span>
                </div>
              ))}
            </div>
          </AppleCard>
        </div>
      </div>

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--label-tertiary)", marginBottom: 12 }}>Konflikte mit gewählten Kursen</div>
          <div style={{ display: "grid", gap: 10 }}>
            {conflicts.map((cf, i) => {
              const examSev = cf.examSev ? EXAM_SEVERITY[cf.examSev] : null;
              return (
                <AppleCard key={i}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: cf.other.color, flexShrink: 0 }}></div>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{cf.other.name}</span>
                    {cf.clashes.length > 0 && (
                      <AppleBadge color="var(--tint-orange)" bg="rgba(255,149,0,0.12)">{cf.clashes.length} Terminkonflikt{cf.clashes.length > 1 ? "e" : ""}</AppleBadge>
                    )}
                    {examSev && (
                      <AppleBadge color={examSev.color} bg={examSev.bg}>Klausur: {examSev.label}</AppleBadge>
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

Object.assign(window, {
  COURSES_DB, CATALOGUE_EXTRA, SemesterOverview, TimetableView, ConflictsView, CourseDetailView, AddCourseModal,
});
