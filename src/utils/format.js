/**
 * format.js — Shared number / date formatting helpers
 * Imported by any component that displays money, percentages, or dates.
 */

/** Format a number as USD with no decimals — e.g. $1,234,567 */
export function formatCurrency(n) {
  return new Intl.NumberFormat("en-US", {
    style:                 "currency",
    currency:              "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n || 0);
}

/** Format a ratio as a percentage — e.g. 72.4% */
export function formatPct(drawn, budget) {
  if (!budget || budget === 0) return "—";
  return ((drawn / budget) * 100).toFixed(1) + "%";
}

/** Parse a user-typed string into a number, stripping $, commas, etc. */
export function parseMoney(str) {
  const cleaned = String(str).replace(/[^0-9.-]/g, "");
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

/** Format an ISO date string to a readable date — e.g. "March 11, 2026" */
export function formatDate(isoDate) {
  if (!isoDate) return "—";
  return new Date(isoDate + "T00:00:00").toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
}

/**
 * Given a draw's lineItems, compute project-level totals.
 * Returns { originalBudget, priorDraws, currentDraw, totalDrawn, remaining }
 */
export function computeTotals(lineItems = []) {
  return lineItems.reduce(
    (acc, item) => {
      const totalDrawn = (item.priorDraws || 0) + (item.currentDraw || 0);
      return {
        originalBudget: acc.originalBudget + (item.originalBudget || 0),
        priorDraws:     acc.priorDraws     + (item.priorDraws     || 0),
        currentDraw:    acc.currentDraw    + (item.currentDraw    || 0),
        totalDrawn:     acc.totalDrawn     + totalDrawn,
        remaining:      acc.remaining      + (item.originalBudget || 0) - totalDrawn,
      };
    },
    { originalBudget: 0, priorDraws: 0, currentDraw: 0, totalDrawn: 0, remaining: 0 }
  );
}
