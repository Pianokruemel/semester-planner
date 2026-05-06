import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppleBtn } from "../components/AppleBtn";
import { Icon } from "../components/Icon";
import { searchCatalogCourses, type CatalogCourseCard } from "../api/catalog";
import { usePlan } from "../app/PlanProvider";
import { fmtDate } from "../lib/formatDate";

type Props = { visible: boolean; onClose: () => void };

const SEARCH_DEBOUNCE_MS = 220;

export function AddCourseModal({ visible, onClose }: Props) {
  const { plan, addCatalogCourse } = usePlan();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogCourseCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const importedCatalogIds = new Set(
    (plan?.courses ?? []).map((c) => c.catalog_course_id).filter((x): x is string => !!x)
  );

  useEffect(() => {
    if (!visible) return;
    setQuery("");
    setResults([]);
    setError(null);
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const handle = setTimeout(async () => {
      try {
        const res = await searchCatalogCourses({ q: query, limit: 30 });
        if (!cancelled) setResults(res.items);
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Suche fehlgeschlagen.";
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, visible]);

  if (!visible) return null;

  const handleImport = async (course: CatalogCourseCard) => {
    setImportingId(course.id);
    try {
      const newCourseId = await addCatalogCourse(course.id);
      onClose();
      navigate(`/course/${newCourseId}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Import fehlgeschlagen.";
      setError(msg);
    } finally {
      setImportingId(null);
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
          maxWidth: 560,
          background: "var(--bg-elevated)",
          borderRadius: 16,
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "80vh"
        }}
      >
        <div
          style={{
            padding: "16px 20px 12px",
            borderBottom: "0.5px solid var(--separator)",
            display: "flex",
            flexDirection: "column",
            gap: 12
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Vorlesung hinzufügen</div>
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              height: 36,
              padding: "0 12px",
              background: "var(--fill-quaternary)",
              borderRadius: 10
            }}
          >
            <Icon name="search" size={16} color="var(--label-tertiary)" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Kurs, Dozent oder Kursnummer suchen…"
              style={{
                flex: 1,
                background: "none",
                border: "none",
                outline: "none",
                fontSize: 15,
                color: "var(--label-primary)"
              }}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--label-tertiary)",
                  padding: 0
                }}
              >
                <Icon name="x" size={14} />
              </button>
            )}
          </div>
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: "8px 0" }}>
          {error && (
            <div style={{ padding: "16px 20px", color: "var(--tint-red)", fontSize: 13 }}>{error}</div>
          )}
          {loading && (
            <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--label-tertiary)", fontSize: 14 }}>
              Suche…
            </div>
          )}
          {!loading && !error && results.length === 0 && (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--label-tertiary)", fontSize: 14 }}>
              {query ? "Keine Kurse gefunden" : "Beginne zu tippen, um zu suchen"}
            </div>
          )}
          {!loading && !error &&
            results.map((c) => {
              const inPlan = importedCatalogIds.has(c.id);
              const isImporting = importingId === c.id;
              return (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 20px",
                    transition: "background 0.12s"
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--fill-quaternary)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      flexShrink: 0,
                      background: "var(--fill-quaternary)",
                      display: "grid",
                      placeItems: "center"
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--label-secondary)" }}>
                      {c.cp ?? "—"}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis"
                      }}
                    >
                      {c.title}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--label-secondary)",
                        marginTop: 1,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis"
                      }}
                    >
                      {[
                        c.course_number,
                        c.semester_key,
                        c.instructors[0],
                        c.first_date ? `ab ${fmtDate(c.first_date)}` : null
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  {inPlan ? (
                    <span
                      style={{
                        fontSize: 11,
                        padding: "3px 8px",
                        borderRadius: 6,
                        background: "var(--fill-quaternary)",
                        color: "var(--label-tertiary)"
                      }}
                    >
                      Im Plan
                    </span>
                  ) : (
                    <AppleBtn
                      variant="primary"
                      size="sm"
                      icon="plus"
                      disabled={isImporting}
                      onClick={() => void handleImport(c)}
                    >
                      {isImporting ? "…" : "Hinzufügen"}
                    </AppleBtn>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
