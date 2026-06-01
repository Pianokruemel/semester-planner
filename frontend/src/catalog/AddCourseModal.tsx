import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppleBtn } from "../components/AppleBtn";
import { Icon } from "../components/Icon";
import {
  extractSmallGroups,
  fetchCatalogCourse,
  searchCatalogCourses,
  type CatalogCourseCard,
  type CatalogCourseDetail,
  type CatalogSmallGroup
} from "../api/catalog";
import { usePlan } from "../app/PlanProvider";
import { fmtDate, fmtDay, fmtTime } from "../lib/formatDate";
import { useFocusTrap } from "../lib/useFocusTrap";

type Props = { visible: boolean; onClose: () => void };

const SEARCH_DEBOUNCE_MS = 220;

export function AddCourseModal({ visible, onClose }: Props) {
  const { plan, addCatalogCourse, clearError } = usePlan();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogCourseCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CatalogCourseDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedSubgroupKey, setSelectedSubgroupKey] = useState<string | null>(null);
  const [cpInput, setCpInput] = useState("");
  const [categoryInput, setCategoryInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogRef, visible, onClose);

  const importedCatalogIds = new Set(
    (plan?.courses ?? []).map((c) => c.catalog_course_id).filter((x): x is string => !!x)
  );

  const programKey = plan?.preferred_study_program_key ?? null;
  const planCategories = plan?.categories ?? [];

  const previewCard = useMemo(
    () => (previewId ? results.find((c) => c.id === previewId) ?? null : null),
    [previewId, results]
  );

  const programmeMatch = useMemo(() => {
    if (!previewCard || !programKey) return null;
    return previewCard.programmes.find((p) => p.program_key === programKey) ?? null;
  }, [previewCard, programKey]);

  const needsManualEntry = (card: CatalogCourseCard): boolean => {
    const m = programKey ? card.programmes.find((p) => p.program_key === programKey) ?? null : null;
    if (!m) return true;
    if (!m.cp || m.cp <= 0) return true;
    if (!m.category_key) return true;
    return !planCategories.some((c) => c.curriculum_category_key === m.category_key);
  };

  const smallGroups: CatalogSmallGroup[] = useMemo(() => {
    return detail ? extractSmallGroups(detail.details_json) : [];
  }, [detail]);

  useEffect(() => {
    if (!visible) return;
    setQuery("");
    setResults([]);
    setError(null);
    setPreviewId(null);
    setDetail(null);
    setSelectedSubgroupKey(null);
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [visible]);

  useEffect(() => {
    if (!visible || previewId) return;
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
  }, [query, visible, previewId]);

  useEffect(() => {
    if (!previewId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetail(null);
    setError(null);
    fetchCatalogCourse(previewId)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Kursdetails konnten nicht geladen werden.";
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [previewId]);

  if (!visible) return null;

  const openPreview = (course: CatalogCourseCard) => {
    setPreviewId(course.id);
    setSelectedSubgroupKey(null);
    setCpInput(course.cp && course.cp > 0 ? String(course.cp) : "");
    setCategoryInput(planCategories[0]?.id ?? "");
    setError(null);
  };

  const closePreview = () => {
    setPreviewId(null);
    setDetail(null);
    setSelectedSubgroupKey(null);
    setError(null);
  };

  const handleImport = async () => {
    if (!previewCard) return;
    const manual = needsManualEntry(previewCard);
    let cpOverride: number | undefined;
    let categoryId: string | undefined;
    if (manual) {
      const cpNum = Number.parseInt(cpInput, 10);
      if (!Number.isFinite(cpNum) || cpNum <= 0) {
        setError("Bitte eine gültige CP-Zahl eingeben.");
        return;
      }
      if (!categoryInput) {
        setError("Bitte eine Kategorie auswählen.");
        return;
      }
      cpOverride = cpNum;
      categoryId = categoryInput;
    }
    if (smallGroups.length > 0 && !selectedSubgroupKey) {
      setError("Bitte eine Übungsgruppe auswählen.");
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const newCourseId = await addCatalogCourse(previewCard.id, {
        categoryId,
        cpOverride,
        selectedSubgroupKey: selectedSubgroupKey ?? null
      });
      onClose();
      navigate(`/course/${newCourseId}`);
    } catch (e) {
      // Surface the failure inline in the dialog only; clear the global banner
      // that addCatalogCourse's mutation wrapper raised so it isn't shown twice
      // (and doesn't linger behind the modal after it closes).
      const msg = e instanceof Error ? e.message : "Import fehlgeschlagen.";
      setError(msg);
      clearError();
    } finally {
      setImporting(false);
    }
  };

  const inPlan = previewCard ? importedCatalogIds.has(previewCard.id) : false;
  const manual = previewCard ? needsManualEntry(previewCard) : false;

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
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Vorlesung hinzufügen"
        tabIndex={-1}
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
          maxHeight: "85vh"
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            {previewId ? (
              <button
                onClick={closePreview}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  background: "none",
                  border: "none",
                  color: "var(--tint-blue)",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  padding: 0
                }}
              >
                <Icon name="chevLeft" size={16} /> Suche
              </button>
            ) : (
              <div style={{ fontSize: 17, fontWeight: 700 }}>Vorlesung hinzufügen</div>
            )}
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
          {!previewId && (
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
          )}
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: previewId ? "16px 20px" : "8px 0" }}>
          {error && (
            <div style={{ padding: previewId ? "0 0 12px" : "16px 20px", color: "var(--tint-red)", fontSize: 13 }}>
              {error}
            </div>
          )}

          {!previewId && (
            <>
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
                  const rowInPlan = importedCatalogIds.has(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => openPreview(c)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 20px",
                        background: "transparent",
                        border: "none",
                        textAlign: "left",
                        cursor: "pointer",
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
                            textOverflow: "ellipsis",
                            color: "var(--label-primary)"
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
                      {rowInPlan ? (
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
                        <Icon name="chevRight" size={14} color="var(--label-tertiary)" />
                      )}
                    </button>
                  );
                })}
            </>
          )}

          {previewId && previewCard && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.25 }}>{previewCard.title}</div>
                <div style={{ fontSize: 12, color: "var(--label-secondary)", marginTop: 4 }}>
                  {[
                    previewCard.course_number,
                    previewCard.semester_key,
                    previewCard.instructors.join(", ") || null,
                    previewCard.cp ? `${previewCard.cp} CP` : null
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                {programmeMatch && (
                  <div style={{ fontSize: 12, color: "var(--label-tertiary)", marginTop: 4 }}>
                    {programmeMatch.program_label}
                    {programmeMatch.module_title ? ` · ${programmeMatch.module_title}` : ""}
                  </div>
                )}
              </div>

              {detailLoading && (
                <div style={{ padding: "16px 0", color: "var(--label-tertiary)", fontSize: 14 }}>
                  Details werden geladen…
                </div>
              )}

              {detail && (
                <>
                  <PreviewAppointments detail={detail} />
                  <SmallGroupPicker
                    groups={smallGroups}
                    selectedKey={selectedSubgroupKey}
                    onSelect={setSelectedSubgroupKey}
                  />
                </>
              )}

              {manual && (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    background: "var(--fill-quaternary)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8
                  }}
                >
                  <div style={{ fontSize: 12, color: "var(--label-secondary)" }}>
                    Dieser Kurs ist deinem Studiengang nicht automatisch zugeordnet. Bitte CP und Kategorie wählen.
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="number"
                      min={1}
                      value={cpInput}
                      onChange={(e) => setCpInput(e.target.value)}
                      placeholder="CP"
                      style={{
                        width: 72,
                        height: 32,
                        padding: "0 10px",
                        borderRadius: 8,
                        border: "0.5px solid var(--separator)",
                        background: "var(--bg-elevated)",
                        color: "var(--label-primary)",
                        fontSize: 14
                      }}
                    />
                    <select
                      value={categoryInput}
                      onChange={(e) => setCategoryInput(e.target.value)}
                      style={{
                        flex: 1,
                        height: 32,
                        padding: "0 10px",
                        borderRadius: 8,
                        border: "0.5px solid var(--separator)",
                        background: "var(--bg-elevated)",
                        color: "var(--label-primary)",
                        fontSize: 14
                      }}
                    >
                      {planCategories.length === 0 && <option value="">Keine Kategorien</option>}
                      {planCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {previewId && previewCard && (
          <div
            style={{
              padding: "12px 20px",
              borderTop: "0.5px solid var(--separator)",
              display: "flex",
              justifyContent: "flex-end",
              gap: 8
            }}
          >
            <AppleBtn variant="secondary" size="sm" onClick={closePreview} disabled={importing}>
              Abbrechen
            </AppleBtn>
            <AppleBtn
              variant="primary"
              size="sm"
              icon="plus"
              disabled={importing || inPlan || (manual && planCategories.length === 0)}
              onClick={() => void handleImport()}
            >
              {inPlan ? "Im Plan" : importing ? "…" : "Hinzufügen"}
            </AppleBtn>
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewAppointments({ detail }: { detail: CatalogCourseDetail }) {
  const baseAppointments = (detail.appointments ?? []).filter((a) => a.type !== "Uebung");
  if (baseAppointments.length === 0) {
    return (
      <div style={{ fontSize: 13, color: "var(--label-secondary)" }}>
        Keine Vorlesungstermine im Katalog hinterlegt.
      </div>
    );
  }
  return (
    <div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "var(--label-tertiary)",
          marginBottom: 8
        }}
      >
        Vorlesungstermine ({baseAppointments.length})
      </div>
      <div style={{ display: "grid", gap: 4, maxHeight: 160, overflowY: "auto" }}>
        {baseAppointments.map((a) => (
          <div
            key={a.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--label-secondary)",
              background: "var(--fill-quaternary)"
            }}
          >
            <span style={{ width: 24 }}>{fmtDay(a.date)}</span>
            <span>{fmtDate(a.date)}</span>
            <span style={{ fontFamily: "var(--font-mono)" }}>
              {a.time_from}–{a.time_to}
            </span>
            {a.room && <span style={{ marginLeft: "auto" }}>{a.room}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function SmallGroupPicker({
  groups,
  selectedKey,
  onSelect
}: {
  groups: CatalogSmallGroup[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
}) {
  if (groups.length === 0) return null;
  return (
    <div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "var(--label-tertiary)",
          marginBottom: 8
        }}
      >
        Übungsgruppe wählen ({groups.length})
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {groups.map((g) => {
          const selected = selectedKey === g.key;
          return (
            <button
              key={g.key}
              onClick={() => onSelect(selected ? null : g.key)}
              style={{
                textAlign: "left",
                padding: 12,
                borderRadius: 10,
                border: selected ? "1px solid var(--tint-blue)" : "0.5px solid var(--separator)",
                background: selected ? "color-mix(in srgb, var(--tint-blue) 8%, transparent)" : "var(--fill-quaternary)",
                cursor: "pointer",
                color: "var(--label-primary)",
                display: "flex",
                flexDirection: "column",
                gap: 6
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 999,
                    border: selected ? "5px solid var(--tint-blue)" : "1.5px solid var(--label-tertiary)",
                    flexShrink: 0
                  }}
                />
                <span style={{ fontSize: 14, fontWeight: 600 }}>{g.title}</span>
              </div>
              {(g.schedule || g.instructors.length > 0) && (
                <div style={{ fontSize: 12, color: "var(--label-secondary)", paddingLeft: 24 }}>
                  {[g.schedule || null, g.instructors.join(", ") || null].filter(Boolean).join(" · ")}
                </div>
              )}
              {g.appointments.length > 0 && (
                <div style={{ fontSize: 11, color: "var(--label-tertiary)", paddingLeft: 24 }}>
                  {g.appointments.length} Termine · ab {fmtDate(g.appointments[0].date)}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
