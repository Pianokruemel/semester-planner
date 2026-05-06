import type { CSSProperties, MouseEventHandler, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "secondary" | "plain" | "gradient" | "destructive" | "filled";
type Size = "sm" | "md" | "lg";

type Props = {
  children?: ReactNode;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  style?: CSSProperties;
  full?: boolean;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
};

const sizes: Record<Size, CSSProperties> = {
  sm: { height: 30, padding: "0 12px", fontSize: 13, borderRadius: 8 },
  md: { height: 36, padding: "0 16px", fontSize: 15, borderRadius: 10 },
  lg: { height: 44, padding: "0 20px", fontSize: 17, borderRadius: 12 }
};

const variants: Record<Variant, CSSProperties> = {
  primary: { background: "var(--tint-blue)", color: "#fff" },
  secondary: { background: "var(--fill-tertiary)", color: "var(--label-primary)" },
  plain: { background: "transparent", color: "var(--tint-blue)", padding: 0, height: "auto" },
  gradient: { background: "var(--plani-gradient)", color: "var(--on-gradient)" },
  destructive: { background: "var(--fill-tertiary)", color: "var(--tint-red)" },
  filled: { background: "var(--label-primary)", color: "var(--bg-primary)" }
};

export function AppleBtn({
  children,
  variant = "secondary",
  size = "md",
  icon,
  onClick,
  style,
  full,
  disabled,
  type = "button"
}: Props) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        border: "none",
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "opacity var(--dur-fast) var(--ease-default)",
        whiteSpace: "nowrap",
        width: full ? "100%" : undefined,
        ...sizes[size],
        ...variants[variant],
        ...style
      }}
    >
      {icon && <Icon name={icon} size={size === "sm" ? 14 : 16} />}
      {children}
    </button>
  );
}
