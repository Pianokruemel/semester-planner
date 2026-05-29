/* Plani shared React components — Apple HIG style */

/* ===== ICON SYSTEM ===== */
function Icon({ name, size = 20, color = "currentColor" }) {
  const s = { width: size, height: size, flexShrink: 0 };
  const p = { fill: "none", stroke: color, strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" };
  const icons = {
    clock: <svg style={s} viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="9.5"/><path d="M12 7v5l3.5 2"/></svg>,
    calendar: <svg style={s} viewBox="0 0 24 24" {...p}><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>,
    grid: <svg style={s} viewBox="0 0 24 24" {...p}><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 10h18M3 16h18M9 4v17M15 4v17"/></svg>,
    book: <svg style={s} viewBox="0 0 24 24" {...p}><path d="M4 4.5A2.5 2.5 0 016.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15z"/><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/></svg>,
    settings: <svg style={s} viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
    search: <svg style={s} viewBox="0 0 24 24" {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>,
    plus: <svg style={s} viewBox="0 0 24 24" {...p}><path d="M12 5v14M5 12h14"/></svg>,
    bell: <svg style={s} viewBox="0 0 24 24" {...p}><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>,
    chevLeft: <svg style={s} viewBox="0 0 24 24" {...p}><path d="M15 18l-6-6 6-6"/></svg>,
    chevRight: <svg style={s} viewBox="0 0 24 24" {...p}><path d="M9 18l6-6-6-6"/></svg>,
    check: <svg style={s} viewBox="0 0 24 24" {...p}><path d="M5 12l5 5L20 7"/></svg>,
    users: <svg style={s} viewBox="0 0 24 24" {...p}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
    chart: <svg style={s} viewBox="0 0 24 24" {...p}><path d="M3 20l5-5 4 4 9-12"/></svg>,
    export2: <svg style={s} viewBox="0 0 24 24" {...p}><path d="M7 10l5-5 5 5M12 5v12M5 19h14"/></svg>,
    logout: <svg style={s} viewBox="0 0 24 24" {...p}><path d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h4M16 17l5-5-5-5M21 12H9"/></svg>,
    trash: <svg style={s} viewBox="0 0 24 24" {...p}><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>,
    dots: <svg style={s} viewBox="0 0 24 24" {...p}><circle cx="12" cy="5" r="1" fill={color}/><circle cx="12" cy="12" r="1" fill={color}/><circle cx="12" cy="19" r="1" fill={color}/></svg>,
    sun: <svg style={s} viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
    moon: <svg style={s} viewBox="0 0 24 24" {...p}><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
    lock: <svg style={s} viewBox="0 0 24 24" {...p}><rect x="3" y="11" width="18" height="11" rx="3"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
    user: <svg style={s} viewBox="0 0 24 24" {...p}><circle cx="12" cy="8" r="4.5"/><path d="M4 21a8 8 0 0116 0"/></svg>,
    home: <svg style={s} viewBox="0 0 24 24" {...p}><path d="M3 9.5L12 3l9 6.5V20a2 2 0 01-2 2H5a2 2 0 01-2-2V9.5z"/></svg>,
    layer: <svg style={s} viewBox="0 0 24 24" {...p}><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>,
    warning: <svg style={s} viewBox="0 0 24 24" {...p}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"/></svg>,
    external: <svg style={s} viewBox="0 0 24 24" {...p}><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>,
    menu: <svg style={s} viewBox="0 0 24 24" {...p}><path d="M3 12h18M3 6h18M3 18h18"/></svg>,
    x: <svg style={s} viewBox="0 0 24 24" {...p}><path d="M18 6L6 18M6 6l12 12"/></svg>,
  };
  return icons[name] || null;
}

/* ===== APPLE BUTTON ===== */
function AppleBtn({ children, variant = "secondary", size = "md", icon, onClick, style: extra, full }) {
  const sizes = {
    sm: { height: 30, padding: "0 12px", fontSize: 13, borderRadius: 8 },
    md: { height: 36, padding: "0 16px", fontSize: 15, borderRadius: 10 },
    lg: { height: 44, padding: "0 20px", fontSize: 17, borderRadius: 12 },
  };
  const variants = {
    primary: { background: "var(--tint-blue)", color: "#fff" },
    secondary: { background: "var(--fill-tertiary)", color: "var(--label-primary)" },
    plain: { background: "transparent", color: "var(--tint-blue)", padding: 0, height: "auto" },
    gradient: { background: "var(--plani-gradient)", color: "var(--on-gradient)" },
    destructive: { background: "var(--fill-tertiary)", color: "var(--tint-red)" },
    filled: { background: "var(--label-primary)", color: "var(--bg-primary)" },
  };
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
      border: "none", fontWeight: 600, cursor: "pointer",
      transition: "opacity var(--dur-fast) var(--ease-default)",
      whiteSpace: "nowrap",
      width: full ? "100%" : undefined,
      ...sizes[size], ...variants[variant], ...extra,
    }}>
      {icon && <Icon name={icon} size={size === "sm" ? 14 : 16} />}
      {children}
    </button>
  );
}

/* ===== APPLE SEGMENTED CONTROL ===== */
function SegmentedControl({ options, active, onChange }) {
  return (
    <div style={{
      display: "inline-flex", padding: 2, gap: 1,
      background: "var(--fill-quaternary)",
      borderRadius: 9, position: "relative",
    }}>
      {options.map((o, i) => (
        <button key={i} onClick={() => onChange?.(i)} style={{
          padding: "5px 14px", borderRadius: 7,
          fontSize: 13, fontWeight: 500,
          color: i === active ? "var(--label-primary)" : "var(--label-secondary)",
          background: i === active ? "var(--bg-elevated)" : "transparent",
          boxShadow: i === active ? "var(--shadow-sm)" : "none",
          transition: "all var(--dur-fast)",
          zIndex: 1,
        }}>{o}</button>
      ))}
    </div>
  );
}

/* ===== APPLE CARD ===== */
function AppleCard({ children, title, trailing, noPad, style: extra }) {
  return (
    <div style={{
      background: "var(--bg-grouped-secondary)",
      borderRadius: "var(--radius-md)",
      boxShadow: "var(--shadow-card)",
      overflow: "hidden",
      ...extra,
    }}>
      {title && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "0.5px solid var(--separator)",
        }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
          {trailing}
        </div>
      )}
      {noPad ? children : (!title ? <div style={{ padding: 16 }}>{children}</div> : children)}
    </div>
  );
}

/* ===== APPLE LIST ROW ===== */
function ListRow({ icon, iconColor, iconBg, title, subtitle, trailing, last, onClick }) {
  return (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 16px",
      borderBottom: last ? "none" : "0.5px solid var(--separator)",
      cursor: onClick ? "pointer" : "default",
    }}>
      {icon && (
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: iconBg || "var(--fill-tertiary)",
          color: iconColor || "var(--label-primary)",
          display: "grid", placeItems: "center", flexShrink: 0,
        }}>
          <Icon name={icon} size={16} color={iconColor} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 13, color: "var(--label-secondary)", marginTop: 1 }}>{subtitle}</div>}
      </div>
      {trailing && <div style={{ fontSize: 13, color: "var(--label-secondary)", flexShrink: 0 }}>{trailing}</div>}
      {onClick && <Icon name="chevRight" size={14} color="var(--label-quaternary)" />}
    </div>
  );
}

/* ===== APPLE TOGGLE ===== */
function Toggle({ value, onChange }) {
  return (
    <div onClick={() => onChange?.(!value)} style={{
      width: 51, height: 31, borderRadius: 999, position: "relative", cursor: "pointer",
      background: value ? "var(--tint-green)" : "var(--fill-primary)",
      transition: "background var(--dur-fast)",
      flexShrink: 0,
    }}>
      <div style={{
        width: 27, height: 27, borderRadius: "50%", background: "#fff",
        position: "absolute", top: 2,
        left: value ? 22 : 2,
        transition: "left var(--dur-fast) var(--ease-default)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
      }}></div>
    </div>
  );
}

/* ===== PROGRESS BAR ===== */
function GradientProgress({ pct, height = 6 }) {
  return (
    <div style={{ height, borderRadius: 999, background: "var(--fill-quaternary)", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: "var(--plani-gradient)", borderRadius: 999, transition: "width var(--dur-slow)" }}></div>
    </div>
  );
}

/* ===== BADGE ===== */
function AppleBadge({ children, color = "var(--tint-blue)", bg }) {
  const autoBg = bg || (color + "1A");
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 999,
      fontSize: 12, fontWeight: 600, color,
      background: autoBg,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }}></span>
      {children}
    </span>
  );
}

/* ===== EVENT CHIP ===== */
function EventChip({ title, sub, color = "var(--chip-2)", tall, onClick }) {
  return (
    <div onClick={onClick} style={{
      borderLeft: `3px solid ${color}`,
      background: `color-mix(in srgb, ${color} 18%, var(--bg-grouped-secondary))`,
      borderRadius: 8, padding: "8px 10px",
      display: "grid", gap: 2,
      cursor: onClick ? "pointer" : "default",
      height: tall ? "100%" : undefined,
    }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--label-secondary)" }}>{sub}</div>}
    </div>
  );
}

/* ===== AVATAR ===== */
function Avatar({ initials, size = 32, bg }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: bg || "var(--plani-gradient)",
      color: "var(--on-gradient)",
      display: "grid", placeItems: "center",
      fontSize: size * 0.38, fontWeight: 700,
    }}>{initials}</div>
  );
}

/* ===== SEARCH BAR ===== */
function SearchBar({ placeholder = "Suchen" }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      height: 36, padding: "0 12px",
      background: "var(--fill-quaternary)",
      borderRadius: 10,
      color: "var(--label-tertiary)", fontSize: 15,
      flex: 1, maxWidth: 400,
    }}>
      <Icon name="search" size={16} color="var(--label-tertiary)" />
      <span>{placeholder}</span>
      <span style={{ marginLeft: "auto", fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "var(--fill-tertiary)", fontFamily: "var(--font-mono)" }}>STRG K</span>
    </div>
  );
}

/* ===== SUBJECT DATA ===== */
const SUBJECTS = [
  { name: "Analysis II", short: "Ana", color: "#B7A0E5", ects: 9, type: "Pflicht" },
  { name: "Lineare Algebra", short: "LA", color: "#9CC3F0", ects: 9, type: "Pflicht" },
  { name: "Stochastik", short: "Sto", color: "#B6E3CC", ects: 6, type: "Pflicht" },
  { name: "Theoretische Inf.", short: "ThI", color: "#F2C8A0", ects: 6, type: "Wahlpflicht" },
  { name: "Datenbanken", short: "DB", color: "#F4E59A", ects: 6, type: "Wahlpflicht" },
];

/* ===== PAGE HEADER ===== */
function PageHeader({ title, sub, children }) {
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between",
      gap: 12, marginBottom: 20,
    }}>
      <div>
        <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.022em", lineHeight: 1.1 }}>{title}</h1>
        {sub && <div style={{ fontSize: 14, color: "var(--label-secondary)", marginTop: 3 }}>{sub}</div>}
      </div>
      {children && <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>{children}</div>}
    </div>
  );
}

Object.assign(window, {
  Icon, AppleBtn, SegmentedControl, AppleCard, ListRow, Toggle,
  GradientProgress, AppleBadge, EventChip, Avatar, SearchBar, SUBJECTS, PageHeader,
});
