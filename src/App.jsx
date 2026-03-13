/**
 * App.jsx — Root component and page router (v4: multi-project)
 *
 * Pages: "home" | "history" | "detail"
 *
 * activeProjectId tracks which project is open (null = home / portfolio).
 *
 * A "bound" object closes over activeProjectId so every store action
 * that needs it is pre-filled — keeping DrawHistory, DrawDetail, and
 * ProjectHeader props interfaces identical to v3.
 */

import { useState } from "react";
import { useStore }      from "./hooks/useStore";
import NavBar            from "./components/NavBar";
import ProjectHeader     from "./components/ProjectHeader";
import ProjectList       from "./components/ProjectList";
import DrawHistory       from "./components/DrawHistory";
import DrawDetail        from "./components/DrawDetail";
import LoginScreen       from "./components/LoginScreen";
import "./App.css";

export default function App() {
  const {
    projects,
    addProject,
    deleteProject,
    updateProject,
    addDraw,
    updateDraw,
    deleteDraw,
    addLineItem,
    updateLineItem,
    deleteLineItem,
    addDocument,
    deleteDocument,
    getDocumentsForDraw,
    storageError,
  } = useStore();

  const [isAuthed, setIsAuthed] = useState(
    () => localStorage.getItem("clt_authed") === "true"
  );

  const [page,            setPage           ] = useState("home");
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [selectedDrawId,  setSelectedDrawId ] = useState(null);

  function handleLogin() {
    localStorage.setItem("clt_authed", "true");
    setIsAuthed(true);
  }

  function handleLogout() {
    localStorage.removeItem("clt_authed");
    setIsAuthed(false);
  }

  function navigate(target, id = null) {
    if (target === "home") {
      setPage("home");
      setActiveProjectId(null);
      setSelectedDrawId(null);
    } else if (target === "project") {
      // Open a project — land on its Draw History page
      setActiveProjectId(id);
      setPage("history");
      setSelectedDrawId(null);
    } else {
      // "history" or "detail" — stay in current project context
      setPage(target);
      if (target === "detail") setSelectedDrawId(id);
    }
    window.scrollTo(0, 0);
  }

  // Derive active project data
  const activeProject = activeProjectId
    ? projects.find(p => p.id === activeProjectId)
    : null;
  const draws        = activeProject?.draws ?? [];
  const currentDraw  = draws[draws.length - 1];
  const selectedDraw = draws.find(d => d.id === selectedDrawId);

  // Bind activeProjectId into all project-scoped store actions.
  // This lets child components call e.g. onAddDraw() without knowing the projectId.
  const bound = activeProjectId ? {
    updateProject:  fields                      => updateProject(activeProjectId, fields),
    addDraw:        ()                          => addDraw(activeProjectId),
    updateDraw:     (drawId, fields)            => updateDraw(activeProjectId, drawId, fields),
    deleteDraw:     drawId                      => deleteDraw(activeProjectId, drawId),
    addLineItem:    drawId                      => addLineItem(activeProjectId, drawId),
    updateLineItem: (drawId, itemId, field, val) => updateLineItem(activeProjectId, drawId, itemId, field, val),
    deleteLineItem: (drawId, itemId)            => deleteLineItem(activeProjectId, drawId, itemId),
  } : {};

  if (!isAuthed) return <LoginScreen onLogin={handleLogin} />;

  return (
    <div className="app-shell">
      <div className="top-bar" />

      <NavBar
        page={page}
        projectName={activeProject?.name ?? ""}
        onNav={navigate}
        currentDrawId={currentDraw?.id}
        drawNumber={selectedDraw?.drawNumber}
        isCurrentDraw={selectedDrawId === currentDraw?.id}
        onLogout={handleLogout}
      />

      <main className="app-main">
        <div className="page-eyebrow">CAPTRAK · CONSTRUCTION LOAN DRAW TRACKER</div>

        {/* ── Home: Portfolio dashboard ── */}
        {page === "home" && (
          <ProjectList
            projects={projects}
            onSelect={id => navigate("project", id)}
            onAdd={addProject}
            onDelete={deleteProject}
          />
        )}

        {/* ── Project workspace ── */}
        {page !== "home" && activeProject && (
          <>
            <ProjectHeader
              project={activeProject}
              onChange={bound.updateProject}
            />

            {page === "history" && (
              <DrawHistory
                draws={draws}
                onSelect={id => navigate("detail", id)}
                onAddDraw={bound.addDraw}
                onDeleteDraw={bound.deleteDraw}
              />
            )}

            {page === "detail" && selectedDraw && (
              <DrawDetail
                project={activeProject}
                draw={selectedDraw}
                documents={getDocumentsForDraw(selectedDraw.id)}
                onUpdateDraw={bound.updateDraw}
                onUpdateItem={bound.updateLineItem}
                onAddItem={bound.addLineItem}
                onDeleteItem={bound.deleteLineItem}
                onAddDocument={addDocument}
                onDeleteDocument={deleteDocument}
                storageError={storageError}
              />
            )}
          </>
        )}

        <footer className="app-footer">
          <span>Captrak v4.0</span>
          <span>Data saved locally in your browser · All figures in USD</span>
        </footer>
      </main>
    </div>
  );
}
