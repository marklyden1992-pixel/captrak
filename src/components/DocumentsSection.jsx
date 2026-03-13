/**
 * DocumentsSection.jsx — PDF document upload and management
 *
 * Rendered inside DrawDetail. Lets the user:
 *   1. Upload one or more PDF files with metadata (name, amount, category, notes)
 *   2. View uploaded documents in a table
 *   3. Click "View PDF" to open the stored PDF in a new browser tab
 *   4. Delete a document
 *
 * How PDF storage works:
 *   - The browser's FileReader API reads the selected file and converts it
 *     to a base64 data URL string (e.g. "data:application/pdf;base64,AAAA...")
 *   - That string is passed to addDocument() which stores it in localStorage
 *   - To view the PDF later, we set an <a> tag's href to the stored data URL
 *
 * Props:
 *   drawId        — string id of the draw this section belongs to
 *   documents     — array of document records for this draw (from useStore)
 *   onAdd         — fn(docFields) — saves a new document; returns bool success
 *   onDelete      — fn(docId)     — removes a document record
 *   storageError  — string | null — shown if localStorage quota exceeded
 */

import { useState, useRef } from "react";
import { formatCurrency } from "../utils/format";

// ── Document categories the user can pick from ────────────────────────────────
const CATEGORIES = [
  "Invoice",
  "Lien Waiver",
  "Inspection Report",
  "Contractor Agreement",
  "Change Order",
  "Permit",
  "Photo Documentation",
  "Other",
];

// ── Blank form state — reused when resetting after upload ────────────────────
const BLANK_FORM = {
  name:     "",
  amount:   "",
  category: CATEGORIES[0],
  notes:    "",
};

// ── Helper: format bytes into a human-readable size string ───────────────────
function formatFileSize(bytes) {
  if (bytes < 1024)        return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

// ── Helper: format an ISO timestamp into a short date string ─────────────────
function formatUploadDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD FORM — shown when user clicks "+ Upload Document"
// ─────────────────────────────────────────────────────────────────────────────
function UploadForm({ drawId, onAdd, onCancel, storageError }) {
  const [form,        setForm       ] = useState(BLANK_FORM);
  const [selectedFile, setSelectedFile] = useState(null); // the File object
  const [uploading,   setUploading  ] = useState(false);
  const [fileError,   setFileError  ] = useState(null);
  const fileInputRef = useRef(null);

  // Called when user picks a file via the file input
  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Only accept PDFs
    if (file.type !== "application/pdf") {
      setFileError("Only PDF files are supported.");
      setSelectedFile(null);
      return;
    }

    setFileError(null);
    setSelectedFile(file);

    // Auto-fill the document name from the file name (user can edit it)
    if (!form.name) {
      // Strip the .pdf extension for a cleaner default name
      const baseName = file.name.replace(/\.pdf$/i, "").replace(/[-_]/g, " ");
      setForm(prev => ({ ...prev, name: baseName }));
    }
  }

  // Called when user clicks "Save Document"
  async function handleSubmit() {
    // Validation
    if (!selectedFile) { setFileError("Please select a PDF file."); return; }
    if (!form.name.trim()) { setFileError("Please enter a document name."); return; }

    setUploading(true);
    setFileError(null);

    try {
      // ── Convert the PDF File object to a base64 data URL using FileReader ──
      // FileReader is a browser built-in API — no npm packages needed.
      // readAsDataURL() reads the binary file and encodes it as:
      //   "data:application/pdf;base64,<base64-encoded-bytes>"
      // This string can be stored as plain text in localStorage and later
      // used directly as an <a href> or <embed src> to display the PDF.
      const fileData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = e  => resolve(e.target.result); // result is the data URL
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(selectedFile); // ← triggers the async read
      });

      // Build the document record and pass it to the store
      const docFields = {
        drawId,
        name:     form.name.trim(),
        fileName: selectedFile.name,
        amount:   parseFloat(form.amount) || 0,
        category: form.category,
        notes:    form.notes.trim(),
        fileType: selectedFile.type,
        fileData, // the base64 data URL
      };

      const success = onAdd(docFields);

      if (success === false) {
        // Storage quota exceeded — file was too large
        setFileError(
          "This file is too large to store locally. Try a smaller PDF or " +
          "delete existing documents to free up space."
        );
      } else {
        // Success — reset the form
        setForm(BLANK_FORM);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        onCancel(); // close the form panel
      }
    } catch (err) {
      setFileError("Error reading file: " + err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="upload-form">
      <div className="upload-form-header">
        <span className="upload-form-title">UPLOAD DOCUMENT</span>
        <button className="btn-ghost" onClick={onCancel}>✕ Cancel</button>
      </div>

      {/* Global storage error from parent */}
      {storageError && (
        <div className="doc-alert doc-alert-error">{storageError}</div>
      )}

      {/* Inline file/form validation error */}
      {fileError && (
        <div className="doc-alert doc-alert-error">{fileError}</div>
      )}

      <div className="upload-form-grid">

        {/* ── File picker ── */}
        <div className="form-field form-field-full">
          <label className="form-label">PDF FILE *</label>
          <div
            className={`file-drop-zone ${selectedFile ? "file-drop-zone-active" : ""}`}
            onClick={() => fileInputRef.current?.click()}
          >
            {selectedFile ? (
              <div className="file-selected-info">
                <span className="file-icon">📄</span>
                <div>
                  <div className="file-selected-name">{selectedFile.name}</div>
                  <div className="file-selected-size">{formatFileSize(selectedFile.size)}</div>
                </div>
                <button
                  className="btn-ghost file-clear-btn"
                  onClick={e => {
                    e.stopPropagation();
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >✕</button>
              </div>
            ) : (
              <div className="file-drop-prompt">
                <span className="file-drop-icon">⬆</span>
                <span>Click to select a PDF file</span>
                <span className="file-drop-hint">Maximum recommended size: 4 MB</span>
              </div>
            )}
          </div>
          {/* Hidden real file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
        </div>

        {/* ── Document name ── */}
        <div className="form-field">
          <label className="form-label">DOCUMENT NAME *</label>
          <input
            className="form-input"
            type="text"
            placeholder="e.g. Framing Invoice #3"
            value={form.name}
            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
          />
        </div>

        {/* ── Amount ── */}
        <div className="form-field">
          <label className="form-label">AMOUNT ($)</label>
          <input
            className="form-input"
            type="number"
            placeholder="0"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))}
          />
        </div>

        {/* ── Category ── */}
        <div className="form-field">
          <label className="form-label">CATEGORY</label>
          <select
            className="form-input form-select"
            value={form.category}
            onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}
          >
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* ── Notes ── */}
        <div className="form-field form-field-full">
          <label className="form-label">NOTES</label>
          <textarea
            className="form-input form-textarea"
            placeholder="Optional notes about this document..."
            rows={2}
            value={form.notes}
            onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
          />
        </div>

      </div>

      {/* Actions */}
      <div className="upload-form-actions">
        <button className="btn-ghost" onClick={onCancel} disabled={uploading}>
          Cancel
        </button>
        <button className="btn-primary" onClick={handleSubmit} disabled={uploading}>
          {uploading ? "Processing..." : "Save Document"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENTS TABLE — list of uploaded documents
// ─────────────────────────────────────────────────────────────────────────────
function DocumentsTable({ documents, onDelete }) {
  // Compute total dollar amount across all documents for this draw
  const totalAmount = documents.reduce((sum, doc) => sum + (doc.amount || 0), 0);

  // Open a stored PDF in a new browser tab using its data URL
  function viewPdf(doc) {
    // Create a temporary invisible <a> tag and programmatically click it.
    // This works because the href is a data URL that the browser can render.
    const link = document.createElement("a");
    link.href   = doc.fileData;
    link.target = "_blank";
    link.rel    = "noopener noreferrer";
    // Use the original filename as the tab title hint
    link.download = ""; // don't force download — open in tab
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="table-wrapper">
      <table className="budget-table doc-table">
        <thead>
          <tr>
            <th className="th-name">Document Name</th>
            <th className="th-name" style={{ minWidth: 120 }}>Category</th>
            <th className="th-number">Amount</th>
            <th className="th-name" style={{ minWidth: 80 }}>Uploaded</th>
            <th className="th-name">Notes</th>
            <th className="th-name" style={{ width: 90, textAlign: "center" }}>PDF</th>
            <th className="th-action">Del</th>
          </tr>
        </thead>

        <tbody>
          {documents.map(doc => (
            <tr key={doc.id}>
              {/* Document name + file name subtitle */}
              <td className="cell-name">
                <div className="doc-name">{doc.name}</div>
                <div className="doc-filename">{doc.fileName}</div>
              </td>

              {/* Category badge */}
              <td className="cell-name">
                <span className="doc-category-badge">{doc.category}</span>
              </td>

              {/* Amount */}
              <td className="cell-number">
                {doc.amount ? formatCurrency(doc.amount) : <span className="dim">—</span>}
              </td>

              {/* Upload date */}
              <td className="cell-name dim-text">
                {formatUploadDate(doc.uploadedAt)}
              </td>

              {/* Notes — truncate long notes */}
              <td className="cell-name doc-notes-cell">
                {doc.notes || <span className="dim">—</span>}
              </td>

              {/* View PDF button */}
              <td style={{ textAlign: "center" }}>
                <button
                  className="btn-view-pdf"
                  title={`Open ${doc.fileName}`}
                  onClick={() => viewPdf(doc)}
                >
                  ⬡ View PDF
                </button>
              </td>

              {/* Delete button */}
              <td className="cell-action">
                <button
                  className="btn-delete"
                  title="Delete document"
                  onClick={() => {
                    if (window.confirm(`Delete "${doc.name}"? This cannot be undone.`)) {
                      onDelete(doc.id);
                    }
                  }}
                >✕</button>
              </td>
            </tr>
          ))}
        </tbody>

        {/* Summary row — total backup amount */}
        <tfoot>
          <tr className="totals-row">
            <td className="cell-name totals-label" colSpan={2}>
              TOTAL BACKUP DOCUMENTATION
            </td>
            <td className="cell-number">{formatCurrency(totalAmount)}</td>
            <td colSpan={4} className="cell-name dim-text" style={{ fontSize: 11 }}>
              {documents.length} document{documents.length !== 1 ? "s" : ""} uploaded
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT — DocumentsSection
// ─────────────────────────────────────────────────────────────────────────────
export default function DocumentsSection({ drawId, documents, onAdd, onDelete, storageError }) {
  // Controls whether the upload form is open
  const [showForm, setShowForm] = useState(false);

  return (
    <section className="budget-section docs-section">

      {/* ── Section header ── */}
      <div className="section-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2 className="section-title">SUPPORTING DOCUMENTS</h2>
          <span className="doc-count-badge">{documents.length}</span>
        </div>
        {!showForm && (
          <button className="btn-add" onClick={() => setShowForm(true)}>
            + Upload Document
          </button>
        )}
      </div>

      {/* ── Upload form (shown/hidden) ── */}
      {showForm && (
        <UploadForm
          drawId={drawId}
          onAdd={onAdd}
          onCancel={() => setShowForm(false)}
          storageError={storageError}
        />
      )}

      {/* ── Documents table or empty state ── */}
      {documents.length === 0 && !showForm ? (
        <div className="empty-state" style={{ padding: "32px 24px" }}>
          No documents uploaded yet for this draw.
          <br />
          <span style={{ opacity: 0.6, fontSize: 12 }}>
            Upload invoices, lien waivers, inspection reports, and other backup documentation.
          </span>
        </div>
      ) : (
        documents.length > 0 && (
          <DocumentsTable documents={documents} onDelete={onDelete} />
        )
      )}

    </section>
  );
}
