/**
 * NavBar.jsx — Top navigation bar (v4: multi-project)
 *
 * Three breadcrumb levels:
 *   home    →  Portfolio
 *   history →  Portfolio › [Project Name]
 *   detail  →  Portfolio › [Project Name] › Draw #N
 *
 * Right-side nav links (Current Draw / Draw History) only appear
 * when inside a project workspace.
 *
 * Props:
 *   page          — "home" | "history" | "detail"
 *   projectName   — active project name (empty string when on home)
 *   onNav         — fn(target, id?) — central navigation handler
 *   currentDrawId — id of the latest draw in the active project
 *   drawNumber    — draw number shown in the detail breadcrumb
 *   isCurrentDraw — true when the detail page shows the latest draw
 */

export default function NavBar({ page, projectName, onNav, currentDrawId, drawNumber, isCurrentDraw, onLogout }) {
  const insideProject = page === "history" || page === "detail";

  function goToCurrent() {
    if (currentDrawId) onNav("detail", currentDrawId);
    else onNav("history");
  }

  return (
    <nav className="navbar">
      <div className="nav-inner">
      {/* Left: logo always returns to the portfolio home */}
      <button className="nav-logo" onClick={() => onNav("home")}>
        <span className="nav-logo-icon">⬡</span>
        <span className="nav-logo-text">Captrak</span>
      </button>

      {/* Centre: contextual breadcrumb trail */}
      <div className="nav-breadcrumb">
        {page === "home" && (
          <span className="breadcrumb-active">Portfolio</span>
        )}

        {page === "history" && (
          <>
            <button className="breadcrumb-link" onClick={() => onNav("home")}>
              Portfolio
            </button>
            <span className="breadcrumb-sep">›</span>
            <span className="breadcrumb-active">{projectName}</span>
          </>
        )}

        {page === "detail" && (
          <>
            <button className="breadcrumb-link" onClick={() => onNav("home")}>
              Portfolio
            </button>
            <span className="breadcrumb-sep">›</span>
            <button className="breadcrumb-link" onClick={() => onNav("history")}>
              {projectName}
            </button>
            <span className="breadcrumb-sep">›</span>
            <span className="breadcrumb-active">Draw #{drawNumber}</span>
          </>
        )}
      </div>

      {/* Right: project nav links + logout */}
      <div className="nav-links">
        {insideProject ? (
          <>
            <button
              className={`nav-link ${page === "detail" && isCurrentDraw ? "nav-link-active" : ""}`}
              onClick={goToCurrent}
            >
              Current Draw
            </button>
            <button
              className={`nav-link ${page === "history" ? "nav-link-active" : ""}`}
              onClick={() => onNav("history")}
            >
              Draw History
            </button>
          </>
        ) : (
          <button className="nav-link nav-link-active">
            Portfolio
          </button>
        )}
        <button className="nav-link nav-logout" onClick={onLogout}>
          Sign Out
        </button>
      </div>
      </div>
    </nav>
  );
}
