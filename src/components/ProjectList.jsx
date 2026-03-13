/**
 * ProjectList.jsx — Portfolio dashboard (Home page)
 *
 * Displays all projects in a summary table. Each row shows totals derived
 * from the project's latest draw (which carries cumulative priorDraws amounts,
 * so it represents the full drawn-to-date picture).
 *
 * Props:
 *   projects  — array of project objects from useStore
 *   onSelect  — fn(projectId)       — open a project's draw workspace
 *   onAdd     — fn(name, lender)    — create a new project
 *   onDelete  — fn(projectId)       — delete a project and all its data
 */

import { useState } from "react";
import { formatCurrency, computeTotals } from "../utils/format";

// Derive committed / drawn / available totals for one project.
// Uses the latest draw because its lineItems carry cumulative priorDraws.
function getProjectTotals(project) {
  const lastDraw = project.draws[project.draws.length - 1];
  if (!lastDraw) return { committed: 0, drawn: 0, available: 0 };
  const t = computeTotals(lastDraw.lineItems);
  return { committed: t.originalBudget, drawn: t.totalDrawn, available: t.remaining };
}

const BLANK_FORM = { name: "", lender: "" };

export default function ProjectList({ projects, onSelect, onAdd, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm    ] = useState(BLANK_FORM);
  const [error,    setError   ] = useState("");

  // Portfolio-level rollup across all projects
  const portfolioTotals = projects.reduce(
    (acc, p) => {
      const t = getProjectTotals(p);
      return {
        committed: acc.committed + t.committed,
        drawn:     acc.drawn     + t.drawn,
        available: acc.available + t.available,
      };
    },
    { committed: 0, drawn: 0, available: 0 }
  );

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Project name is required."); return; }
    onAdd(form.name, form.lender);
    setForm(BLANK_FORM);
    setError("");
    setShowForm(false);
  }

  function handleDelete(e, projectId, projectName) {
    e.stopPropagation(); // don't trigger row click
    if (window.confirm(`Delete "${projectName}" and all its draws?\n\nThis cannot be undone.`)) {
      onDelete(projectId);
    }
  }

  return (
    <div className="portfolio-page">

      {/* ── Summary stat cards ── */}
      <div className="portfolio-stats">
        <div className="portfolio-stat">
          <span className="portfolio-stat-label">PROJECTS</span>
          <span className="portfolio-stat-value">{projects.length}</span>
        </div>
        <div className="portfolio-stat">
          <span className="portfolio-stat-label">COMMITTED FUNDS</span>
          <span className="portfolio-stat-value">{formatCurrency(portfolioTotals.committed)}</span>
        </div>
        <div className="portfolio-stat">
          <span className="portfolio-stat-label">TOTAL DRAWN</span>
          <span className="portfolio-stat-value accent">{formatCurrency(portfolioTotals.drawn)}</span>
        </div>
        <div className="portfolio-stat">
          <span className="portfolio-stat-label">AVAILABLE</span>
          <span className="portfolio-stat-value">{formatCurrency(portfolioTotals.available)}</span>
        </div>
      </div>

      {/* ── Projects table ── */}
      <div className="budget-section">
        <div className="section-header">
          <h2 className="section-title">PROJECTS</h2>
          {!showForm && (
            <button className="btn-add" onClick={() => setShowForm(true)}>
              + New Project
            </button>
          )}
        </div>

        {/* New project inline form */}
        {showForm && (
          <form className="new-project-form" onSubmit={handleSubmit}>
            <div className="new-project-form-title">NEW PROJECT</div>
            {error && <div className="doc-alert doc-alert-error">{error}</div>}
            <div className="new-project-fields">
              <div className="form-field">
                <label className="form-label">PROJECT NAME *</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g. Riverside Mixed-Use Development"
                  value={form.name}
                  autoFocus
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="form-field">
                <label className="form-label">LENDER</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g. First National Construction Bank"
                  value={form.lender}
                  onChange={e => setForm(prev => ({ ...prev, lender: e.target.value }))}
                />
              </div>
            </div>
            <div className="new-project-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => { setShowForm(false); setForm(BLANK_FORM); setError(""); }}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Create Project
              </button>
            </div>
          </form>
        )}

        {projects.length === 0 && !showForm ? (
          <div className="empty-state">
            No projects yet.
            <br />
            <span style={{ opacity: 0.6, fontSize: 12 }}>
              Click &quot;+ New Project&quot; to create your first construction draw tracker.
            </span>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="budget-table">
              <thead>
                <tr>
                  <th className="th-name">Project</th>
                  <th className="th-name">Lender</th>
                  <th className="th-number" style={{ minWidth: 60 }}>Draws</th>
                  <th className="th-number">Committed Funds</th>
                  <th className="th-number">Drawn</th>
                  <th className="th-number">Available</th>
                  <th className="th-action"></th>
                </tr>
              </thead>
              <tbody>
                {projects.map(project => {
                  const t   = getProjectTotals(project);
                  const pct = t.committed > 0
                    ? Math.min((t.drawn / t.committed) * 100, 100)
                    : 0;

                  return (
                    <tr
                      key={project.id}
                      className="history-row"
                      onClick={() => onSelect(project.id)}
                    >
                      {/* Name + progress bar + percent label */}
                      <td className="cell-name">
                        <div className="portfolio-project-name">{project.name}</div>
                        <div className="portfolio-progress">
                          <div className="portfolio-draw-bar">
                            <div
                              className="portfolio-draw-fill"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="portfolio-pct-label">{Math.round(pct)}%</span>
                        </div>
                      </td>

                      {/* Lender */}
                      <td className="cell-name" style={{ color: "var(--color-text-dim)", fontSize: 12 }}>
                        {project.lender || <span className="dim">—</span>}
                      </td>

                      {/* Draw count */}
                      <td className="cell-number">
                        <span className="draw-number">{project.draws.length}</span>
                      </td>

                      {/* Financials */}
                      <td className="cell-number">{formatCurrency(t.committed)}</td>
                      <td className="cell-number">{formatCurrency(t.drawn)}</td>
                      <td className={`cell-number ${t.available < 0 ? "cell-danger" : ""}`}>
                        {formatCurrency(t.available)}
                      </td>

                      {/* Delete */}
                      <td className="cell-action">
                        <button
                          className="btn-delete"
                          title="Delete project"
                          onClick={e => handleDelete(e, project.id, project.name)}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Portfolio totals row — only shown with 2+ projects */}
              {projects.length > 1 && (
                <tfoot>
                  <tr className="totals-row">
                    <td className="cell-name totals-label" colSpan={3}>PORTFOLIO TOTAL</td>
                    <td className="cell-number">{formatCurrency(portfolioTotals.committed)}</td>
                    <td className="cell-number">{formatCurrency(portfolioTotals.drawn)}</td>
                    <td className="cell-number">{formatCurrency(portfolioTotals.available)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
