/**
 * ProjectHeader.jsx — Editable project-level info.
 * Shows project name and lender (draw date moved to individual draws).
 */

import { useState } from "react";

export default function ProjectHeader({ project, onChange }) {
  const [editing, setEditing] = useState(null);

  function commitEdit(field, value) {
    onChange({ [field]: value });
    setEditing(null);
  }

  function handleKeyDown(e, field, value) {
    if (e.key === "Enter")  commitEdit(field, value);
    if (e.key === "Escape") setEditing(null);
  }

  function EditableField({ field, label }) {
    const [draft, setDraft] = useState(project[field]);
    if (editing !== field && draft !== project[field]) setDraft(project[field]);

    return (
      <div className="header-field">
        <span className="header-label">{label}</span>
        {editing === field ? (
          <input
            className="header-input"
            type="text"
            value={draft}
            autoFocus
            onChange={e => setDraft(e.target.value)}
            onBlur={() => commitEdit(field, draft)}
            onKeyDown={e => handleKeyDown(e, field, draft)}
          />
        ) : (
          <span
            className="header-value"
            title="Click to edit"
            onClick={() => setEditing(field)}
          >
            {project[field]}
            <span className="edit-hint">✎</span>
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="project-header">
      <div className="project-header-grid two-col">
        <EditableField field="name"   label="PROJECT NAME" />
        <EditableField field="lender" label="LENDER" />
      </div>
    </div>
  );
}
