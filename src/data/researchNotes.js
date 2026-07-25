export const RESEARCH_NOTE_SCHEMA_VERSION = 1;
export const RESEARCH_NOTE_STORAGE_KEY = "agent-project-showcase.research-notes.v1";

export const EMPTY_RESEARCH_NOTE_DRAFT = Object.freeze({
  projectId: "",
  title: "",
  body: "",
});

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function localIsoTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  const milliseconds = String(date.getMilliseconds()).padStart(3, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${milliseconds}${sign}${pad(Math.floor(absoluteOffset / 60))}:${pad(absoluteOffset % 60)}`;
}

function createNoteId(existingNotes = []) {
  const ids = new Set(existingNotes.map((note) => note.id));
  let id;
  do {
    id =
      globalThis.crypto?.randomUUID?.() ??
      `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  } while (ids.has(id));
  return id;
}

export function validateResearchNoteDraft(draft, projects = []) {
  const errors = {};
  if (!cleanText(draft?.projectId)) {
    errors.projectId = "请选择笔记所属项目。";
  } else if (!projects.some((project) => project.id === cleanText(draft.projectId))) {
    errors.projectId = "所选项目不存在，请重新选择。";
  }
  if (!cleanText(draft?.title)) errors.title = "请输入笔记标题。";
  if (!cleanText(draft?.body)) errors.body = "请输入 Markdown 正文。";
  return errors;
}

export function normalizeResearchNote(note, index = 0) {
  const id = cleanText(note?.id);
  const projectId = cleanText(note?.projectId);
  const title = cleanText(note?.title);
  const body = cleanText(note?.body);
  const createdAt = cleanText(note?.createdAt);
  const updatedAt = cleanText(note?.updatedAt);
  const createdTimestamp = Date.parse(createdAt);
  const updatedTimestamp = Date.parse(updatedAt);

  if (!id || !projectId || !title || !body) {
    throw new Error(`研究笔记第 ${index + 1} 项缺少必要字段。`);
  }
  if (!Number.isFinite(createdTimestamp) || !Number.isFinite(updatedTimestamp)) {
    throw new Error(`研究笔记第 ${index + 1} 项时间无效。`);
  }

  return Object.freeze({
    id,
    projectId,
    title,
    body,
    createdAt,
    createdTimestamp,
    created: createdAt.slice(0, 10),
    updatedAt,
    updatedTimestamp,
    updated: updatedAt.slice(0, 10),
    updatedTime: updatedAt.slice(11, 16),
  });
}

export function createResearchNoteRecord(
  draft,
  existingNotes = [],
  projects = [],
  date = new Date(),
) {
  const errors = validateResearchNoteDraft(draft, projects);
  if (Object.keys(errors).length) {
    const error = new Error("研究笔记表单校验失败。");
    error.fields = errors;
    throw error;
  }
  const timestamp = localIsoTimestamp(date);
  return normalizeResearchNote({
    id: createNoteId(existingNotes),
    projectId: cleanText(draft.projectId),
    title: cleanText(draft.title),
    body: cleanText(draft.body),
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export function updateResearchNoteRecord(
  noteId,
  draft,
  existingNotes = [],
  projects = [],
  date = new Date(),
) {
  const current = existingNotes.find((note) => note.id === noteId);
  if (!current) throw new Error("找不到需要编辑的研究笔记。");
  const errors = validateResearchNoteDraft(draft, projects);
  if (Object.keys(errors).length) {
    const error = new Error("研究笔记表单校验失败。");
    error.fields = errors;
    throw error;
  }
  return normalizeResearchNote({
    ...current,
    projectId: cleanText(draft.projectId),
    title: cleanText(draft.title),
    body: cleanText(draft.body),
    updatedAt: localIsoTimestamp(date),
  });
}

export function deleteResearchNoteRecord(noteId, existingNotes = []) {
  if (!existingNotes.some((note) => note.id === noteId)) {
    throw new Error("找不到需要删除的研究笔记。");
  }
  return existingNotes.filter((note) => note.id !== noteId);
}

export function deleteResearchNotesForProject(projectId, existingNotes = []) {
  return existingNotes.filter((note) => note.projectId !== projectId);
}

export function findResearchNoteById(notes = [], noteId = "") {
  return notes.find((note) => note.id === noteId) ?? null;
}

export function selectProjectResearchNotes(notes = [], projectId = "") {
  return sortResearchNotes(notes.filter((note) => note.projectId === projectId));
}

export function sortResearchNotes(notes = []) {
  return [...notes].sort(
    (left, right) =>
      right.updatedTimestamp - left.updatedTimestamp || left.id.localeCompare(right.id),
  );
}

export function getResearchNoteExcerpt(body = "", maximumLength = 150) {
  const plain = String(body)
    .replace(/```[\s\S]*?```/g, " 代码片段 ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~|[\]-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > maximumLength ? `${plain.slice(0, maximumLength).trim()}…` : plain;
}

export function loadResearchNoteStore(storage = globalThis.localStorage) {
  if (!storage) return { notes: [], error: null };
  const raw = storage.getItem(RESEARCH_NOTE_STORAGE_KEY);
  if (!raw) return { notes: [], error: null };

  try {
    const payload = JSON.parse(raw);
    if (payload.schemaVersion !== RESEARCH_NOTE_SCHEMA_VERSION || !Array.isArray(payload.notes)) {
      throw new Error("unsupported-research-note-schema");
    }
    return { notes: payload.notes.map(normalizeResearchNote), error: null };
  } catch {
    return {
      notes: [],
      error: "本地研究笔记无法读取，已安全回退为空状态。原数据没有被覆盖。",
    };
  }
}

export function saveResearchNoteStore(notes, storage = globalThis.localStorage) {
  if (!storage) throw new Error("当前浏览器不支持本地存储。");
  storage.setItem(
    RESEARCH_NOTE_STORAGE_KEY,
    JSON.stringify({ schemaVersion: RESEARCH_NOTE_SCHEMA_VERSION, notes }),
  );
}
