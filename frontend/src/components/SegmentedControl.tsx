type Props = {
  options: string[];
  active: number;
  onChange?: (index: number) => void;
};

export function SegmentedControl({ options, active, onChange }: Props) {
  return (
    <div
      style={{
        display: "inline-flex",
        padding: 2,
        gap: 1,
        background: "var(--fill-quaternary)",
        borderRadius: 9,
        position: "relative"
      }}
    >
      {options.map((o, i) => (
        <button
          key={i}
          onClick={() => onChange?.(i)}
          style={{
            padding: "5px 14px",
            borderRadius: 7,
            fontSize: 13,
            fontWeight: 500,
            color: i === active ? "var(--label-primary)" : "var(--label-secondary)",
            background: i === active ? "var(--bg-elevated)" : "transparent",
            boxShadow: i === active ? "var(--shadow-sm)" : "none",
            transition: "all var(--dur-fast)",
            zIndex: 1,
            border: "none",
            cursor: "pointer"
          }}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
