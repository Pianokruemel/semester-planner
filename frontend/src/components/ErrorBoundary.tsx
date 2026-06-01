import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

// A render-time throw anywhere in the tree would otherwise unmount the whole app
// to a blank white screen. This shows a recoverable fallback instead.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("ui_error_boundary", error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "var(--bg-grouped)",
          color: "var(--label-secondary)",
          padding: 24,
          textAlign: "center"
        }}
      >
        <div style={{ display: "grid", gap: 16, maxWidth: 360 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: "var(--label-primary)" }}>
            Etwas ist schiefgelaufen
          </div>
          <div style={{ fontSize: 15 }}>
            Die Ansicht konnte nicht geladen werden. Dein Plan ist gespeichert.
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              justifySelf: "center",
              padding: "10px 18px",
              borderRadius: 12,
              border: "none",
              background: "var(--accent, #2563eb)",
              color: "#fff",
              fontSize: 15,
              cursor: "pointer"
            }}
          >
            Neu laden
          </button>
        </div>
      </div>
    );
  }
}
