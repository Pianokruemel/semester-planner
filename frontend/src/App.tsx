import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { defaultSettings, Settings } from "./api/types";
import { useSettings, useUpdateSettings } from "./hooks/useSettings";
import { CalendarPage } from "./pages/CalendarPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { CourseFormPage } from "./pages/CourseFormPage";
import { buildShareUrl, extractShareCode, readShareCodeFromHash } from "./planner/shareLinks";
import { usePlannerStore } from "./planner/store";

type SharePanelMode = "closed" | "open" | "share" | "result";

type ShareResult = {
  title: string;
  description: string;
  code: string;
  shareUrl: string;
};

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const {
    hasCurrentPlanner,
    hasPersistedDraft,
    hasUnsavedChanges,
    currentShareId,
    startNewPlanner,
    resumePersistedDraft,
    createShare,
    extendShare,
    openShare
  } = usePlannerStore();
  const mergedSettings = settings ?? defaultSettings;
  const [sharePanelMode, setSharePanelMode] = useState<SharePanelMode>("closed");
  const [shareCodeInput, setShareCodeInput] = useState("");
  const [shareResult, setShareResult] = useState<ShareResult | null>(null);
  const [shareError, setShareError] = useState("");
  const [shareNotice, setShareNotice] = useState("");
  const [isQrVisible, setIsQrVisible] = useState(false);
  const [isShareBusy, setIsShareBusy] = useState(false);
  const handledHashRef = useRef<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", mergedSettings.dark_mode);
  }, [mergedSettings.dark_mode]);

  useEffect(() => {
    if (!location.hash) {
      handledHashRef.current = null;
      return;
    }

    if (handledHashRef.current === location.hash) {
      return;
    }

    handledHashRef.current = location.hash;

    let normalizedCode: string | null = null;

    try {
      normalizedCode = readShareCodeFromHash(location.hash);
    } catch (error) {
      setSharePanelMode("open");
      setShareError(error instanceof Error ? error.message : "Link konnte nicht geöffnet werden.");
      return;
    }

    if (!normalizedCode) {
      return;
    }

    if (!confirmPlannerReplacement()) {
      setShareCodeInput(normalizedCode);
      setSharePanelMode("open");
      return;
    }

    setShareCodeInput(normalizedCode);
    setShareError("");
    setShareNotice("");
    setIsShareBusy(true);

    void openShare(normalizedCode)
      .then(() => {
        resetShareUi();
        navigate("/", { replace: true });
      })
      .catch((error) => {
        setSharePanelMode("open");
        setShareError(error instanceof Error ? error.message : "Link konnte nicht geöffnet werden.");
      })
      .finally(() => {
        setIsShareBusy(false);
      });
  }, [location.hash]);

  function saveSettings(next: Partial<Settings>) {
    updateSettings.mutate(next);
  }

  function toggleTheme() {
    saveSettings({ dark_mode: !mergedSettings.dark_mode });
  }

  function resetShareUi() {
    setSharePanelMode("closed");
    setShareCodeInput("");
    setShareResult(null);
    setShareError("");
    setShareNotice("");
    setIsQrVisible(false);
  }

  function toggleSharePanel(mode: Extract<SharePanelMode, "open" | "share">) {
    setShareResult(null);
    setShareError("");
    setShareNotice("");
    setSharePanelMode((current) => (current === mode ? "closed" : mode));
  }

  function showShareResult(nextResult: Omit<ShareResult, "shareUrl">) {
    setSharePanelMode("result");
    setShareResult({
      ...nextResult,
      shareUrl: buildShareUrl(nextResult.code)
    });
    setShareNotice("");
    setIsQrVisible(false);
  }

  function confirmPlannerReplacement(): boolean {
    if (!hasCurrentPlanner || !hasUnsavedChanges) {
      return true;
    }

    return window.confirm("Lokale Änderungen gehen verloren. Fortfahren?");
  }

  function handleNewPlanner() {
    if (!confirmPlannerReplacement()) {
      return;
    }

    startNewPlanner();
    resetShareUi();
    navigate("/");
  }

  function handleResumeDraft() {
    resumePersistedDraft();
    resetShareUi();
    navigate("/");
  }

  async function handleOpenCode(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (!confirmPlannerReplacement()) {
      return;
    }

    setShareError("");
    setIsShareBusy(true);

    try {
      await openShare(extractShareCode(shareCodeInput));
      resetShareUi();
      navigate("/");
    } catch (error) {
      setShareError(error instanceof Error ? error.message : "Code konnte nicht geöffnet werden.");
    } finally {
      setIsShareBusy(false);
    }
  }

  async function handleCreateCode() {
    setShareError("");
    setShareNotice("");
    setIsShareBusy(true);

    try {
      const result = await createShare();
      showShareResult({
        title: "Link erstellt",
        description: "Der aktuelle Stand ist jetzt als verschlüsselter Link gespeichert. Bewahre den Acht-Wort-Code gut auf.",
        code: result.code
      });
    } catch (error) {
      setShareError(error instanceof Error ? error.message : "Code konnte nicht erstellt werden.");
      setSharePanelMode("share");
    } finally {
      setIsShareBusy(false);
    }
  }

  async function handleExtendCode() {
    setShareError("");
    setShareNotice("");
    setIsShareBusy(true);

    try {
      const result = await extendShare();
      showShareResult({
        title: "Link aktualisiert",
        description: "Der neue Link zeigt auf den aktuellen Stand. Ältere Links bleiben beim vorherigen Snapshot gültig.",
        code: result.code
      });
    } catch (error) {
      setShareError(error instanceof Error ? error.message : "Code konnte nicht erweitert werden.");
      setSharePanelMode("share");
    } finally {
      setIsShareBusy(false);
    }
  }

  async function copyText(value: string, successMessage: string) {
    if (!navigator.clipboard?.writeText) {
      setShareNotice("Bitte den angezeigten Text manuell kopieren.");
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setShareNotice(successMessage);
    } catch {
      setShareNotice("Bitte den angezeigten Text manuell kopieren.");
    }
  }

  async function copyShareCode() {
    if (!shareResult) {
      return;
    }

    await copyText(shareResult.code, "Code kopiert.");
  }

  async function copyShareLink() {
    if (!shareResult) {
      return;
    }

    await copyText(shareResult.shareUrl, "Link kopiert.");
  }

  async function shareCurrentLink() {
    if (!shareResult) {
      return;
    }

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "Stundenplan teilen",
          text: "Hier ist ein geteilter Stundenplan.",
          url: shareResult.shareUrl
        });
        setShareNotice("Link geteilt.");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    await copyShareLink();
  }

  function renderOpenCodePanel(withCloseButton: boolean) {
    return (
      <section className="page-card share-panel">
        <div className="share-panel-head">
          <div>
            <h2>Geteilten Plan öffnen</h2>
            <p className="page-intro">Füge einen Freigabe-Link oder den Acht-Wort-Code ein, um den Plan lokal zu laden.</p>
          </div>
          {withCloseButton ? (
            <button type="button" onClick={resetShareUi} disabled={isShareBusy}>
              Schließen
            </button>
          ) : null}
        </div>
        <form className="share-form" onSubmit={(event) => void handleOpenCode(event)}>
          <label className="full-width share-field">
            Link oder Acht-Wort-Code
            <textarea
              className="share-code-field"
              rows={3}
              placeholder="https://...#code=... oder marble orchard canvas ..."
              value={shareCodeInput}
              onChange={(event) => setShareCodeInput(event.target.value)}
              disabled={isShareBusy}
            />
          </label>
          {shareError ? <p className="error-text full-width">{shareError}</p> : null}
          <div className="button-row full-width">
            <button type="submit" className="primary-btn" disabled={isShareBusy}>
              {isShareBusy ? "Öffne..." : "Plan öffnen"}
            </button>
            {hasCurrentPlanner ? (
              <button type="button" onClick={() => toggleSharePanel("share")} disabled={isShareBusy}>
                Stattdessen teilen
              </button>
            ) : null}
          </div>
        </form>
        <p className="share-help-text">
          Wenn du einen geteilten Plan bearbeitest, bleibt der ursprüngliche Link unverändert. Erst wenn du selbst
          wieder teilst, entsteht ein neuer Link für deine Version.
        </p>
      </section>
    );
  }

  function renderShareComposerPanel() {
    const hasExistingShare = Boolean(currentShareId);

    return (
      <section className="page-card share-panel">
        <div className="share-panel-head">
          <div>
            <h2>Plan teilen</h2>
            <p className="page-intro">Erstelle einen direkten Link für den aktuellen Stand. Beim Aktualisieren bleibt der alte Link beim alten Snapshot gültig.</p>
          </div>
          <button type="button" onClick={resetShareUi} disabled={isShareBusy}>
            Schließen
          </button>
        </div>
        <div className="entry-notes share-panel-notes">
          <article className="entry-note">
            <strong>Was geteilt wird</strong>
            <p>Kategorien, Kurse, Termine und aktive Kurse werden im Snapshot verschlüsselt gespeichert.</p>
          </article>
          <article className="entry-note">
            <strong>Was lokal bleibt</strong>
            <p>Dark Mode, Filter und Namensanzeige bleiben nur auf diesem Gerät.</p>
          </article>
        </div>
        {shareError ? <p className="error-text">{shareError}</p> : null}
        <div className="button-row share-panel-actions">
          <button
            type="button"
            className="primary-btn"
            onClick={() => void (hasExistingShare ? handleExtendCode() : handleCreateCode())}
            disabled={isShareBusy}
          >
            {isShareBusy ? "Erstelle..." : hasExistingShare ? "Link aktualisieren" : "Link erstellen"}
          </button>
          <button type="button" onClick={() => toggleSharePanel("open")} disabled={isShareBusy}>
            Geteilten Plan öffnen
          </button>
        </div>
      </section>
    );
  }

  function renderShareResultPanel() {
    if (!shareResult) {
      return null;
    }

    return (
      <section className="page-card share-panel">
        <div className="share-panel-head">
          <div>
            <h2>{shareResult.title}</h2>
            <p className="page-intro">{shareResult.description}</p>
          </div>
          <button type="button" onClick={resetShareUi} disabled={isShareBusy}>
            Schließen
          </button>
        </div>
        <div className="share-copy-grid">
          <label className="share-field">
            Direkter Link
            <textarea className="share-code-field share-link-field" rows={2} value={shareResult.shareUrl} readOnly />
          </label>
          <label className="share-field">
            Acht-Wort-Code
            <textarea className="share-code-field" rows={3} value={shareResult.code} readOnly />
          </label>
        </div>
        <div className="button-row share-code-actions">
          <button type="button" className="primary-btn" onClick={() => void shareCurrentLink()}>
            Link teilen
          </button>
          <button type="button" onClick={() => void copyShareLink()}>
            Link kopieren
          </button>
          <button type="button" onClick={() => void copyShareCode()}>
            Code kopieren
          </button>
          <button type="button" onClick={() => setIsQrVisible((current) => !current)}>
            {isQrVisible ? "QR-Code ausblenden" : "QR-Code anzeigen"}
          </button>
          <button type="button" onClick={() => toggleSharePanel("share")}>
            Neuer Link
          </button>
        </div>
        {isQrVisible ? (
          <div className="share-qr-block">
            <div className="share-qr-card" aria-label="QR-Code für den geteilten Link">
              <QRCodeSVG value={shareResult.shareUrl} size={192} includeMargin />
            </div>
            <p className="share-qr-hint">Scanne den QR-Code, um den Link direkt mit dem eingebetteten Acht-Wort-Code zu öffnen.</p>
          </div>
        ) : null}
        {shareNotice ? <p className="share-notice">{shareNotice}</p> : null}
      </section>
    );
  }

  if (!hasCurrentPlanner) {
    return (
      <div className="app-shell">
        <section className="page-card entry-hero">
          <span className="entry-kicker">Lokal planen, sicher teilen</span>
          <h1>Plane dein Semester ohne Konten und ohne Server-Klartext</h1>
          <p className="page-intro">
            Erstelle einen neuen Plan, öffne einen geteilten Link oder setze deinen letzten Entwurf fort. Deine Inhalte bleiben im Browser und werden nur für das Teilen verschlüsselt gespeichert.
          </p>
          <div className="entry-actions">
            <button type="button" className="primary-btn" onClick={handleNewPlanner}>
              Neue Planung
            </button>
            <button
              type="button"
              onClick={() => toggleSharePanel("open")}
            >
              Geteilten Plan öffnen
            </button>
            {hasPersistedDraft ? (
              <button type="button" onClick={handleResumeDraft}>
                Letzten Entwurf fortsetzen
              </button>
            ) : null}
          </div>

          <div className="entry-utility-row">
            <p>Darstellung und Filter bleiben immer auf diesem Gerät.</p>
            <button type="button" className="utility-btn" onClick={toggleTheme}>
              {mergedSettings.dark_mode ? "Hell" : "Dunkel"}
            </button>
          </div>

          {sharePanelMode === "open" ? renderOpenCodePanel(false) : null}

          <div className="entry-notes">
            <article className="entry-note">
              <strong>Im Browser behalten</strong>
              <p>Du bearbeitest Kategorien, Kurse und Termine komplett lokal, auch bevor du etwas teilst.</p>
            </article>
            <article className="entry-note">
              <strong>Beim Teilen</strong>
              <p>Es wird ein verschlüsselter Snapshot erzeugt, den nur der Link oder der Acht-Wort-Code wieder öffnen kann.</p>
            </article>
            <article className="entry-note">
              <strong>Nur auf diesem Gerät</strong>
              <p>Dark Mode, Filter und die Anzeige voller Kursnamen bleiben privat und werden nicht mitgeschickt.</p>
            </article>
          </div>
        </section>
      </div>
    );
  }

  const plannerStatus = hasUnsavedChanges ? "Lokaler Entwurf" : currentShareId ? "Link gespeichert" : "Neue Planung";

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-group">
          <h1>Stundenplan</h1>
          <p>Lokal planen. Sicher teilen.</p>
        </div>
        <nav>
          <NavLink to="/">Kalender</NavLink>
          <NavLink to="/courses/new">Neuer Kurs</NavLink>
          <NavLink to="/categories">Kategorien</NavLink>
        </nav>
        <div className="topbar-controls">
          <div className="planner-status-chip">{plannerStatus}</div>
          <div className="topbar-utilities">
            <button type="button" className="utility-btn" onClick={() => toggleSharePanel("open")} disabled={isShareBusy}>
              Plan öffnen
            </button>
            <button type="button" className="utility-btn" onClick={toggleTheme}>
              {mergedSettings.dark_mode ? "Hell" : "Dunkel"}
            </button>
          </div>
          <div className="topbar-actions">
            <button type="button" onClick={handleNewPlanner} disabled={isShareBusy}>
              Neue Planung
            </button>
            <button type="button" className="primary-btn" onClick={() => toggleSharePanel("share")} disabled={isShareBusy}>
              Teilen
            </button>
          </div>
        </div>
      </header>
      {sharePanelMode === "open" ? renderOpenCodePanel(true) : null}
      {sharePanelMode === "share" ? renderShareComposerPanel() : null}
      {sharePanelMode === "result" ? renderShareResultPanel() : null}
      <main className="app-main">
        <Routes>
          <Route path="/" element={<CalendarPage showFullName={mergedSettings.show_full_name} />} />
          <Route path="/courses/new" element={<CourseFormPage mode="create" />} />
          <Route path="/courses/:id/edit" element={<CourseFormPage mode="edit" />} />
          <Route path="/categories" element={<CategoriesPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
