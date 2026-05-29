import type { CSSProperties } from "react";

export type IconName =
  | "clock" | "calendar" | "grid" | "book" | "settings" | "search" | "plus"
  | "bell" | "chevLeft" | "chevRight" | "check" | "users" | "chart"
  | "export2" | "logout" | "trash" | "dots" | "sun" | "moon" | "lock"
  | "user" | "home" | "layer" | "warning" | "external" | "menu" | "x"
  | "folder";

type Props = { name: IconName; size?: number; color?: string };

export function Icon({ name, size = 20, color = "currentColor" }: Props) {
  const s: CSSProperties = { width: size, height: size, flexShrink: 0 };
  const p = {
    fill: "none",
    stroke: color,
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };
  switch (name) {
    case "clock":
      return <svg style={s} viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="9.5" /><path d="M12 7v5l3.5 2" /></svg>;
    case "calendar":
      return <svg style={s} viewBox="0 0 24 24" {...p}><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>;
    case "grid":
      return <svg style={s} viewBox="0 0 24 24" {...p}><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M3 10h18M3 16h18M9 4v17M15 4v17" /></svg>;
    case "book":
      return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M4 4.5A2.5 2.5 0 016.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15z" /><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /></svg>;
    case "settings":
      return <svg style={s} viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>;
    case "search":
      return <svg style={s} viewBox="0 0 24 24" {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></svg>;
    case "plus":
      return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M12 5v14M5 12h14" /></svg>;
    case "bell":
      return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" /></svg>;
    case "chevLeft":
      return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M15 18l-6-6 6-6" /></svg>;
    case "chevRight":
      return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M9 18l6-6-6-6" /></svg>;
    case "check":
      return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M5 12l5 5L20 7" /></svg>;
    case "users":
      return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>;
    case "chart":
      return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M3 20l5-5 4 4 9-12" /></svg>;
    case "export2":
      return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M7 10l5-5 5 5M12 5v12M5 19h14" /></svg>;
    case "logout":
      return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h4M16 17l5-5-5-5M21 12H9" /></svg>;
    case "trash":
      return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>;
    case "dots":
      return <svg style={s} viewBox="0 0 24 24" {...p}><circle cx="12" cy="5" r="1" fill={color} /><circle cx="12" cy="12" r="1" fill={color} /><circle cx="12" cy="19" r="1" fill={color} /></svg>;
    case "sun":
      return <svg style={s} viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>;
    case "moon":
      return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>;
    case "lock":
      return <svg style={s} viewBox="0 0 24 24" {...p}><rect x="3" y="11" width="18" height="11" rx="3" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>;
    case "user":
      return <svg style={s} viewBox="0 0 24 24" {...p}><circle cx="12" cy="8" r="4.5" /><path d="M4 21a8 8 0 0116 0" /></svg>;
    case "home":
      return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M3 9.5L12 3l9 6.5V20a2 2 0 01-2 2H5a2 2 0 01-2-2V9.5z" /></svg>;
    case "layer":
      return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>;
    case "warning":
      return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" /></svg>;
    case "external":
      return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" /></svg>;
    case "menu":
      return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M3 12h18M3 6h18M3 18h18" /></svg>;
    case "x":
      return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M18 6L6 18M6 6l12 12" /></svg>;
    case "folder":
      return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>;
  }
}
