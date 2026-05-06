import type { MouseEventHandler } from "react";

type Props = {
  title: string;
  sub?: string;
  color?: string;
  tall?: boolean;
  onClick?: MouseEventHandler<HTMLDivElement>;
};

export function EventChip({ title, sub, color = "var(--chip-2)", tall, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      style={{
        borderLeft: `3px solid ${color}`,
        background: `color-mix(in srgb, ${color} 18%, var(--bg-grouped-secondary))`,
        borderRadius: 8,
        padding: "8px 10px",
        display: "grid",
        gap: 2,
        cursor: onClick ? "pointer" : "default",
        height: tall ? "100%" : undefined,
        overflow: "hidden"
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--label-secondary)" }}>{sub}</div>}
    </div>
  );
}
