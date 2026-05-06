type Props = { pct: number; height?: number };

export function GradientProgress({ pct, height = 6 }: Props) {
  return (
    <div style={{ height, borderRadius: 999, background: "var(--fill-quaternary)", overflow: "hidden" }}>
      <div
        style={{
          height: "100%",
          width: `${Math.max(0, Math.min(100, pct))}%`,
          background: "var(--plani-gradient)",
          borderRadius: 999,
          transition: "width var(--dur-slow)"
        }}
      />
    </div>
  );
}
