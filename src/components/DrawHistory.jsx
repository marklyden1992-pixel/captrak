/**
 * DrawHistory.jsx — Draw History page
 *
 * Displays a table of every draw for the project.
 * Each row is clickable to navigate to the Draw Detail page.
 * A "New Draw" button creates the next draw (pre-filled from the last one).
 *
 * Props:
 *   draws      — array of draw objects from useStore
 *   onSelect   — fn(drawId) navigate to Draw Detail
 *   onAddDraw  — fn() create a new draw
 *   onDeleteDraw — fn(drawId) delete a draw
 */

import { computeTotals, formatCurrency, formatDate, formatPct } from "../utils/format";
import StatusBadge from "./StatusBadge";

export default function DrawHistory({ draws, onSelect, onAddDraw, onDeleteDraw }) {
  return (
    <section className="budget-section">
      {/* ── Section header ── */}
      <div className="section-header">
        <h2 className="section-title">DRAW HISTORY</h2>
        <button className="btn-add" onClick={onAddDraw}>
          + New Draw
        </button>
      </div>

      {draws.length === 0 ? (
        <div className="empty-state">No draws yet. Click "+ New Draw" to get started.</div>
      ) : (
        <div className="table-wrapper">
          <table className="budget-table">
            <thead>
              <tr>
                <th className="th-name" style={{ width: 80 }}>Draw #</th>
                <th className="th-name">Draw Date</th>
                <th className="th-number">Current Request</th>
                <th className="th-number">Total Drawn to Date</th>
                <th className="th-number">Remaining Budget</th>
                <th className="th-number">% Complete</th>
                <th className="th-name" style={{ textAlign: "center" }}>Status</th>
                <th className="th-action">Del</th>
              </tr>
            </thead>

            <tbody>
              {draws.map(draw => {
                const t = computeTotals(draw.lineItems);
                return (
                  <tr
                    key={draw.id}
                    className="history-row"
                    onClick={() => onSelect(draw.id)}
                    title={`Open Draw #${draw.drawNumber}`}
                  >
                    {/* Draw number */}
                    <td className="cell-name">
                      <span className="draw-number">#{draw.drawNumber}</span>
                    </td>

                    {/* Date */}
                    <td className="cell-name">{formatDate(draw.date)}</td>

                    {/* Current draw request amount */}
                    <td className="cell-number">{formatCurrency(t.currentDraw)}</td>

                    {/* Cumulative total drawn (prior + current) */}
                    <td className="cell-number">{formatCurrency(t.totalDrawn)}</td>

                    {/* Remaining */}
                    <td className={`cell-number ${t.remaining < 0 ? "pct-danger" : ""}`}>
                      {formatCurrency(t.remaining)}
                    </td>

                    {/* Percent of budget drawn */}
                    <td className="cell-number cell-pct">
                      {formatPct(t.totalDrawn, t.originalBudget)}
                    </td>

                    {/* Status badge — stop row click propagation so the badge click works */}
                    <td className="cell-action" onClick={e => e.stopPropagation()}>
                      <StatusBadge status={draw.status} />
                    </td>

                    {/* Delete */}
                    <td className="cell-action" onClick={e => e.stopPropagation()}>
                      <button
                        className="btn-delete"
                        title="Delete draw"
                        onClick={() => {
                          if (window.confirm(`Delete Draw #${draw.drawNumber}? This cannot be undone.`)) {
                            onDeleteDraw(draw.id);
                          }
                        }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="table-legend">
        <span>Click any row to open the draw detail.</span>
      </div>
    </section>
  );
}
