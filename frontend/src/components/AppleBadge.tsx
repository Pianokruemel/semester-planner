import type { ReactNode } from "react";

type Props = {
  children?: ReactNode;
  color?: string;
  bg?: string;
};

export function AppleBadge({ children, color = "var(--tint-blue)", bg }: Props) {
  const autoBg = bg ?? `color-mix(in srgb, ${color} 12%, transparent)`;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        color,
        background: autoBg
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} />
      {children}
    </span>
  );
}
