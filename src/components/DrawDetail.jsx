/**
 * DrawDetail.jsx — Draw Detail page (v3: adds Documents section)
 *
 * Shows the full line-item breakdown + supporting documents for one draw.
 *
 * Props:
 *   project         — { name, lender } project-level info for PDF header
 *   draw            — the draw object to display
 *   documents       — array of document records for this draw
 *   onUpdateDraw    — fn(drawId, fields)
 *   onUpdateItem    — fn(drawId, itemId, field, value)
 *   onAddItem       — fn(drawId)
 *   onDeleteItem    — fn(drawId, itemId)
 *   onAddDocument   — fn(docFields) → bool
 *   onDeleteDocument— fn(docId)
 *   storageError    — string | null
 */

import { useState } from "react";
import { formatCurrency, formatPct, parseMoney, computeTotals } from "../utils/format";
import { generateDrawPackage } from "../utils/generateDrawPackage";
import StatusBadge      from "./StatusBadge";
import DocumentsSection from "./DocumentsSection";

// ── Editable money cell ────────────────────────────────────────────────────────
function MoneyCell({ value, onSave, readOnly = false }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft  ] = useState("");

  if (readOnly) return <td className="cell-number">{formatCurrency(value)}</td>;

  if (editing) {
    return (
      <td className="cell-number cell-editing">
        <input
          className="cell-input"
          type="number"
          value={draft}
          autoFocus
          onChange={e => setDraft(e.target.value)}
          onBlur={() => { onSave(parseMoney(draft)); setEditing(false); }}
          onKeyDown={e => {
            if (e.key === "Enter")  { onSave(parseMoney(draft)); setEditing(false); }
            if (e.key === "Escape") setEditing(false);
          }}
        />
      </td>
    );
  }

  return (
    <td className="cell-number cell-editable" title="Click to edit"
      onClick={() => { setDraft(String(value || "")); setEditing(true); }}>
      {formatCurrency(value)}
    </td>
  );
}

// ── Editable name cell ─────────────────────────────────────────────────────────
function NameCell({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft  ] = useState(value);

  if (editing) {
    return (
      <td className="cell-name cell-editing">
        <input
          className="cell-input cell-input-name"
          type="text"
          value={draft}
          autoFocus
          onChange={e => setDraft(e.target.value)}
          onBlur={() => { onSave(draft); setEditing(false); }}
          onKeyDown={e => {
            if (e.key === "Enter")  { onSave(draft); setEditing(false); }
            if (e.key === "Escape") setEditing(false);
          }}
        />
      </td>
    );
  }

  return (
    <td className="cell-name cell-editable" title="Click to edit"
      onClick={() => { setDraft(value); setEditing(true); }}>
      {value}
    </td>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function DrawDetail({
  project,
  draw,
  documents,
  onUpdateDraw,
  onUpdateItem,
  onAddItem,
  onDeleteItem,
  onAddDocument,
  onDeleteDocument,
  storageError,
}) {
  const [generating, setGenerating] = useState(false);

  async function handleGeneratePackage() {
    setGenerating(true);
    try {
      await generateDrawPackage({ project, draw, documents });
    } finally {
      setGenerating(false);
    }
  }

  const totals = computeTotals(draw.lineItems);

  const rows = draw.lineItems.map(item => {
    const totalDrawn = (item.priorDraws || 0) + (item.currentDraw || 0);
    const remaining  = (item.originalBudget || 0) - totalDrawn;
    const overBudget = totalDrawn > (item.originalBudget || 0);
    return { ...item, totalDrawn, remaining, overBudget };
  });

  // Total amount of documentation uploaded vs. draw request — shows coverage
  const totalDocAmount  = documents.reduce((s, d) => s + (d.amount || 0), 0);
  const docCoverageOk   = totalDocAmount >= totals.currentDraw && totals.currentDraw > 0;

  // Funding progress: total drawn to date as a percentage of the committed budget
  const pctDrawn = totals.originalBudget > 0
    ? Math.min((totals.totalDrawn / totals.originalBudget) * 100, 100)
    : 0;

  // Backup coverage: uploaded doc amounts vs. the current draw request
  const coveragePct = totals.currentDraw > 0
    ? (totalDocAmount / totals.currentDraw) * 100
    : 0;
  const coverageState = totals.currentDraw === 0 ? "none"
    : coveragePct >= 100 ? "green"
    : coveragePct >= 75  ? "yellow"
    : "red";

  // ── Health checks ───────────────────────────────────────────────────────────
  const overBudgetItems = rows.filter(r => r.overBudget);

  const checks = [
    {
      id:    "coverage",
      label: "Backup documentation coverage",
      detail: totals.currentDraw === 0
        ? "No draw request entered"
        : `${formatCurrency(totalDocAmount)} of ${formatCurrency(totals.currentDraw)} covered`,
      state: coverageState === "green" ? "pass"
        : coverageState === "yellow"   ? "warn"
        : coverageState === "none"     ? "neutral"
        : "fail",
      badge: coverageState === "green"  ? "COVERED"
        : coverageState === "yellow"    ? "PARTIAL"
        : coverageState === "none"      ? "N/A"
        : "INSUFFICIENT",
    },
    {
      id:    "overbudget",
      label: "Line items within original budget",
      detail: overBudgetItems.length === 0
        ? "All line items are within their original budget"
        : overBudgetItems.map(i => i.name).join(", "),
      state: overBudgetItems.length > 0 ? "fail" : "pass",
      badge: overBudgetItems.length > 0
        ? `${overBudgetItems.length} OVER BUDGET`
        : "OK",
    },
    {
      id:    "funds",
      label: "Draw within available project funds",
      detail: totals.remaining < 0
        ? `Exceeds budget by ${formatCurrency(Math.abs(totals.remaining))}`
        : `${formatCurrency(totals.remaining)} remaining after this draw`,
      state: totals.remaining < 0 ? "fail" : "pass",
      badge: totals.remaining < 0 ? "EXCEEDS FUNDS" : "OK",
    },
  ];

  const failCount = checks.filter(c => c.state === "fail").length;
  const warnCount = checks.filter(c => c.state === "warn").length;
  const healthSummaryState = failCount > 0 ? "fail" : warnCount > 0 ? "warn" : "pass";
  const healthSummaryText  = failCount > 0
    ? `${failCount} issue${failCount !== 1 ? "s" : ""} found`
    : warnCount > 0
      ? `${warnCount} warning${warnCount !== 1 ? "s" : ""}`
      : "All checks passed";

  const CHECK_ICONS = { pass: "✓", warn: "⚠", fail: "✕", neutral: "—" };

  return (
    <div className="draw-workspace">
      {/* ── Draw-level meta bar ── */}
      <div className="draw-meta-bar">
        <div className="draw-meta-fields">
          <div className="header-field">
            <span className="header-label">DRAW NUMBER</span>
            <span className="header-value no-hover">#{draw.drawNumber}</span>
          </div>
          <div className="header-field">
            <span className="header-label">DRAW DATE</span>
            <input
              className="header-input meta-date-input"
              type="date"
              value={draw.date}
              onChange={e => onUpdateDraw(draw.id, { date: e.target.value })}
            />
          </div>
          <div className="header-field">
            <span className="header-label">STATUS</span>
            <div style={{ paddingTop: 4 }}>
              <StatusBadge
                status={draw.status}
                onChange={s => onUpdateDraw(draw.id, { status: s })}
              />
            </div>
          </div>
        </div>

        {/* Summary pills */}
        <div className="draw-summary-pills">
          <div className="summary-pill">
            <span className="pill-label">CURRENT REQUEST</span>
            <span className="pill-value accent">{formatCurrency(totals.currentDraw)}</span>
          </div>
          <div className="summary-pill">
            <span className="pill-label">TOTAL DRAWN</span>
            <span className="pill-value">{formatCurrency(totals.totalDrawn)}</span>
          </div>
          <div className="summary-pill">
            <span className="pill-label">REMAINING</span>
            <span className={`pill-value ${totals.remaining < 0 ? "danger" : ""}`}>
              {formatCurrency(totals.remaining)}
            </span>
          </div>
          <div className="summary-pill">
            <span className="pill-label">DOC COVERAGE</span>
            <span className={`pill-value ${docCoverageOk ? "success" : ""}`}>
              {formatCurrency(totalDocAmount)}
            </span>
          </div>
        </div>

        {/* Backup coverage bar — full width, forced to its own row */}
        <div className="draw-coverage-bar">
          <div className="draw-coverage-header">
            <div className="draw-coverage-meta">
              <span className="draw-coverage-title">BACKUP COVERAGE</span>
              <span className="draw-coverage-amounts">
                <span className="draw-coverage-dim">REQUEST</span>
                {formatCurrency(totals.currentDraw)}
                <span className="draw-coverage-sep">·</span>
                <span className="draw-coverage-dim">BACKUP</span>
                {formatCurrency(totalDocAmount)}
              </span>
            </div>
            <span className={`draw-coverage-pct draw-coverage-pct--${coverageState}`}>
              {totals.currentDraw > 0 ? `${Math.round(coveragePct)}%` : "—"}
            </span>
          </div>
          <div className="draw-coverage-track">
            <div
              className={`draw-coverage-fill draw-coverage-fill--${coverageState}`}
              style={{ width: `${Math.min(coveragePct, 100)}%` }}
            />
          </div>
        </div>

        {/* Funding progress bar — full width, forced to its own row */}
        <div className="draw-funding-progress">
          <div className="draw-funding-header">
            <span className="draw-funding-title">FUNDING PROGRESS</span>
            <span className="draw-funding-pct">{pctDrawn.toFixed(1)}% drawn</span>
          </div>
          <div className="draw-funding-track">
            <div
              className={`draw-funding-fill${totals.remaining < 0 ? " draw-funding-fill--danger" : ""}`}
              style={{ width: `${pctDrawn}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Health check panel ── */}
      <div className={`health-check-panel health-check-panel--${healthSummaryState}`}>
        <div className="health-check-header">
          <span className="health-check-title">DRAW HEALTH CHECK</span>
          <span className={`health-check-summary health-check-summary--${healthSummaryState}`}>
            {CHECK_ICONS[healthSummaryState]}&nbsp;{healthSummaryText}
          </span>
        </div>
        <ul className="health-check-list">
          {checks.map(check => (
            <li key={check.id} className={`health-check-item health-check-item--${check.state}`}>
              <span className={`health-check-icon health-check-icon--${check.state}`}>
                {CHECK_ICONS[check.state]}
              </span>
              <div className="health-check-body">
                <span className="health-check-label">{check.label}</span>
                <span className="health-check-detail">{check.detail}</span>
              </div>
              <span className={`health-check-badge health-check-badge--${check.state}`}>
                {check.badge}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Budget table ── */}
      <section className="budget-section">
        <div className="section-header">
          <h2 className="section-title">LINE ITEM DETAIL</h2>
          <button className="btn-add" onClick={() => onAddItem(draw.id)}>
            + Add Line Item
          </button>
        </div>

        <div className="table-wrapper">
          <table className="budget-table">
            <thead>
              <tr>
                <th className="th-name">Budget Line Item</th>
                <th className="th-number">Original Budget</th>
                <th className="th-number">Prior Draws</th>
                <th className="th-number">Current Draw Request</th>
                <th className="th-number">Total Drawn</th>
                <th className="th-number">Remaining Budget</th>
                <th className="th-number">% Drawn</th>
                <th className="th-action">Del</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className={row.overBudget ? "row-over-budget" : ""}>
                  <NameCell  value={row.name}           onSave={v => onUpdateItem(draw.id, row.id, "name", v)} />
                  <MoneyCell value={row.originalBudget} onSave={v => onUpdateItem(draw.id, row.id, "originalBudget", v)} />
                  <MoneyCell value={row.priorDraws}     onSave={v => onUpdateItem(draw.id, row.id, "priorDraws", v)} />
                  <MoneyCell value={row.currentDraw}    onSave={v => onUpdateItem(draw.id, row.id, "currentDraw", v)} />
                  <MoneyCell value={row.totalDrawn} readOnly />
                  <MoneyCell value={row.remaining}  readOnly />
                  <td className={`cell-number cell-pct ${row.overBudget ? "pct-danger" : ""}`}>
                    {formatPct(row.totalDrawn, row.originalBudget)}
                  </td>
                  <td className="cell-action">
                    <button className="btn-delete" title="Delete row"
                      onClick={() => onDeleteItem(draw.id, row.id)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="totals-row">
                <td className="cell-name totals-label">DRAW TOTAL</td>
                <td className="cell-number">{formatCurrency(totals.originalBudget)}</td>
                <td className="cell-number">{formatCurrency(totals.priorDraws)}</td>
                <td className="cell-number">{formatCurrency(totals.currentDraw)}</td>
                <td className="cell-number">{formatCurrency(totals.totalDrawn)}</td>
                <td className={`cell-number ${totals.remaining < 0 ? "pct-danger" : ""}`}>
                  {formatCurrency(totals.remaining)}
                </td>
                <td className="cell-number cell-pct">
                  {formatPct(totals.totalDrawn, totals.originalBudget)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="table-legend">
          <span className="legend-dot legend-over" /> Row highlighted = exceeds original budget &nbsp;·&nbsp; Click any editable cell to modify
        </div>
      </section>

      {/* ── Documents section ── */}
      <DocumentsSection
        drawId={draw.id}
        documents={documents}
        onAdd={onAddDocument}
        onDelete={onDeleteDocument}
        storageError={storageError}
      />

      {/* ── Actions bar ── */}
      <div className="draw-actions-bar">
        <div className="draw-actions-meta">
          <span>{draw.lineItems.length} line item{draw.lineItems.length !== 1 ? "s" : ""}</span>
          <span className="draw-actions-sep">·</span>
          <span>{documents.length} document{documents.length !== 1 ? "s" : ""} attached</span>
        </div>
        <button
          className="btn-package"
          onClick={handleGeneratePackage}
          disabled={generating}
        >
          {generating ? "Generating..." : "Generate Draw Package"}
        </button>
      </div>
    </div>
  );
}
