/**
 * StatusBadge.jsx — Colored pill showing draw status.
 *
 * Props:
 *   status  — "Draft" | "Submitted" | "Approved" | "Funded"
 *   onChange — optional fn(newStatus) if the badge should be clickable / editable
 */

const STATUSES = ["Draft", "Submitted", "Approved", "Funded"];

export default function StatusBadge({ status, onChange }) {
  if (!onChange) {
    // Read-only display
    return <span className={`status-badge status-${status?.toLowerCase()}`}>{status}</span>;
  }

  // Clicking cycles through statuses
  function cycle() {
    const idx  = STATUSES.indexOf(status);
    const next = STATUSES[(idx + 1) % STATUSES.length];
    onChange(next);
  }

  return (
    <button
      className={`status-badge status-badge-btn status-${status?.toLowerCase()}`}
      title="Click to change status"
      onClick={cycle}
    >
      {status}
      <span className="status-cycle-hint"> ↻</span>
    </button>
  );
}
