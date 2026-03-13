/**
 * useStore.js — Central data layer (v4: multi-project)
 *
 * Storage keys:
 *   "clt_projects"  — { nextProjectId, projects: [project, ...] }
 *   "clt_documents" — { nextDocId, records: [...] }
 *
 * Migration: if the old v3 key "clt_project" exists and "clt_projects"
 * does not, it is automatically imported as proj_1.
 *
 * Project shape:
 *   {
 *     id,          — "proj_1", "proj_2", ...
 *     name,        — project display name
 *     lender,      — lender name
 *     draws,       — array of draw objects
 *     nextDrawId,  — id counter for new draws
 *     nextItemId,  — id counter for new line items
 *   }
 *
 * Document shape (unchanged from v3):
 *   { id, drawId, name, fileName, amount, category, notes, fileType, fileData, uploadedAt }
 */

import { useState, useCallback } from "react";

// ── Seed data ─────────────────────────────────────────────────────────────────

const SEED_LINE_ITEMS = [
  { id: 1, name: "Site Work",          originalBudget:  85000, priorDraws: 0, currentDraw: 0 },
  { id: 2, name: "Concrete",           originalBudget: 120000, priorDraws: 0, currentDraw: 0 },
  { id: 3, name: "Framing",            originalBudget: 210000, priorDraws: 0, currentDraw: 0 },
  { id: 4, name: "Roofing",            originalBudget:  65000, priorDraws: 0, currentDraw: 0 },
  { id: 5, name: "MEP",                originalBudget: 175000, priorDraws: 0, currentDraw: 0 },
  { id: 6, name: "Interiors",          originalBudget: 240000, priorDraws: 0, currentDraw: 0 },
  { id: 7, name: "General Conditions", originalBudget:  55000, priorDraws: 0, currentDraw: 0 },
  { id: 8, name: "Contingency",        originalBudget:  50000, priorDraws: 0, currentDraw: 0 },
];

function makeProject(id, name, lender) {
  return {
    id,
    name:       name.trim()   || "New Project",
    lender:     lender.trim() || "",
    draws: [
      {
        id:         "draw_1",
        drawNumber: 1,
        date:       new Date().toISOString().split("T")[0],
        status:     "Draft",
        lineItems:  SEED_LINE_ITEMS.map(i => ({ ...i })),
      },
    ],
    nextDrawId: 2,
    nextItemId: SEED_LINE_ITEMS.length + 1,
  };
}

function makeSeedProjectsState() {
  return {
    nextProjectId: 2,
    projects: [
      makeProject("proj_1", "Riverside Mixed-Use Development", "First National Construction Bank"),
    ],
  };
}

// ── localStorage helpers ──────────────────────────────────────────────────────

const LEGACY_KEY   = "clt_project";   // v3 single-project key (migration source)
const PROJECTS_KEY = "clt_projects";  // v4 multi-project key
const DOCUMENT_KEY = "clt_documents";

function loadProjects() {
  try {
    // v4 data present — use it directly
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (raw) return JSON.parse(raw);

    // Migrate from v3 single-project format
    const legacyRaw = localStorage.getItem(LEGACY_KEY);
    if (legacyRaw) {
      const old = JSON.parse(legacyRaw);
      const migrated = {
        nextProjectId: 2,
        projects: [{
          id:         "proj_1",
          name:       old.project?.name   ?? "Imported Project",
          lender:     old.project?.lender ?? "",
          draws:      old.draws           ?? [],
          nextDrawId: old.nextDrawId      ?? 2,
          nextItemId: old.nextItemId      ?? 9,
        }],
      };
      saveProjects(migrated);
      return migrated;
    }

    return makeSeedProjectsState();
  } catch {
    return makeSeedProjectsState();
  }
}

function saveProjects(state) {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Could not save project data:", e);
  }
}

function loadDocuments() {
  try {
    const raw = localStorage.getItem(DOCUMENT_KEY);
    return raw ? JSON.parse(raw) : { nextDocId: 1, records: [] };
  } catch {
    return { nextDocId: 1, records: [] };
  }
}

function saveDocuments(docState) {
  try {
    localStorage.setItem(DOCUMENT_KEY, JSON.stringify(docState));
    return true;
  } catch (e) {
    console.warn("Document storage failed (quota?):", e);
    return false;
  }
}

// ── Utility: immutably update one project in state ────────────────────────────

function mapProject(state, projectId, fn) {
  return {
    ...state,
    projects: state.projects.map(p => p.id === projectId ? fn(p) : p),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// THE HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useStore() {

  const [projectsState, setProjectsStateRaw] = useState(loadProjects);
  const [docState,      setDocStateRaw      ] = useState(loadDocuments);
  const [storageError,  setStorageError     ] = useState(null);

  const setProjectsState = useCallback(updater => {
    setProjectsStateRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveProjects(next);
      return next;
    });
  }, []);

  const setDocState = useCallback(updater => {
    setDocStateRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const ok = saveDocuments(next);
      if (!ok) {
        setStorageError(
          "Storage quota exceeded. The PDF could not be saved. " +
          "Try deleting older documents or use smaller files."
        );
      } else {
        setStorageError(null);
      }
      return next;
    });
  }, []);

  // ── Portfolio actions ──────────────────────────────────────────────────────

  function addProject(name, lender) {
    setProjectsState(prev => {
      const id = `proj_${prev.nextProjectId}`;
      return {
        nextProjectId: prev.nextProjectId + 1,
        projects: [...prev.projects, makeProject(id, name, lender)],
      };
    });
  }

  function deleteProject(projectId) {
    // Remove all documents belonging to any draw in this project
    const project = projectsState.projects.find(p => p.id === projectId);
    if (project) {
      const drawIds = new Set(project.draws.map(d => d.id));
      setDocState(prev => ({
        ...prev,
        records: prev.records.filter(doc => !drawIds.has(doc.drawId)),
      }));
    }
    setProjectsState(prev => ({
      ...prev,
      projects: prev.projects.filter(p => p.id !== projectId),
    }));
  }

  // ── Project-level actions (all scoped to projectId) ────────────────────────

  function updateProject(projectId, fields) {
    setProjectsState(prev =>
      mapProject(prev, projectId, p => ({ ...p, ...fields }))
    );
  }

  function addDraw(projectId) {
    setProjectsState(prev =>
      mapProject(prev, projectId, proj => {
        const lastDraw = proj.draws[proj.draws.length - 1];
        // Build cumulative drawn amounts per line-item name
        const cumulativeByName = {};
        for (const draw of proj.draws) {
          for (const item of draw.lineItems) {
            const drawn = (item.priorDraws || 0) + (item.currentDraw || 0);
            cumulativeByName[item.name] = (cumulativeByName[item.name] || 0) + drawn;
          }
        }
        let itemId = proj.nextItemId;
        const newLineItems = lastDraw.lineItems.map(item => ({
          id:             itemId++,
          name:           item.name,
          originalBudget: item.originalBudget,
          priorDraws:     cumulativeByName[item.name] || 0,
          currentDraw:    0,
        }));
        const newDraw = {
          id:         `draw_${proj.nextDrawId}`,
          drawNumber: proj.draws.length + 1,
          date:       new Date().toISOString().split("T")[0],
          status:     "Draft",
          lineItems:  newLineItems,
        };
        return {
          ...proj,
          draws:      [...proj.draws, newDraw],
          nextDrawId: proj.nextDrawId + 1,
          nextItemId: itemId,
        };
      })
    );
  }

  function updateDraw(projectId, drawId, fields) {
    setProjectsState(prev =>
      mapProject(prev, projectId, proj => ({
        ...proj,
        draws: proj.draws.map(d => d.id === drawId ? { ...d, ...fields } : d),
      }))
    );
  }

  function deleteDraw(projectId, drawId) {
    setDocState(prev => ({
      ...prev,
      records: prev.records.filter(doc => doc.drawId !== drawId),
    }));
    setProjectsState(prev =>
      mapProject(prev, projectId, proj => ({
        ...proj,
        draws: proj.draws
          .filter(d => d.id !== drawId)
          .map((d, i) => ({ ...d, drawNumber: i + 1 })),
      }))
    );
  }

  function addLineItem(projectId, drawId) {
    setProjectsState(prev =>
      mapProject(prev, projectId, proj => ({
        ...proj,
        nextItemId: proj.nextItemId + 1,
        draws: proj.draws.map(d =>
          d.id !== drawId ? d : {
            ...d,
            lineItems: [
              ...d.lineItems,
              { id: proj.nextItemId, name: "New Line Item", originalBudget: 0, priorDraws: 0, currentDraw: 0 },
            ],
          }
        ),
      }))
    );
  }

  function updateLineItem(projectId, drawId, itemId, field, value) {
    setProjectsState(prev =>
      mapProject(prev, projectId, proj => ({
        ...proj,
        draws: proj.draws.map(d =>
          d.id !== drawId ? d : {
            ...d,
            lineItems: d.lineItems.map(item =>
              item.id === itemId ? { ...item, [field]: value } : item
            ),
          }
        ),
      }))
    );
  }

  function deleteLineItem(projectId, drawId, itemId) {
    setProjectsState(prev =>
      mapProject(prev, projectId, proj => ({
        ...proj,
        draws: proj.draws.map(d =>
          d.id !== drawId ? d : {
            ...d,
            lineItems: d.lineItems.filter(item => item.id !== itemId),
          }
        ),
      }))
    );
  }

  // ── Document actions (API unchanged from v3) ───────────────────────────────

  function addDocument(docFields) {
    let savedOk = false;
    setDocState(prev => {
      const newDoc = {
        ...docFields,
        id:         `doc_${prev.nextDocId}`,
        uploadedAt: new Date().toISOString(),
      };
      const next = {
        nextDocId: prev.nextDocId + 1,
        records:   [...prev.records, newDoc],
      };
      savedOk = saveDocuments(next);
      return next;
    });
    return savedOk;
  }

  function updateDocument(docId, fields) {
    const { fileData, ...safeFields } = fields;
    setDocState(prev => ({
      ...prev,
      records: prev.records.map(doc =>
        doc.id === docId ? { ...doc, ...safeFields } : doc
      ),
    }));
  }

  function deleteDocument(docId) {
    setDocState(prev => ({
      ...prev,
      records: prev.records.filter(doc => doc.id !== docId),
    }));
  }

  function getDocumentsForDraw(drawId) {
    return docState.records.filter(doc => doc.drawId === drawId);
  }

  return {
    // Portfolio
    projects: projectsState.projects,
    addProject,
    deleteProject,

    // Project-scoped actions (projectId is always the first argument)
    updateProject,
    addDraw,
    updateDraw,
    deleteDraw,
    addLineItem,
    updateLineItem,
    deleteLineItem,

    // Documents (unchanged API)
    storageError,
    addDocument,
    updateDocument,
    deleteDocument,
    getDocumentsForDraw,
  };
}
