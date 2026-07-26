import { getResearchNoteExcerpt } from "./researchNotes.js";
import { getAppStorage } from "./filePersistence.js";

export const NOTE_DRAFT_SCHEMA_VERSION = 1;
export const NOTE_HISTORY_SCHEMA_VERSION = 1;
export const NOTE_DRAFT_STORAGE_KEY = "agent-project-showcase.research-note-drafts.v1";
export const NOTE_HISTORY_STORAGE_KEY = "agent-project-showcase.research-note-history.v1";
export const NOTE_HISTORY_LIMIT = 10;

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function localIsoTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${String(date.getMilliseconds()).padStart(3, "0")}${sign}${pad(Math.floor(absoluteOffset / 60))}:${pad(absoluteOffset % 60)}`;
}

function uniqueId(prefix) {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
  );
}

export function getResearchNoteDraftKey(noteId = "", preferredProjectId = "") {
  const cleanNoteId = cleanText(noteId);
  return cleanNoteId
    ? `note:${cleanNoteId}`
    : `new:${cleanText(preferredProjectId) || "unassigned"}`;
}

export function normalizeResearchNoteDraft(record, index = 0) {
  const key = cleanText(record?.key);
  const projectId = cleanText(record?.projectId);
  const title = typeof record?.title === "string" ? record.title : "";
  const body = typeof record?.body === "string" ? record.body : "";
  const updatedAt = cleanText(record?.updatedAt);
  const updatedTimestamp = Date.parse(updatedAt);
  if (!key || !Number.isFinite(updatedTimestamp)) {
    throw new Error(`研究笔记草稿第 ${index + 1} 项结构无效。`);
  }
  return Object.freeze({
    key,
    noteId: cleanText(record?.noteId) || null,
    projectId,
    title,
    body,
    updatedAt,
    updatedTimestamp,
  });
}

export function upsertResearchNoteDraft(
  key,
  draft,
  existingDrafts = [],
  date = new Date(),
  noteId = "",
) {
  const record = normalizeResearchNoteDraft({
    key,
    noteId,
    projectId: typeof draft?.projectId === "string" ? draft.projectId : "",
    title: typeof draft?.title === "string" ? draft.title : "",
    body: typeof draft?.body === "string" ? draft.body : "",
    updatedAt: localIsoTimestamp(date),
  });
  return [...existingDrafts.filter((item) => item.key !== record.key), record];
}

export function findResearchNoteDraft(drafts = [], key = "") {
  return drafts.find((draft) => draft.key === key) ?? null;
}

export function deleteResearchNoteDraft(drafts = [], key = "") {
  return drafts.filter((draft) => draft.key !== key);
}

export function deleteResearchNoteDraftsForNote(drafts = [], noteId = "") {
  return drafts.filter(
    (draft) => draft.noteId !== noteId && draft.key !== getResearchNoteDraftKey(noteId),
  );
}

export function deleteResearchNoteDraftsForProject(drafts = [], projectId = "") {
  return drafts.filter((draft) => draft.projectId !== projectId);
}

export function loadResearchNoteDraftStore(storage = getAppStorage()) {
  if (!storage) return { drafts: [], error: null };
  const raw = storage.getItem(NOTE_DRAFT_STORAGE_KEY);
  if (!raw) return { drafts: [], error: null };
  try {
    const payload = JSON.parse(raw);
    if (payload.schemaVersion !== NOTE_DRAFT_SCHEMA_VERSION || !Array.isArray(payload.drafts)) {
      throw new Error("unsupported-note-draft-schema");
    }
    return { drafts: payload.drafts.map(normalizeResearchNoteDraft), error: null };
  } catch {
    return {
      drafts: [],
      error: "本地研究笔记草稿无法读取。正式笔记未受影响，损坏草稿也不会覆盖正式内容。",
    };
  }
}

export function saveResearchNoteDraftStore(drafts, storage = getAppStorage()) {
  if (!storage) throw new Error("当前浏览器不支持本地存储。");
  storage.setItem(
    NOTE_DRAFT_STORAGE_KEY,
    JSON.stringify({
      schemaVersion: NOTE_DRAFT_SCHEMA_VERSION,
      drafts: drafts.map((draft) => ({
        key: draft.key,
        noteId: draft.noteId,
        projectId: draft.projectId,
        title: draft.title,
        body: draft.body,
        updatedAt: draft.updatedAt,
      })),
    }),
  );
}

export function normalizeResearchNoteHistory(snapshot, index = 0) {
  const id = cleanText(snapshot?.id);
  const noteId = cleanText(snapshot?.noteId);
  const projectId = cleanText(snapshot?.projectId);
  const title = cleanText(snapshot?.title);
  const body = typeof snapshot?.body === "string" ? snapshot.body.trim() : "";
  const createdAt = cleanText(snapshot?.createdAt);
  const createdTimestamp = Date.parse(createdAt);
  if (!id || !noteId || !projectId || !title || !body || !Number.isFinite(createdTimestamp)) {
    throw new Error(`研究笔记历史第 ${index + 1} 项结构无效。`);
  }
  return Object.freeze({
    id,
    noteId,
    projectId,
    title,
    body,
    createdAt,
    createdTimestamp,
    created: createdAt.slice(0, 10),
    createdTime: createdAt.slice(11, 16),
    excerpt: getResearchNoteExcerpt(body, 110),
  });
}

export function sortResearchNoteHistories(histories = []) {
  return [...histories].sort(
    (left, right) =>
      right.createdTimestamp - left.createdTimestamp || left.id.localeCompare(right.id),
  );
}

export function addResearchNoteHistorySnapshot(
  note,
  existingHistories = [],
  date = new Date(note?.updatedAt || Date.now()),
) {
  const snapshot = normalizeResearchNoteHistory({
    id: uniqueId("note-version"),
    noteId: note?.id,
    projectId: note?.projectId,
    title: note?.title,
    body: note?.body,
    createdAt: localIsoTimestamp(date),
  });
  const forNote = sortResearchNoteHistories([
    snapshot,
    ...existingHistories.filter((item) => item.noteId === snapshot.noteId),
  ]).slice(0, NOTE_HISTORY_LIMIT);
  return [...existingHistories.filter((item) => item.noteId !== snapshot.noteId), ...forNote];
}

export function selectResearchNoteHistories(histories = [], noteId = "") {
  return sortResearchNoteHistories(histories.filter((item) => item.noteId === noteId));
}

export function deleteResearchNoteHistoriesForNote(histories = [], noteId = "") {
  return histories.filter((item) => item.noteId !== noteId);
}

export function deleteResearchNoteHistoriesForProject(histories = [], projectId = "") {
  return histories.filter((item) => item.projectId !== projectId);
}

export function loadResearchNoteHistoryStore(storage = getAppStorage()) {
  if (!storage) return { histories: [], error: null };
  const raw = storage.getItem(NOTE_HISTORY_STORAGE_KEY);
  if (!raw) return { histories: [], error: null };
  try {
    const payload = JSON.parse(raw);
    if (
      payload.schemaVersion !== NOTE_HISTORY_SCHEMA_VERSION ||
      !Array.isArray(payload.histories)
    ) {
      throw new Error("unsupported-note-history-schema");
    }
    return {
      histories: payload.histories.map(normalizeResearchNoteHistory),
      error: null,
    };
  } catch {
    return {
      histories: [],
      error: "本地研究笔记版本历史无法读取。正式笔记未受影响，历史恢复功能已安全停用。",
    };
  }
}

export function serializeResearchNoteHistory(snapshot) {
  return {
    id: snapshot.id,
    noteId: snapshot.noteId,
    projectId: snapshot.projectId,
    title: snapshot.title,
    body: snapshot.body,
    createdAt: snapshot.createdAt,
  };
}

export function saveResearchNoteHistoryStore(histories, storage = getAppStorage()) {
  if (!storage) throw new Error("当前浏览器不支持本地存储。");
  storage.setItem(
    NOTE_HISTORY_STORAGE_KEY,
    JSON.stringify({
      schemaVersion: NOTE_HISTORY_SCHEMA_VERSION,
      histories: histories.map(serializeResearchNoteHistory),
    }),
  );
}

export function createNoteDraftDiff(base = {}, candidate = {}) {
  const fields = [
    ["projectId", "所属项目"],
    ["title", "标题"],
  ]
    .filter(([key]) => String(base[key] ?? "") !== String(candidate[key] ?? ""))
    .map(([key, label]) => ({
      key,
      label,
      before: String(base[key] ?? ""),
      after: String(candidate[key] ?? ""),
    }));
  const beforeLines = String(base.body ?? "").split(/\r?\n/);
  const afterLines = String(candidate.body ?? "").split(/\r?\n/);
  const maximum = Math.max(beforeLines.length, afterLines.length);
  const body = [];
  for (let index = 0; index < maximum; index += 1) {
    const before = beforeLines[index];
    const after = afterLines[index];
    if (before === after) {
      body.push({ type: "same", before: before ?? "", after: after ?? "", line: index + 1 });
    } else {
      if (before !== undefined) {
        body.push({ type: "removed", before, after: "", line: index + 1 });
      }
      if (after !== undefined) {
        body.push({ type: "added", before: "", after, line: index + 1 });
      }
    }
  }
  return {
    fields,
    body,
    changed: fields.length > 0 || body.some((line) => line.type !== "same"),
  };
}
