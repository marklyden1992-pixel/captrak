/**
 * generateDrawPackage.js — Browser-side PDF generation using jsPDF + pdf-lib.
 *
 * Two-phase pipeline:
 *
 *   Phase 1 — jsPDF builds the summary pages:
 *     Page 1   Draw Summary       (project info, status, budget totals, coverage)
 *     Page 2   Line Item Detail   (full budget table)
 *     Page 3+  Supporting Docs    (metadata index; doc names are clickable links)
 *
 *   Phase 2 — pdf-lib appends the actual uploaded PDFs:
 *     For each document (in order):
 *       - A separator cover page (exhibit number, name, metadata)
 *       - All pages from the uploaded PDF, copied verbatim
 *     If a file cannot be parsed (corrupted, password-protected, etc.),
 *     a clearly labelled fallback page is inserted instead.
 *
 * pdf-lib is loaded via dynamic import() so it only enters the bundle
 * when the user clicks "Generate Draw Package".
 *
 * Usage:
 *   import { generateDrawPackage } from "../utils/generateDrawPackage";
 *   await generateDrawPackage({ project, draw, documents });
 */

import { jsPDF } from "jspdf";
import { formatCurrency, formatPct, formatDate, computeTotals } from "./format";

// ── Page geometry (US Letter in points) ──────────────────────────────────────
const PW = 612;
const PH = 792;
const ML = 48;
const MR = 48;
const CW = PW - ML - MR; // 516 pt
const TOP  = 52;
const FOOT = PH - 44;

// ── Colour palette — jsPDF phase (RGB arrays) ─────────────────────────────────
const C = {
  accent:    [30,  80, 180],
  accentDim: [20,  60, 160],
  dark:      [20,  25,  40],
  dim:       [100, 110, 130],
  border:    [200, 210, 225],
  rowAlt:    [246, 248, 252],
  totals:    [228, 235, 250],
  infoBg:    [240, 244, 252],
  white:     [255, 255, 255],
  danger:    [180,  50,  50],
  success:   [ 30, 130,  80],
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export async function generateDrawPackage({ project, draw, documents }) {

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 1 — Generate summary pages with jsPDF
  // ══════════════════════════════════════════════════════════════════════════

  const pdf      = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const totals   = computeTotals(draw.lineItems);
  const docTotal = documents.reduce((s, d) => s + (d.amount || 0), 0);
  let   pageNum  = 1;

  // ── jsPDF primitives ──────────────────────────────────────────────────────

  function font(size, weight = "normal", color = C.dark) {
    pdf.setFontSize(size);
    pdf.setFont("helvetica", weight);
    pdf.setTextColor(...color);
  }

  function txt(str, x, y, opts = {}) {
    pdf.text(String(str ?? ""), x, y, opts);
  }

  function fillRect(x, y, w, h, color) {
    pdf.setFillColor(...color);
    pdf.rect(x, y, w, h, "F");
  }

  function hLine(y, x1 = ML, x2 = PW - MR, color = C.border, lw = 0.5) {
    pdf.setDrawColor(...color);
    pdf.setLineWidth(lw);
    pdf.line(x1, y, x2, y);
  }

  // ── Page chrome ───────────────────────────────────────────────────────────

  function drawPageChrome() {
    fillRect(0, 0, PW, 5, C.accent);
    font(7.5, "normal", C.dim);
    txt(project.name, ML, 21);
    txt(`Draw #${draw.drawNumber}  |  Confidential`, PW - MR, 21, { align: "right" });
    hLine(28, ML, PW - MR, C.border, 0.4);
    hLine(FOOT, ML, PW - MR, C.border, 0.4);
    font(7.5, "normal", C.dim);
    txt(`${project.name}  |  Draw #${draw.drawNumber}  |  ${formatDate(draw.date)}`, ML, FOOT + 14);
    txt(`Page ${pageNum}`, PW - MR, FOOT + 14, { align: "right" });
  }

  function newPage() {
    pdf.addPage();
    pageNum++;
    drawPageChrome();
    return TOP;
  }

  // ── Table helpers ─────────────────────────────────────────────────────────

  const TH = 18;
  const TR = 19;

  function tableHeader(cols, y) {
    fillRect(ML, y, CW, TH, C.accent);
    let x = ML;
    cols.forEach(col => {
      font(7, "bold", C.white);
      const tx = col.align === "right" ? x + col.w - 6 : x + 7;
      txt(col.label.toUpperCase(), tx, y + TH - 5, { align: col.align === "right" ? "right" : "left" });
      x += col.w;
    });
    return y + TH;
  }

  function tableRow(cols, vals, y, { rowH = TR, alt = false, isTotal = false, cellColors = null } = {}) {
    const bg = isTotal ? C.totals : alt ? C.rowAlt : C.white;
    fillRect(ML, y, CW, rowH, bg);
    let x = ML;
    cols.forEach((col, i) => {
      const color = cellColors?.[i] ?? (isTotal ? C.accentDim : C.dark);
      font(9, isTotal ? "bold" : "normal", color);
      const tx = col.align === "right" ? x + col.w - 6 : x + 7;
      txt(String(vals[i] ?? ""), tx, y + rowH - 5, { align: col.align === "right" ? "right" : "left" });
      x += col.w;
    });
    hLine(y + rowH, ML, PW - MR, C.border, 0.25);
    return y + rowH;
  }

  function guardPageBreak(y, needed, cols) {
    if (y + needed > FOOT - 10) {
      y = newPage();
      y = tableHeader(cols, y);
    }
    return y;
  }

  // ── Page 1: Draw Summary ──────────────────────────────────────────────────

  drawPageChrome();
  let y = TOP;

  font(22, "bold", C.dark);
  txt("DRAW PACKAGE", ML, y + 22);
  font(11, "normal", C.dim);
  txt(`Draw #${draw.drawNumber}  |  ${formatDate(draw.date)}  |  ${draw.status}`, ML, y + 37);
  hLine(y + 44, ML, PW - MR, C.accent, 1.5);
  y += 54;

  fillRect(ML, y,     CW, 3,  C.accent);
  fillRect(ML, y + 3, CW, 76, C.infoBg);
  const half = CW / 2;
  [
    ["Project Name", project.name],
    ["Lender",       project.lender],
    ["Draw Date",    formatDate(draw.date)],
    ["Status",       draw.status],
  ].forEach(([lbl, val], i) => {
    const fx = ML + (i % 2) * half + 14;
    const fy = y + 3 + Math.floor(i / 2) * 38 + 14;
    font(7.5, "normal", C.dim);
    txt(lbl.toUpperCase(), fx, fy);
    font(10, "bold", C.dark);
    txt(val, fx, fy + 14);
  });
  y += 90;

  font(8.5, "bold", C.accentDim);
  txt("BUDGET SUMMARY", ML, y + 12);
  hLine(y + 16, ML, PW - MR, C.accent, 0.8);
  y += 22;

  const sumCols = [
    { label: "Description", w: 320, align: "left"  },
    { label: "Amount",      w: 196, align: "right" },
  ];
  y = tableHeader(sumCols, y);

  const summaryRows = [
    { label: "Original Budget",      val: formatCurrency(totals.originalBudget) },
    { label: "Prior Draws",          val: formatCurrency(totals.priorDraws) },
    { label: "Current Draw Request", val: formatCurrency(totals.currentDraw), accent: true },
    { label: "Total Drawn to Date",  val: formatCurrency(totals.totalDrawn) },
    { label: "Remaining Budget",     val: formatCurrency(totals.remaining), danger: totals.remaining < 0 },
    { label: "% Complete",           val: formatPct(totals.totalDrawn, totals.originalBudget) },
  ];

  summaryRows.forEach((row, i) => {
    const valColor = row.danger ? C.danger : row.accent ? C.accent : C.dark;
    fillRect(ML, y, CW, TR, i % 2 === 0 ? C.white : C.rowAlt);
    font(9, "normal", C.dark);
    txt(row.label, ML + 7, y + TR - 5);
    font(9, row.danger || row.accent ? "bold" : "normal", valColor);
    txt(row.val, PW - MR - 7, y + TR - 5, { align: "right" });
    hLine(y + TR, ML, PW - MR, C.border, 0.25);
    y += TR;
  });

  fillRect(ML, y, CW, 24, C.totals);
  font(9, "bold", C.accentDim);
  txt("TOTAL CURRENT DRAW REQUEST", ML + 7, y + 16);
  font(13, "bold", C.accent);
  txt(formatCurrency(totals.currentDraw), PW - MR - 7, y + 16, { align: "right" });
  hLine(y + 24, ML, PW - MR, C.accent, 0.8);
  y += 34;

  fillRect(ML, y,     CW, 3,  C.accent);
  fillRect(ML, y + 3, CW, 54, C.infoBg);
  font(7.5, "normal", C.dim);
  txt("DOCUMENTATION COVERAGE", ML + 14, y + 17);
  font(15, "bold", C.accent);
  txt(formatCurrency(docTotal), ML + 14, y + 38);
  const coverageOk = docTotal >= totals.currentDraw && totals.currentDraw > 0;
  font(8, "bold", coverageOk ? C.success : C.dim);
  txt(coverageOk ? "FULLY COVERED" : "PARTIAL COVERAGE", PW - MR - 14, y + 28, { align: "right" });
  font(8, "normal", C.dim);
  txt(
    `${documents.length} document${documents.length !== 1 ? "s" : ""} attached`,
    PW - MR - 14, y + 42, { align: "right" }
  );

  // ── Page 2: Line Item Detail ──────────────────────────────────────────────

  y = newPage();

  font(16, "bold", C.dark);
  txt("LINE ITEM DETAIL", ML, y + 18);
  font(9, "normal", C.dim);
  txt(`Draw #${draw.drawNumber}  |  ${formatDate(draw.date)}  |  ${draw.status}`, ML, y + 32);
  hLine(y + 38, ML, PW - MR, C.accent, 1);
  y += 48;

  // Columns: 150+72+72+84+72+66 = 516
  const itemCols = [
    { label: "Line Item",    w: 150, align: "left"  },
    { label: "Orig Budget",  w:  72, align: "right" },
    { label: "Prior Draws",  w:  72, align: "right" },
    { label: "Curr Request", w:  84, align: "right" },
    { label: "Total Drawn",  w:  72, align: "right" },
    { label: "Remaining",    w:  66, align: "right" },
  ];
  y = tableHeader(itemCols, y);

  draw.lineItems.forEach((item, i) => {
    y = guardPageBreak(y, TR, itemCols);
    const totalDrawn = (item.priorDraws || 0) + (item.currentDraw || 0);
    const remaining  = (item.originalBudget || 0) - totalDrawn;
    const over       = totalDrawn > (item.originalBudget || 0);
    y = tableRow(
      itemCols,
      [
        item.name,
        formatCurrency(item.originalBudget),
        formatCurrency(item.priorDraws),
        formatCurrency(item.currentDraw),
        formatCurrency(totalDrawn),
        over ? `(${formatCurrency(Math.abs(remaining))})` : formatCurrency(remaining),
      ],
      y,
      { alt: i % 2 !== 0, cellColors: over ? [C.dark, C.dark, C.dark, C.dark, C.danger, C.danger] : null }
    );
  });

  y = guardPageBreak(y, 22, itemCols);
  tableRow(
    itemCols,
    [
      "DRAW TOTAL",
      formatCurrency(totals.originalBudget),
      formatCurrency(totals.priorDraws),
      formatCurrency(totals.currentDraw),
      formatCurrency(totals.totalDrawn),
      formatCurrency(totals.remaining),
    ],
    y,
    { isTotal: true, rowH: 22 }
  );

  // ── Page 3+: Supporting Documents index ───────────────────────────────────

  y = newPage();

  font(16, "bold", C.dark);
  txt("SUPPORTING DOCUMENTS", ML, y + 18);
  font(9, "normal", C.dim);
  txt(
    `${documents.length} document${documents.length !== 1 ? "s" : ""} attached to Draw #${draw.drawNumber}`,
    ML, y + 32
  );
  hLine(y + 38, ML, PW - MR, C.accent, 1);
  y += 48;

  if (documents.length === 0) {
    font(9, "normal", C.dim);
    txt("No supporting documents have been uploaded for this draw.", ML, y + 16);
  } else {
    // Columns: 162+90+80+86+98 = 516
    const docCols = [
      { label: "Document Name", w: 162, align: "left"  },
      { label: "Category",      w:  90, align: "left"  },
      { label: "Amount",        w:  80, align: "right" },
      { label: "Uploaded",      w:  86, align: "left"  },
      { label: "Notes",         w:  98, align: "left"  },
    ];
    y = tableHeader(docCols, y);

    const DOC_ROW_H = 28;

    documents.forEach((doc, i) => {
      y = guardPageBreak(y, DOC_ROW_H, docCols);
      fillRect(ML, y, CW, DOC_ROW_H, i % 2 === 0 ? C.white : C.rowAlt);

      const xCat  = ML + 162;
      const xAmt  = xCat + 90;
      const xDate = xAmt + 80;
      const xNote = xDate + 86;

      // Document name — clickable link if fileData present
      if (doc.fileData) {
        try {
          const blobUrl = dataUrlToBlobUrl(doc.fileData);
          font(9, "bold", C.accent);
          pdf.textWithLink(doc.name, ML + 7, y + 11, { url: blobUrl });
        } catch {
          font(9, "bold", C.dark);
          txt(doc.name, ML + 7, y + 11);
        }
      } else {
        font(9, "bold", C.dark);
        txt(doc.name, ML + 7, y + 11);
      }

      font(7, "normal", C.dim);
      txt(doc.fileName || "", ML + 7, y + 21);

      font(8.5, "normal", C.dark);
      txt(doc.category || "—", xCat + 7, y + 16);

      font(9, "bold", C.dark);
      txt(doc.amount ? formatCurrency(doc.amount) : "—", xAmt + 80 - 6, y + 16, { align: "right" });

      const uploadDate = doc.uploadedAt
        ? new Date(doc.uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "—";
      font(8.5, "normal", C.dim);
      txt(uploadDate, xDate + 7, y + 16);

      const notes = doc.notes || "—";
      font(8.5, "normal", C.dark);
      txt(notes.length > 24 ? notes.slice(0, 22) + "..." : notes, xNote + 7, y + 16);

      // Exhibit number badge in the name cell (right side)
      font(7.5, "bold", C.accentDim);
      txt(`Exhibit ${i + 1}`, ML + 162 - 7, y + 21, { align: "right" });

      hLine(y + DOC_ROW_H, ML, PW - MR, C.border, 0.25);
      y += DOC_ROW_H;
    });

    y = guardPageBreak(y, 22, docCols);
    fillRect(ML, y, CW, 22, C.totals);
    font(8.5, "bold", C.accentDim);
    txt("TOTAL BACKUP DOCUMENTATION", ML + 7, y + 15);
    font(10, "bold", C.accentDim);
    txt(formatCurrency(docTotal), ML + 162 + 90 + 80 - 6, y + 15, { align: "right" });
    hLine(y + 22, ML, PW - MR, C.accent, 0.8);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 2 — Merge uploaded PDFs with pdf-lib
  // ══════════════════════════════════════════════════════════════════════════

  const summaryBytes = pdf.output("arraybuffer");
  await mergeUploadedDocuments(summaryBytes, documents, project, draw);
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loads the jsPDF output into pdf-lib, appends all uploaded documents
 * (each preceded by a separator cover page), then triggers a download.
 *
 * pdf-lib is dynamically imported so it only enters the bundle on demand.
 */
async function mergeUploadedDocuments(summaryBytes, documents, project, draw) {
  // Dynamic import — only fetched when this function runs
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

  const merged   = await PDFDocument.load(summaryBytes);
  const helv     = await merged.embedFont(StandardFonts.Helvetica);
  const helvBold = await merged.embedFont(StandardFonts.HelveticaBold);

  // Colour values for pdf-lib (0–1 scale, bottom-left origin)
  const ACCENT = rgb(0.12, 0.31, 0.71);
  const DARK   = rgb(0.08, 0.10, 0.16);
  const DIM    = rgb(0.39, 0.43, 0.51);
  const BORDER = rgb(0.78, 0.82, 0.88);
  const DANGER = rgb(0.70, 0.20, 0.20);
  const RED_BG = rgb(1.00, 0.93, 0.93);
  const INFO   = rgb(0.94, 0.96, 0.99);

  // pdf-lib uses bottom-left origin; H - y_from_top = y_from_bottom
  const W = 612;
  const H = 792;

  /**
   * Draws a separator/cover page before each document's pages.
   * isFallback = true shows a warning instead of implying the doc follows.
   */
  function addSeparatorPage(doc, exhibitNum, isFallback) {
    const page = merged.addPage([W, H]);

    // Top accent stripe
    page.drawRectangle({ x: 0, y: H - 5, width: W, height: 5, color: ACCENT });

    // Header band
    page.drawLine({
      start: { x: 48, y: H - 28 }, end: { x: W - 48, y: H - 28 },
      thickness: 0.4, color: BORDER,
    });
    page.drawText(project.name, { x: 48, y: H - 22, size: 7.5, font: helv, color: DIM });
    page.drawText(
      `Draw #${draw.drawNumber}  |  Confidential`,
      { x: W - 48, y: H - 22, size: 7.5, font: helv, color: DIM,
        maxWidth: 160 }, // right-align approximation
    );

    // Exhibit label
    page.drawText(`EXHIBIT ${exhibitNum}`, {
      x: 48, y: H - 70, size: 9, font: helv, color: DIM,
    });

    // Document name (large heading)
    page.drawText(doc.name, {
      x: 48, y: H - 96, size: 20, font: helvBold, color: DARK,
      maxWidth: W - 96,
    });

    // Blue rule under name
    page.drawRectangle({ x: 48, y: H - 108, width: W - 96, height: 1.5, color: ACCENT });

    // Filename (dim, small)
    if (doc.fileName) {
      page.drawText(doc.fileName, {
        x: 48, y: H - 124, size: 8.5, font: helv, color: DIM, maxWidth: W - 96,
      });
    }

    // Fallback warning block
    let metaStartY = H - 168;
    if (isFallback) {
      page.drawRectangle({ x: 48, y: H - 198, width: W - 96, height: 44, color: RED_BG });
      page.drawText("DOCUMENT COULD NOT BE EMBEDDED", {
        x: 60, y: H - 174, size: 9.5, font: helvBold, color: DANGER,
      });
      page.drawText(
        "The file may be corrupted, password-protected, or in an unsupported PDF format.",
        { x: 60, y: H - 188, size: 8, font: helv, color: DANGER, maxWidth: W - 120 },
      );
      page.drawText("View the original document in the Draw Tracker app.", {
        x: 48, y: H - 212, size: 8.5, font: helv, color: DIM,
      });
      metaStartY = H - 256;
    }

    // Metadata grid — 2 columns × 2 rows
    const uploadDate = doc.uploadedAt
      ? new Date(doc.uploadedAt).toLocaleDateString("en-US", {
          month: "long", day: "numeric", year: "numeric",
        })
      : "—";

    const meta = [
      ["CATEGORY", doc.category || "—"],
      ["AMOUNT",   doc.amount ? formatCurrency(doc.amount) : "—"],
      ["UPLOADED", uploadDate],
      ["NOTES",    doc.notes  || "—"],
    ];

    const colW = (W - 96) / 2;
    meta.forEach(([label, value], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const fx  = 48 + col * colW;
      const fy  = metaStartY - row * 52;

      // Light background card per field
      page.drawRectangle({
        x: fx, y: fy - 34, width: colW - 12, height: 42, color: INFO,
      });
      page.drawText(label, { x: fx + 10, y: fy - 8,  size: 8,  font: helv,     color: DIM  });
      page.drawText(String(value), {
        x: fx + 10, y: fy - 22, size: 11, font: helvBold, color: DARK,
        maxWidth: colW - 24,
      });
    });

    // Footer
    page.drawLine({
      start: { x: 48, y: 44 }, end: { x: W - 48, y: 44 },
      thickness: 0.4, color: BORDER,
    });
    page.drawText(
      `${project.name}  |  Draw #${draw.drawNumber}  |  ${formatDate(draw.date)}`,
      { x: 48, y: 30, size: 7.5, font: helv, color: DIM },
    );
  }

  // Append each document in order
  for (let i = 0; i < documents.length; i++) {
    const doc        = documents[i];
    const exhibitNum = i + 1;

    if (!doc.fileData) {
      // Document was uploaded without file data — show fallback only
      addSeparatorPage(doc, exhibitNum, true);
      continue;
    }

    try {
      const srcBytes = base64ToBytes(doc.fileData);
      const srcPdf   = await PDFDocument.load(srcBytes);
      const indices  = srcPdf.getPageIndices();

      if (indices.length === 0) throw new Error("PDF has no pages");

      // Separator cover page
      addSeparatorPage(doc, exhibitNum, false);

      // Copy all pages from the source PDF
      const copied = await merged.copyPages(srcPdf, indices);
      copied.forEach(page => merged.addPage(page));

    } catch {
      // File failed to parse — separator with embedded error explanation
      addSeparatorPage(doc, exhibitNum, true);
    }
  }

  // Serialise and trigger download
  const finalBytes = await merged.save();
  triggerDownload(finalBytes, project, draw);
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Decode a base64 data URL into a Uint8Array suitable for pdf-lib.
 */
function base64ToBytes(dataUrl) {
  const b64    = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(b64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Convert a base64 data URL to a Blob URL.
 * Used for clickable link annotations in the jsPDF summary pages.
 */
function dataUrlToBlobUrl(dataUrl) {
  const bytes = base64ToBytes(dataUrl);
  const comma = dataUrl.indexOf(",");
  const mime  = dataUrl.slice(0, comma).match(/:(.*?);/)[1];
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

/**
 * Create a Blob from the final merged PDF bytes and trigger a browser download.
 */
function triggerDownload(bytes, project, draw) {
  const slug = project.name.replace(/\s+/g, "-").toLowerCase();
  const name = `draw-package-${slug}-draw-${draw.drawNumber}.pdf`;
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
