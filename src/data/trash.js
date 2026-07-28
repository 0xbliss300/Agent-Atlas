import { getAppStorage } from "./filePersistence.js";
import { importAppBackup } from "./backup.js";
import { serializeProjectEvent } from "./projectEvents.js";
import { serializeResearchNoteHistory } from "./noteWorkspace.js";

export const TRASH_SCHEMA_VERSION = 1;
export const TRASH_STORAGE_KEY = "agent-project-showcase.trash.v1";
export const TRASH_RETENTION_DAYS = 7;
export const TRASH_MAX_ENTRIES = 30;

function cleanText(value, maximum = 180) {
  const text = typeof value === "string" ? value.trim() : String(value ?? "").trim();
  return maximum ? text.slice(0, maximum) : text;
}

function localIsoTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${String(date.getMilliseconds()).padStart(3, "0")}${sign}${pad(Math.floor(absoluteOffset / 60))}:${pad(absoluteOffset % 60)}`;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function uniqueTrashEntryId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `trash-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
  );
}

export function serializeTrashEntry(entry) {
  return {
    id: entry.id,
    kind: entry.kind,
    deletedAt: entry.deletedAt,
    expiresAt: entry.expiresAt,
    project: entry.project,
    note: entry.note,
    notes: entry.notes,
    histories: entry.histories,
    events: entry.events,
    drafts: entry.drafts,
  };
}

export function normalizeTrashEntry(entry, index = 0) {
  const id = cleanText(entry?.id, 100);
  const kind = cleanText(entry?.kind, 30);
  const deletedAt = cleanText(entry?.deletedAt, 50);
  const expiresAt = cleanText(entry?.expiresAt, 50);
  if (!id || (kind !== "project" && kind !== "research-note")) {
    throw new Error(`回收站条目第 ${index + 1} 项结构无效。`);
  }
  if (!Number.isFinite(Date.parse(deletedAt)) || !Number.isFinite(Date.parse(expiresAt))) {
    throw new Error(`回收站条目第 ${index + 1} 项时间戳无效。`);
  }
  return {
    id,
    kind,
    deletedAt,
    expiresAt,
    project: entry?.project ?? null,
    note: entry?.note ?? null,
    notes: Array.isArray(entry?.notes) ? entry.notes : [],
    histories: Array.isArray(entry?.histories) ? entry.histories : [],
    events: Array.isArray(entry?.events) ? entry.events : [],
    drafts: Array.isArray(entry?.drafts) ? entry.drafts : [],
  };
}

export function cleanupTrash(entries = [], now = new Date()) {
  const cutoff = now.getTime();
  const kept = entries.filter((entry) => Date.parse(entry.expiresAt) > cutoff);
  kept.sort((left, right) => Date.parse(right.deletedAt) - Date.parse(left.deletedAt));
  return kept.slice(0, TRASH_MAX_ENTRIES);
}

export function createProjectTrashEntry(
  project,
  notes = [],
  histories = [],
  events = [],
  drafts = [],
  date = new Date(),
) {
  return normalizeTrashEntry({
    id: uniqueTrashEntryId(),
    kind: "project",
    deletedAt: localIsoTimestamp(date),
    expiresAt: localIsoTimestamp(addDays(date, TRASH_RETENTION_DAYS)),
    project,
    notes,
    histories: histories.map(serializeResearchNoteHistory),
    events: events.map(serializeProjectEvent),
    drafts,
  });
}

export function createResearchNoteTrashEntry(
  note,
  histories = [],
  events = [],
  drafts = [],
  date = new Date(),
) {
  return normalizeTrashEntry({
    id: uniqueTrashEntryId(),
    kind: "research-note",
    deletedAt: localIsoTimestamp(date),
    expiresAt: localIsoTimestamp(addDays(date, TRASH_RETENTION_DAYS)),
    note,
    histories: histories.map(serializeResearchNoteHistory),
    events: events.map(serializeProjectEvent),
    drafts,
  });
}

export function softDeleteProject(
  projectId,
  projects = [],
  notes = [],
  histories = [],
  events = [],
  drafts = [],
  trashEntries = [],
) {
  const project = projects.find((item) => item.id === projectId);
  if (!project) throw new Error("找不到需要删除的项目。");

  const projectNotes = notes.filter((note) => note.projectId === projectId);
  const projectNoteIds = new Set(projectNotes.map((note) => note.id));
  const projectHistories = histories.filter((snapshot) => projectNoteIds.has(snapshot.noteId));
  const projectEvents = events.filter((event) => event.projectId === projectId);
  const projectDrafts = drafts.filter((draft) => draft.projectId === projectId);

  const entry = createProjectTrashEntry(
    project,
    projectNotes,
    projectHistories,
    projectEvents,
    projectDrafts,
  );

  return {
    entry,
    projects: projects.filter((item) => item.id !== projectId),
    notes: notes.filter((note) => note.projectId !== projectId),
    histories: histories.filter((snapshot) => !projectNoteIds.has(snapshot.noteId)),
    events: events.filter((event) => event.projectId !== projectId),
    drafts: drafts.filter((draft) => draft.projectId !== projectId),
    trashEntries: cleanupTrash([entry, ...trashEntries]),
  };
}

export function softDeleteResearchNote(
  noteId,
  notes = [],
  histories = [],
  events = [],
  drafts = [],
  trashEntries = [],
) {
  const note = notes.find((item) => item.id === noteId);
  if (!note) throw new Error("找不到需要删除的研究笔记。");

  const noteHistories = histories.filter((snapshot) => snapshot.noteId === noteId);
  const noteEvents = events.filter(
    (event) => event.subject?.kind === "note" && event.subject.id === noteId,
  );
  const noteDrafts = drafts.filter(
    (draft) => draft.noteId === noteId || draft.key === `note:${noteId}`,
  );

  const entry = createResearchNoteTrashEntry(note, noteHistories, noteEvents, noteDrafts);

  return {
    entry,
    notes: notes.filter((item) => item.id !== noteId),
    histories: histories.filter((snapshot) => snapshot.noteId !== noteId),
    events: events.filter(
      (event) => !(event.subject?.kind === "note" && event.subject.id === noteId),
    ),
    drafts: drafts.filter((draft) => draft.noteId !== noteId && draft.key !== `note:${noteId}`),
    trashEntries: cleanupTrash([entry, ...trashEntries]),
  };
}

function remapDraftKey(key, projectIdMap, noteIdMap) {
  if (key.startsWith("note:")) {
    const noteId = key.slice(5);
    const newNoteId = noteIdMap?.[noteId] || noteId;
    return `note:${newNoteId}`;
  }
  if (key.startsWith("new:")) {
    const projectId = key.slice(4);
    const newProjectId = projectIdMap?.[projectId] || projectId;
    return `new:${newProjectId}`;
  }
  return key;
}

function restoreDrafts(drafts = [], projectIdMap = {}, noteIdMap = {}) {
  return drafts.map((draft) => ({
    key: remapDraftKey(draft.key, projectIdMap, noteIdMap),
    noteId: draft.noteId ? noteIdMap?.[draft.noteId] || draft.noteId : null,
    projectId: projectIdMap?.[draft.projectId] || draft.projectId,
    title: draft.title,
    body: draft.body,
    updatedAt: draft.updatedAt,
  }));
}

function buildProjectBackupPayload(entry) {
  return {
    schemaVersion: 1,
    exportedAt: entry.deletedAt,
    projects: [entry.project],
    researchNoteSchemaVersion: 1,
    researchNotes: entry.notes,
    researchNoteHistorySchemaVersion: 1,
    researchNoteHistories: entry.histories,
    projectEventSchemaVersion: 1,
    projectEvents: entry.events,
  };
}

function buildNoteBackupPayload(entry) {
  return {
    schemaVersion: 1,
    exportedAt: entry.deletedAt,
    projects: [],
    researchNoteSchemaVersion: 1,
    researchNotes: [entry.note],
    researchNoteHistorySchemaVersion: 1,
    researchNoteHistories: entry.histories,
    projectEventSchemaVersion: 1,
    projectEvents: entry.events,
  };
}

export function restoreTrashEntry(
  entry,
  existingProjects = [],
  existingNotes = [],
  existingHistories = [],
  existingEvents = [],
  existingDrafts = [],
) {
  if (entry.kind === "project") {
    const payload = buildProjectBackupPayload(entry);
    const result = importAppBackup(
      payload,
      existingProjects,
      existingNotes,
      "merge",
      existingHistories,
      existingEvents,
      [],
      [],
    );
    const restoredDrafts = restoreDrafts(entry.drafts, result.idMap, result.noteIdMap);
    return {
      ...result,
      drafts: [...existingDrafts, ...restoredDrafts],
    };
  }

  if (entry.kind === "research-note") {
    const projectExists = existingProjects.some((project) => project.id === entry.note.projectId);
    if (!projectExists) {
      throw new Error("原项目已被删除，无法恢复此研究笔记。");
    }
    const payload = buildNoteBackupPayload(entry);
    const result = importAppBackup(
      payload,
      existingProjects,
      existingNotes,
      "merge",
      existingHistories,
      existingEvents,
      [],
      [],
    );
    const restoredDrafts = restoreDrafts(entry.drafts, result.idMap, result.noteIdMap);
    return {
      ...result,
      drafts: [...existingDrafts, ...restoredDrafts],
    };
  }

  throw new Error("回收站条目类型无效。");
}

export function permanentlyDeleteTrashEntry(entryId, trashEntries = []) {
  return trashEntries.filter((entry) => entry.id !== entryId);
}

export function emptyTrash() {
  return [];
}

export function loadTrashStore(storage = getAppStorage()) {
  if (!storage) return { entries: [], error: null };
  const raw = storage.getItem(TRASH_STORAGE_KEY);
  if (!raw) return { entries: [], error: null };
  try {
    const payload = JSON.parse(raw);
    if (payload.schemaVersion !== TRASH_SCHEMA_VERSION || !Array.isArray(payload.entries)) {
      throw new Error("unsupported-trash-schema");
    }
    return { entries: cleanupTrash(payload.entries.map(normalizeTrashEntry)), error: null };
  } catch {
    return {
      entries: [],
      error: "本地回收站数据无法读取。项目与研究笔记主体未受影响。",
    };
  }
}

export function saveTrashStore(entries, storage = getAppStorage()) {
  if (!storage) throw new Error("当前浏览器不支持本地存储。");
  storage.setItem(
    TRASH_STORAGE_KEY,
    JSON.stringify({
      schemaVersion: TRASH_SCHEMA_VERSION,
      entries: cleanupTrash(entries).map(serializeTrashEntry),
    }),
  );
}
