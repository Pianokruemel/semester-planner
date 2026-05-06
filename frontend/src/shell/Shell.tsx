import { useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { Icon, type IconName } from "../components/Icon";
import { AppleBtn } from "../components/AppleBtn";
import { ShareModal } from "../components/ShareModal";
import { usePlan } from "../app/PlanProvider";
import { AddCourseModal } from "../catalog/AddCourseModal";

type NavEntry = { id: string; label: string; icon: IconName; path: string };

const NAV: NavEntry[] = [
  { id: "overview", label: "Semesterübersicht", icon: "layer", path: "/" },
  { id: "timetable", label: "Stundenplan", icon: "grid", path: "/stundenplan" },
  { id: "conflicts", label: "Konflikte", icon: "warning", path: "/konflikte" }
];

export function Shell() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { uiCourses, theme, toggleTheme } = usePlan();
  const [sideOpen, setSideOpen] = useState(false);
  const [showCatalogue, setShowCatalogue] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const activeNavId = useMemo(() => {
    if (location.pathname.startsWith("/stundenplan")) return "timetable";
    if (location.pathname.startsWith("/konflikte")) return "conflicts";
    return "overview";
  }, [location.pathname]);

  const detailCourse = params.id ? uiCourses.find((c) => c.id === params.id) : null;
  const screenLabel = detailCourse
    ? `Semesterübersicht › ${detailCourse.name}`
    : NAV.find((n) => n.id === activeNavId)?.label ?? "Übersicht";
  const isDetail = !!detailCourse;

  const selectedCourses = uiCourses.filter((c) => c.isActive);

  return (
    <div className="shell">
      {sideOpen && <div className="sidebar-backdrop" onClick={() => setSideOpen(false)} />}
      <nav className={`sidebar ${sideOpen ? "open" : ""}`}>
        <div className="brand">
          <span className="brand-text">Semesti</span>
          <img className="brand-mark" src="/semesti-p-light.png" alt="P" />
          <span className="brand-text">lani</span>
        </div>
        {NAV.map((n) => (
          <div
            key={n.id}
            className={`nav-item ${activeNavId === n.id && !isDetail ? "active" : ""}`}
            onClick={() => {
              navigate(n.path);
              setSideOpen(false);
            }}
          >
            <Icon name={n.icon} size={18} />
            <span>{n.label}</span>
          </div>
        ))}
        {selectedCourses.length > 0 && (
          <>
            <div className="nav-label">Gewählte Kurse</div>
            {selectedCourses.map((c) => (
              <div
                key={c.id}
                className="nav-item"
                style={{ fontSize: 13 }}
                onClick={() => {
                  navigate(`/course/${c.id}`);
                  setSideOpen(false);
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: c.color,
                    flexShrink: 0
                  }}
                />
                {c.name}
              </div>
            ))}
          </>
        )}
      </nav>

      <div className="main-area">
        <div className="topbar">
          <button className="ic-btn mobile-menu" onClick={() => setSideOpen(true)}>
            <Icon name="menu" size={20} />
          </button>
          <div className="topbar-crumbs">
            Semesti · <strong>{screenLabel}</strong>
          </div>
          <div style={{ flex: 1 }} />
          {!isDetail && (
            <AppleBtn variant="gradient" size="sm" icon="plus" onClick={() => setShowCatalogue(true)}>
              Vorlesung hinzufügen
            </AppleBtn>
          )}
          <button className="ic-btn" onClick={() => setShowShare(true)} aria-label="Plan teilen">
            <Icon name="export2" size={18} />
          </button>
          <button className="ic-btn" onClick={toggleTheme} aria-label="Theme umschalten">
            <Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
          </button>
        </div>
        <div className="content">
          <Outlet />
        </div>
      </div>

      <AddCourseModal visible={showCatalogue} onClose={() => setShowCatalogue(false)} />
      <ShareModal visible={showShare} onClose={() => setShowShare(false)} />
    </div>
  );
}
