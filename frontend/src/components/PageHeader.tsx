import type { ReactNode } from "react";

type Props = { title: string; sub?: string; children?: ReactNode };

export function PageHeader({ title, sub, children }: Props) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 20
      }}
    >
      <div>
        <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.022em", lineHeight: 1.1 }}>{title}</h1>
        {sub && <div style={{ fontSize: 14, color: "var(--label-secondary)", marginTop: 3 }}>{sub}</div>}
      </div>
      {children && <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>{children}</div>}
    </div>
  );
}
