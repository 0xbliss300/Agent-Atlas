import { getAppStorage } from "./filePersistence.js";

export const PROJECT_EVENT_SCHEMA_VERSION = 1;
export const PROJECT_EVENT_STORAGE_KEY = "agent-project-showcase.project-events.v1";
export const PROJECT_EVENT_LIMIT = 200;

export const PROJECT_EVENT_TYPES = Object.freeze({
  PROJECT: "project",
  STATUS: "status",
  TASK: "task",
  BLOCKER: "blocker",
  LOCAL: "local",
  NOTE: "note",
  EVAL: "eval",
});

const VALID_TYPES = new Set(Object.values(PROJECT_EVENT_TYPES));

function cleanText(value, maximum = 180) {
  const text = typeof value === "string" ? value.trim() : String(value ?? "").trim();
  return text.slice(0, maximum);
}

function localIsoTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${String(date.getMilliseconds()).padStart(3, "0")}${sign}${pad(Math.floor(absoluteOffset / 60))}:${pad(absoluteOffset % 60)}`;
}

function uniqueEventId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `project-event-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
  );
}

function normalizeChange(change, index) {
  const field = cleanText(change?.field, 60);
  const label = cleanText(change?.label, 60);
  if (!field || !label) throw new Error(`变更事件字段第 ${index + 1} 项无效。`);
  return Object.freeze({
    field,
    label,
    before: cleanText(change?.before),
    after: cleanText(change?.after),
  });
}

function normalizeSubject(subject) {
  if (!subject) return null;
  const kind = cleanText(subject.kind, 30);
  const id = cleanText(subject.id, 100);
  const title = cleanText(subject.title);
  if (!kind || !id || !title) throw new Error("变更事件来源结构无效。");
  return Object.freeze({
    kind,
    id,
    title,
    action: cleanText(subject.action, 30) || null,
    sourceDeleted: Boolean(subject.sourceDeleted),
  });
}

export function normalizeProjectEvent(event, index = 0) {
  const id = cleanText(event?.id, 100);
  const projectId = cleanText(event?.projectId, 100);
  const type = cleanText(event?.type, 30);
  const occurredAt = cleanText(event?.occurredAt, 50);
  const occurredTimestamp = Date.parse(occurredAt);
  const summary = cleanText(event?.summary);
  if (
    !id ||
    !projectId ||
    !VALID_TYPES.has(type) ||
    !summary ||
    !Number.isFinite(occurredTimestamp)
  ) {
    throw new Error(`项目变更事件第 ${index + 1} 项结构无效。`);
  }
  const rawSource = cleanText(event?.source, 20);
  return Object.freeze({
    id,
    projectId,
    type,
    occurredAt,
    occurredTimestamp,
    occurred: occurredAt.slice(0, 10),
    occurredTime: occurredAt.slice(11, 16),
    summary,
    changes: Object.freeze((event.changes ?? []).map(normalizeChange)),
    subject: normalizeSubject(event.subject),
    source: rawSource === "auto" ? "auto" : "user",
  });
}

function createEvent(projectId, type, summary, options = {}, date = new Date()) {
  return normalizeProjectEvent({
    id: uniqueEventId(),
    projectId,
    type,
    summary,
    occurredAt: localIsoTimestamp(date),
    changes: options.changes ?? [],
    subject: options.subject ?? null,
    source: options.source ?? "user",
  });
}

function valueLabel(value) {
  if (typeof value === "boolean") return value ? "已完成" : "待处理";
  return cleanText(value) || "未配置";
}

function change(field, label, before, after) {
  return {
    field,
    label,
    before: valueLabel(before),
    after: valueLabel(after),
  };
}

export function createProjectCreatedEvent(project, date = new Date()) {
  return createEvent(
    project.id,
    PROJECT_EVENT_TYPES.PROJECT,
    `创建项目“${project.name}”`,
    {
      subject: { kind: "project", id: project.id, title: project.name, action: "created" },
      changes: [
        change("status", "状态", "", project.statusLabel || project.status),
        change("progress", "完成度", "", `${project.progress}%`),
        change("milestone", "当前里程碑", "", project.milestone),
      ],
    },
    date,
  );
}

export function createProjectUpdatedEvent(before, after, date = new Date()) {
  const fields = [
    ["status", "状态", before.statusLabel || before.status, after.statusLabel || after.status],
    ["progress", "完成度", `${before.progress}%`, `${after.progress}%`],
    ["milestone", "当前里程碑", before.milestone, after.milestone],
  ];
  const changes = fields
    .filter(([, , previous, next]) => String(previous) !== String(next))
    .map(([field, label, previous, next]) => change(field, label, previous, next));
  if (!changes.length) return null;
  return createEvent(
    after.id,
    PROJECT_EVENT_TYPES.STATUS,
    `更新项目状态：${changes.map((item) => item.label).join("、")}`,
    { changes },
    date,
  );
}

export function createTaskToggledEvent(before, after, taskId, date = new Date()) {
  const previous = before.nextTasks.find((task) => task.id === taskId);
  const current = after.nextTasks.find((task) => task.id === taskId);
  if (!previous || !current || previous.done === current.done) return null;
  return createEvent(
    after.id,
    PROJECT_EVENT_TYPES.TASK,
    `${current.done ? "完成" : "重新打开"}任务“${current.title}”`,
    {
      changes: [change("done", "任务状态", previous.done, current.done)],
      subject: {
        kind: "task",
        id: current.id,
        title: current.title,
        action: current.done ? "completed" : "reopened",
      },
    },
    date,
  );
}

export function createBlockerToggledEvent(before, after, blockerId, date = new Date()) {
  const previous = before.blockers.find((blocker) => blocker.id === blockerId);
  const current = after.blockers.find((blocker) => blocker.id === blockerId);
  if (!previous || !current || previous.done === current.done) return null;
  return createEvent(
    after.id,
    PROJECT_EVENT_TYPES.BLOCKER,
    `${current.done ? "解决" : "重新打开"}阻塞项“${current.title}”`,
    {
      changes: [change("done", "阻塞状态", previous.done, current.done)],
      subject: {
        kind: "blocker",
        id: current.id,
        title: current.title,
        action: current.done ? "resolved" : "reopened",
      },
    },
    date,
  );
}

export function createLocalStatusEvent(
  before,
  after,
  syncResult = {},
  date = new Date(),
  source = "user",
) {
  const fields = [
    ["status", "状态", before.statusLabel || before.status, after.statusLabel || after.status],
    ["progress", "完成度", `${before.progress}%`, `${after.progress}%`],
    ["milestone", "当前里程碑", before.milestone, after.milestone],
    ["tasks", "任务数", before.nextTasks.length, after.nextTasks.length],
    ["blockers", "阻塞项数", before.blockers.length, after.blockers.length],
  ];
  const changes = fields
    .filter(([, , previous, next]) => String(previous) !== String(next))
    .map(([field, label, previous, next]) => change(field, label, previous, next));
  const sourceName = cleanText(syncResult.sourceName) || "本地来源";
  return createEvent(
    after.id,
    PROJECT_EVENT_TYPES.LOCAL,
    `应用本地状态“${sourceName}”${changes.length ? `，更新 ${changes.length} 项` : "，项目字段无变化"}`,
    {
      changes,
      subject: { kind: "local", id: after.id, title: sourceName, action: "applied" },
      source,
    },
    date,
  );
}

export function createResearchNoteEvent(note, action, date = new Date(), previousNote = null) {
  const actionLabels = {
    created: "创建",
    updated: "更新",
    deleted: "删除",
  };
  if (!actionLabels[action]) throw new Error("研究笔记事件动作无效。");
  const changes =
    action === "updated" && previousNote?.title !== note.title
      ? [change("title", "笔记标题", previousNote?.title, note.title)]
      : [];
  return createEvent(
    note.projectId,
    PROJECT_EVENT_TYPES.NOTE,
    `${actionLabels[action]}研究笔记“${note.title}”`,
    {
      changes,
      subject: {
        kind: "note",
        id: note.id,
        title: note.title,
        action,
        sourceDeleted: action === "deleted",
      },
    },
    date,
  );
}

// 评测结果事件：记录评测指标的录入，参与变更时间线但不复制完整数据集。
// summary 仅包含指标名、数值与评测日期，详情仍由评测列表承载。
export function createEvaluationEvent(project, evaluation, date = new Date()) {
  const metric = cleanText(evaluation?.metric, 60) || "未命名指标";
  const value = cleanText(evaluation?.value, 60) || "未配置";
  const evaluated = cleanText(evaluation?.evaluated, 10) || localIsoTimestamp(date).slice(0, 10);
  return createEvent(
    project.id,
    PROJECT_EVENT_TYPES.EVAL,
    `记录评测“${metric}”：${value}（${evaluated}）`,
    {
      subject: {
        kind: "evaluation",
        id: evaluation?.id,
        title: `${metric}：${value}`,
        action: "recorded",
      },
    },
    date,
  );
}

export function sortProjectEvents(events = []) {
  return [...events].sort(
    (left, right) =>
      right.occurredTimestamp - left.occurredTimestamp || left.id.localeCompare(right.id),
  );
}

export function addProjectEvent(events = [], event, limit = PROJECT_EVENT_LIMIT) {
  if (!event) return events;
  const others = events.filter((item) => item.projectId !== event.projectId);
  const forProject = sortProjectEvents([
    event,
    ...events.filter((item) => item.projectId === event.projectId && item.id !== event.id),
  ]).slice(0, limit);
  return [...others, ...forProject];
}

export function selectProjectEvents(events = [], projectId = "", type = "all") {
  return sortProjectEvents(
    events.filter(
      (event) => event.projectId === projectId && (type === "all" || event.type === type),
    ),
  );
}

export function deleteProjectEventsForProject(events = [], projectId = "") {
  return events.filter((event) => event.projectId !== projectId);
}

export function markResearchNoteSourceDeleted(events = [], noteId = "") {
  return events.map((event) =>
    event.subject?.kind === "note" && event.subject.id === noteId
      ? normalizeProjectEvent({
          ...event,
          subject: { ...event.subject, sourceDeleted: true },
        })
      : event,
  );
}

export function serializeProjectEvent(event) {
  return {
    id: event.id,
    projectId: event.projectId,
    type: event.type,
    occurredAt: event.occurredAt,
    summary: event.summary,
    changes: event.changes.map(({ field, label, before, after }) => ({
      field,
      label,
      before,
      after,
    })),
    subject: event.subject
      ? {
          kind: event.subject.kind,
          id: event.subject.id,
          title: event.subject.title,
          action: event.subject.action,
          sourceDeleted: event.subject.sourceDeleted,
        }
      : null,
    source: event.source ?? "user",
  };
}

export function loadProjectEventStore(storage = getAppStorage()) {
  if (!storage) return { events: [], error: null };
  const raw = storage.getItem(PROJECT_EVENT_STORAGE_KEY);
  if (!raw) return { events: [], error: null };
  try {
    const payload = JSON.parse(raw);
    if (payload.schemaVersion !== PROJECT_EVENT_SCHEMA_VERSION || !Array.isArray(payload.events)) {
      throw new Error("unsupported-project-event-schema");
    }
    return { events: payload.events.map(normalizeProjectEvent), error: null };
  } catch {
    return {
      events: [],
      error: "本地项目变更时间线无法读取。项目和研究笔记主体未受影响。",
    };
  }
}

export function saveProjectEventStore(events, storage = getAppStorage()) {
  if (!storage) throw new Error("当前浏览器不支持本地存储。");
  storage.setItem(
    PROJECT_EVENT_STORAGE_KEY,
    JSON.stringify({
      schemaVersion: PROJECT_EVENT_SCHEMA_VERSION,
      events: events.map(serializeProjectEvent),
    }),
  );
}
