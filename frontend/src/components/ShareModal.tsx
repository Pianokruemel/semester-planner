import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { usePlan } from "../app/PlanProvider";

type Props = { visible: boolean; onClose: () => void };

type CopyKey = "link" | "token";

export function ShareModal({ visible, onClose }: Props) {
  const { plan } = usePlan();
  const [copied, setCopied] = useState<CopyKey | null>(null);

  useEffect(() => {
    if (!visible) setCopied(null);
  }, [visible]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  if (!visible) return null;

  const token = plan?.share_token ?? null;
  const shareUrl = token ? `${window.location.origin}/share/${token}` : null;

  const handleCopy = async (value: string, key: CopyKey) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 200, display: "grid", placeItems: "center", padding: 24 }}
      onClick={onClose}
    >
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)"
        }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: 460,
          background: "var(--bg-elevated)",
          borderRadius: 16,
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column"
        }}
      >
        <div
          style={{
            padding: "16px 20px 12px",
            borderBottom: "0.5px solid var(--separator)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 700 }}>Plan teilen</div>
          <button
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              background: "var(--fill-tertiary)",
              border: "none",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              color: "var(--label-secondary)"
            }}
          >
            <Icon name="x" size={14} />
          </button>
        </div>

        <div style={{ padding: 20, display: "grid", gap: 18 }}>
          {!token || !shareUrl ? (
            <div style={{ fontSize: 14, color: "var(--label-secondary)", lineHeight: 1.5 }}>
              Für diesen Plan ist noch kein Token vorhanden.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 14, color: "var(--label-secondary)", lineHeight: 1.5 }}>
                Teile deinen Plan über folgenden Link oder Token. Der Link öffnet den Plan direkt.
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: "var(--label-secondary)" }}>Link</label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    height: 40,
                    padding: "0 10px 0 12px",
                    background: "var(--fill-quaternary)",
                    borderRadius: 10,
                    border: "0.5px solid var(--separator)"
                  }}
                >
                  <a
                    href={shareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 14,
                      color: "var(--tint-blue)",
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis"
                    }}
                  >
                    {shareUrl}
                  </a>
                  <button
                    onClick={() => void handleCopy(shareUrl, "link")}
                    aria-label="Link kopieren"
                    style={{
                      height: 28,
                      padding: "0 10px",
                      borderRadius: 8,
                      border: "none",
                      background: "var(--fill-tertiary)",
                      color: "var(--label-primary)",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      flexShrink: 0
                    }}
                  >
                    {copied === "link" ? "Kopiert" : "Kopieren"}
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: "var(--label-secondary)" }}>Token</label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    height: 40,
                    padding: "0 10px 0 12px",
                    background: "var(--fill-quaternary)",
                    borderRadius: 10,
                    border: "0.5px solid var(--separator)"
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 15,
                      color: "var(--label-primary)",
                      fontFamily: "var(--font-mono)",
                      letterSpacing: "0.04em",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis"
                    }}
                  >
                    {token}
                  </span>
                  <button
                    onClick={() => void handleCopy(token, "token")}
                    aria-label="Token kopieren"
                    style={{
                      height: 28,
                      padding: "0 10px",
                      borderRadius: 8,
                      border: "none",
                      background: "var(--fill-tertiary)",
                      color: "var(--label-primary)",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      flexShrink: 0
                    }}
                  >
                    {copied === "token" ? "Kopiert" : "Kopieren"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
