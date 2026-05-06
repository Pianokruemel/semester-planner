import type { CSSProperties, ReactNode } from "react";

type Props = {
  children?: ReactNode;
  title?: ReactNode;
  trailing?: ReactNode;
  noPad?: boolean;
  style?: CSSProperties;
};

export function AppleCard({ children, title, trailing, noPad, style }: Props) {
  return (
    <div
      style={{
        background: "var(--bg-grouped-secondary)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-card)",
        overflow: "hidden",
        ...style
      }}
    >
      {title && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "0.5px solid var(--separator)"
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
          {trailing}
        </div>
      )}
      {noPad ? children : !title ? <div style={{ padding: 16 }}>{children}</div> : children}
    </div>
  );
}
