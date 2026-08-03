import {
  normalizeCollectionIds,
  normalizeProjectTags,
  validateProjectTags,
} from "./organization.js";
import { getAppStorage } from "./filePersistence.js";

export const PROJECT_SCHEMA_VERSION = 1;
export const PROJECT_STORAGE_KEY = "agent-project-showcase.projects.v1";

export const PROJECT_STATUSES = Object.freeze({
  PLANNING: "planning",
  ACTIVE: "active",
  PAUSED: "paused",
  DONE: "done",
});

export const PROJECT_STATUS_META = Object.freeze({
  [PROJECT_STATUSES.PLANNING]: { label: "规划中", tone: "planning" },
  [PROJECT_STATUSES.ACTIVE]: { label: "开发中", tone: "active" },
  [PROJECT_STATUSES.PAUSED]: { label: "已暂停", tone: "paused" },
  [PROJECT_STATUSES.DONE]: { label: "已完成", tone: "done" },
});

export const EMPTY_PROJECT_DRAFT = Object.freeze({
  name: "",
  short: "",
  description: "",
  status: PROJECT_STATUSES.ACTIVE,
  progress: "0",
  milestone: "",
  iconKey: "showcase",
  localPath: "",
  repositoryUrl: "",
  documentationPath: "",
  demoUrl: "",
  previewPath: "",
  featuresText: "",
  roadmapText: "",
  logText: "",
  blockersText: "",
  nextTasksText: "",
  languagesText: "",
  frameworksText: "",
  modelsText: "",
  dataSourcesText: "",
  runCommand: "",
  tagsText: "",
  pinned: false,
  collectionIds: [],
  agentModelVersion: "",
  agentPromptVersion: "",
  agentDatasetsText: "",
  agentRuntime: "",
  agentTokenCost: "",
  agentInferenceParams: "",
});

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function localIsoTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  const offsetMinutes = -date.getTimezoneOffset();
  const offsetSign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  const offsetHours = pad(Math.floor(absoluteOffset / 60));
  const offsetRemainder = pad(absoluteOffset % 60);
  const milliseconds = String(date.getMilliseconds()).padStart(3, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${milliseconds}${offsetSign}${offsetHours}:${offsetRemainder}`;
}

function isHttpUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function parseFeatures(value) {
  return cleanText(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, state = "规划中"] = line.split("|").map((item) => item.trim());
      return [name, state, state === "完成" || state === "已完成"];
    });
}

function parseRoadmap(value) {
  const allowedStates = new Set(["done", "current", "next"]);
  return cleanText(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [title, description = "", rawState = "next"] = line
        .split("|")
        .map((item) => item.trim());
      return [title, description, allowedStates.has(rawState) ? rawState : "next"];
    });
}

function parseLog(value, fallback) {
  const items = cleanText(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return items.length ? items : [fallback];
}

function parseTextList(value) {
  return cleanText(value)
    .split(/[\r\n,，]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeTextList(value) {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean);
  return parseTextList(value);
}

function createEntryId(prefix, index) {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${prefix}-${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 7)}`
  );
}

function parseChecklist(value, prefix, existingItems = []) {
  return cleanText(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const match = line.match(/^(?:[-*]\s*)?\[([ xX])\]\s*(.+)$/);
      const title = cleanText(match?.[2] ?? line.replace(/^[-*]\s*/, ""));
      const existing = existingItems.find((item) => item.title === title);
      return {
        id: existing?.id ?? createEntryId(prefix, index),
        title,
        done: match ? match[1].toLowerCase() === "x" : (existing?.done ?? false),
      };
    })
    .filter((item) => item.title);
}

function normalizeChecklist(value, prefix) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      if (typeof item === "string") {
        return { id: createEntryId(prefix, index), title: cleanText(item), done: false };
      }
      return {
        id: cleanText(item?.id) || createEntryId(prefix, index),
        title: cleanText(item?.title ?? item?.text),
        done: Boolean(item?.done ?? item?.resolved),
      };
    })
    .filter((item) => item.title);
}

function formatFeatures(features = []) {
  return features.map(([name, state]) => `${name} | ${state}`).join("\n");
}

function formatRoadmap(roadmap = []) {
  return roadmap
    .map(([title, description, state]) => `${title} | ${description} | ${state}`)
    .join("\n");
}

function formatLog(log = []) {
  return log.join("\n");
}

function formatChecklist(items = []) {
  return items.map((item) => `- [${item.done ? "x" : " "}] ${item.title}`).join("\n");
}

function generateProjectId(existingProjects = []) {
  const existingIds = new Set(existingProjects.map((project) => project.id));
  let id;
  do {
    id =
      globalThis.crypto?.randomUUID?.() ??
      `project-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  } while (existingIds.has(id));
  return id;
}

export function validateProjectDraft(draft) {
  const errors = {};
  const progress = Number(draft.progress);

  if (!cleanText(draft.name)) errors.name = "请输入项目名称。";
  if (!cleanText(draft.short)) errors.short = "请输入一句话简介。";
  if (!cleanText(draft.milestone)) errors.milestone = "请输入当前里程碑。";
  if (!PROJECT_STATUS_META[draft.status]) errors.status = "请选择有效的项目状态。";
  if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
    errors.progress = "完成度必须是 0 到 100 之间的数字。";
  }
  if (cleanText(draft.repositoryUrl) && !isHttpUrl(cleanText(draft.repositoryUrl))) {
    errors.repositoryUrl = "GitHub 地址必须使用 http:// 或 https://。";
  }
  if (cleanText(draft.demoUrl) && !isHttpUrl(cleanText(draft.demoUrl))) {
    errors.demoUrl = "演示地址必须使用 http:// 或 https://。";
  }
  if (
    cleanText(draft.documentationPath).includes("://") &&
    !isHttpUrl(cleanText(draft.documentationPath))
  ) {
    errors.documentationPath = "文档 URL 必须使用 http:// 或 https://；本地路径不要包含其他协议。";
  }
  const tagsError = validateProjectTags(draft.tagsText ?? draft.tags ?? []);
  if (tagsError) errors.tagsText = tagsError;

  return errors;
}

export function normalizeProject(project, index = 0) {
  const status = PROJECT_STATUS_META[project.status] ? project.status : PROJECT_STATUSES.PLANNING;
  const statusMeta = PROJECT_STATUS_META[status];
  const progressNumber = Number(project.progress);
  const progressValid =
    Number.isFinite(progressNumber) && progressNumber >= 0 && progressNumber <= 100;
  const updatedAt = cleanText(project.updatedAt) || localIsoTimestamp();
  const updatedTimestamp = Date.parse(updatedAt);

  if (!cleanText(project.id)) throw new Error(`项目数据第 ${index + 1} 项缺少唯一 ID。`);
  if (!cleanText(project.name)) throw new Error(`项目数据第 ${index + 1} 项缺少名称。`);
  if (!Number.isFinite(updatedTimestamp))
    throw new Error(`项目数据第 ${index + 1} 项更新时间无效。`);

  return Object.freeze({
    id: cleanText(project.id),
    slug: cleanText(project.slug) || cleanText(project.id),
    name: cleanText(project.name),
    short: cleanText(project.short),
    description: cleanText(project.description) || cleanText(project.short),
    status,
    statusLabel: statusMeta.label,
    statusTone: statusMeta.tone,
    progress: progressValid ? Math.round(progressNumber) : 0,
    progressValid,
    progressBasis: cleanText(project.progressBasis) || "完成度由用户手动维护。",
    iconKey: cleanText(project.iconKey) || "showcase",
    tags: Object.freeze(normalizeProjectTags(project.tags)),
    pinned: Boolean(project.pinned),
    collectionIds: Object.freeze(normalizeCollectionIds(project.collectionIds)),
    milestone: cleanText(project.milestone),
    updatedAt,
    updatedTimestamp,
    updated: updatedAt.slice(0, 10),
    updatedTime: updatedAt.slice(11, 16),
    localPath: cleanText(project.localPath) || null,
    repositoryUrl: cleanText(project.repositoryUrl) || null,
    documentationPath: cleanText(project.documentationPath) || null,
    demoUrl: cleanText(project.demoUrl) || null,
    previewPath: cleanText(project.previewPath) || null,
    features: Array.isArray(project.features) ? project.features : [],
    roadmap: Array.isArray(project.roadmap) ? project.roadmap : [],
    log: Array.isArray(project.log) ? project.log : [],
    blockers: normalizeChecklist(project.blockers, "blocker"),
    nextTasks: normalizeChecklist(project.nextTasks, "task"),
    technology: Object.freeze({
      languages: normalizeTextList(project.technology?.languages),
      frameworks: normalizeTextList(project.technology?.frameworks),
      models: normalizeTextList(project.technology?.models),
      dataSources: normalizeTextList(project.technology?.dataSources),
      runCommand: cleanText(project.technology?.runCommand),
    }),
    agentProfile: Object.freeze({
      modelVersion: cleanText(project.agentProfile?.modelVersion),
      promptVersion: cleanText(project.agentProfile?.promptVersion),
      datasets: normalizeTextList(project.agentProfile?.datasets),
      runtime: cleanText(project.agentProfile?.runtime),
      tokenCost: cleanText(project.agentProfile?.tokenCost),
      inferenceParams: cleanText(project.agentProfile?.inferenceParams),
    }),
    localSync: project.localSync
      ? Object.freeze({
          sourceType: cleanText(project.localSync.sourceType),
          sourceName: cleanText(project.localSync.sourceName),
          syncedAt: cleanText(project.localSync.syncedAt),
          branch: cleanText(project.localSync.branch),
          commit: cleanText(project.localSync.commit),
          filesRead: normalizeTextList(project.localSync.filesRead),
        })
      : null,
  });
}

export function createProjectRecord(draft, existingProjects = [], sourceMetadata = null) {
  const errors = validateProjectDraft(draft);
  if (Object.keys(errors).length) {
    const error = new Error("项目表单校验失败。");
    error.fields = errors;
    throw error;
  }

  const id = generateProjectId(existingProjects);
  const name = cleanText(draft.name);
  const updatedAt = localIsoTimestamp();
  return normalizeProject({
    id,
    slug: id,
    name,
    short: cleanText(draft.short),
    description: cleanText(draft.description),
    status: draft.status,
    progress: Number(draft.progress),
    progressBasis: "完成度由用户在项目表单中维护。",
    milestone: cleanText(draft.milestone),
    iconKey: cleanText(draft.iconKey) || "showcase",
    tags: normalizeProjectTags(draft.tagsText),
    pinned: Boolean(draft.pinned),
    collectionIds: normalizeCollectionIds(draft.collectionIds),
    updatedAt,
    localPath: cleanText(draft.localPath),
    repositoryUrl: cleanText(draft.repositoryUrl),
    documentationPath: cleanText(draft.documentationPath),
    demoUrl: cleanText(draft.demoUrl),
    previewPath: cleanText(draft.previewPath),
    features: parseFeatures(draft.featuresText),
    roadmap: parseRoadmap(draft.roadmapText),
    log: parseLog(draft.logText, "创建项目"),
    blockers: parseChecklist(draft.blockersText, "blocker"),
    nextTasks: parseChecklist(draft.nextTasksText, "task"),
    technology: {
      languages: parseTextList(draft.languagesText),
      frameworks: parseTextList(draft.frameworksText),
      models: parseTextList(draft.modelsText),
      dataSources: parseTextList(draft.dataSourcesText),
      runCommand: cleanText(draft.runCommand),
    },
    agentProfile: {
      modelVersion: cleanText(draft.agentModelVersion),
      promptVersion: cleanText(draft.agentPromptVersion),
      datasets: parseTextList(draft.agentDatasetsText),
      runtime: cleanText(draft.agentRuntime),
      tokenCost: cleanText(draft.agentTokenCost),
      inferenceParams: cleanText(draft.agentInferenceParams),
    },
    localSync: sourceMetadata,
  });
}

export function projectToDraft(project) {
  return {
    ...EMPTY_PROJECT_DRAFT,
    name: project.name,
    short: project.short,
    description: project.description,
    status: project.status,
    progress: String(project.progress),
    milestone: project.milestone,
    iconKey: project.iconKey,
    tagsText: project.tags.join(", "),
    pinned: project.pinned,
    collectionIds: [...project.collectionIds],
    localPath: project.localPath ?? "",
    repositoryUrl: project.repositoryUrl ?? "",
    documentationPath: project.documentationPath ?? "",
    demoUrl: project.demoUrl ?? "",
    previewPath: project.previewPath ?? "",
    featuresText: formatFeatures(project.features),
    roadmapText: formatRoadmap(project.roadmap),
    logText: formatLog(project.log),
    blockersText: formatChecklist(project.blockers),
    nextTasksText: formatChecklist(project.nextTasks),
    languagesText: project.technology.languages.join(", "),
    frameworksText: project.technology.frameworks.join(", "),
    modelsText: project.technology.models.join(", "),
    dataSourcesText: project.technology.dataSources.join(", "),
    runCommand: project.technology.runCommand,
    agentModelVersion: project.agentProfile?.modelVersion ?? "",
    agentPromptVersion: project.agentProfile?.promptVersion ?? "",
    agentDatasetsText: (project.agentProfile?.datasets ?? []).join(", "),
    agentRuntime: project.agentProfile?.runtime ?? "",
    agentTokenCost: project.agentProfile?.tokenCost ?? "",
    agentInferenceParams: project.agentProfile?.inferenceParams ?? "",
  };
}

export function updateProjectRecord(projectId, draft, existingProjects = []) {
  const errors = validateProjectDraft(draft);
  if (Object.keys(errors).length) {
    const error = new Error("项目表单校验失败。");
    error.fields = errors;
    throw error;
  }
  const current = existingProjects.find((project) => project.id === projectId);
  if (!current) throw new Error("找不到需要编辑的项目。");
  return normalizeProject({
    ...current,
    ...createProjectRecord(draft, existingProjects),
    id: current.id,
    slug: current.id,
    updatedAt: localIsoTimestamp(),
    blockers: parseChecklist(draft.blockersText, "blocker", current.blockers),
    nextTasks: parseChecklist(draft.nextTasksText, "task", current.nextTasks),
    localSync: current.localSync,
  });
}

export function duplicateProjectRecord(projectId, existingProjects = []) {
  const source = existingProjects.find((project) => project.id === projectId);
  if (!source) throw new Error("找不到需要复制的项目。");
  const draft = projectToDraft(source);
  return createProjectRecord(
    {
      ...draft,
      name: `${source.name}（副本）`,
      logText: [`复制自“${source.name}”`, ...source.log].join("\n"),
    },
    existingProjects,
  );
}

export function deleteProjectRecord(projectId, existingProjects = []) {
  if (!existingProjects.some((project) => project.id === projectId)) {
    throw new Error("找不到需要删除的项目。");
  }
  return existingProjects.filter((project) => project.id !== projectId);
}

export function setProjectPinned(projectId, pinned, existingProjects = []) {
  const current = existingProjects.find((project) => project.id === projectId);
  if (!current) throw new Error("找不到需要置顶的项目。");
  const updated = normalizeProject({
    ...current,
    pinned: Boolean(pinned),
  });
  return existingProjects.map((project) => (project.id === projectId ? updated : project));
}

export function toggleProjectTask(projectId, taskId, existingProjects = []) {
  const current = existingProjects.find((project) => project.id === projectId);
  if (!current) throw new Error("找不到需要更新的项目。");
  if (!current.nextTasks.some((task) => task.id === taskId)) {
    throw new Error("找不到需要更新的任务。");
  }
  const updated = normalizeProject({
    ...current,
    updatedAt: localIsoTimestamp(),
    nextTasks: current.nextTasks.map((task) =>
      task.id === taskId ? { ...task, done: !task.done } : task,
    ),
  });
  return existingProjects.map((project) => (project.id === projectId ? updated : project));
}

export function toggleProjectBlocker(projectId, blockerId, existingProjects = []) {
  const current = existingProjects.find((project) => project.id === projectId);
  if (!current) throw new Error("找不到需要更新的项目。");
  if (!current.blockers.some((blocker) => blocker.id === blockerId)) {
    throw new Error("找不到需要更新的阻塞项。");
  }
  const updated = normalizeProject({
    ...current,
    updatedAt: localIsoTimestamp(),
    blockers: current.blockers.map((blocker) =>
      blocker.id === blockerId ? { ...blocker, done: !blocker.done } : blocker,
    ),
  });
  return existingProjects.map((project) => (project.id === projectId ? updated : project));
}

export function applyProjectStatusSync(projectId, syncResult, existingProjects = []) {
  const current = existingProjects.find((project) => project.id === projectId);
  if (!current) throw new Error("找不到需要同步的项目。");
  const patch = syncResult?.project ?? {};
  const updatedAt = Number.isFinite(Date.parse(patch.updatedAt))
    ? patch.updatedAt
    : localIsoTimestamp();
  const synced = normalizeProject({
    ...current,
    ...patch,
    id: current.id,
    slug: current.id,
    updatedAt,
    blockers: Array.isArray(patch.blockers) ? patch.blockers : current.blockers,
    nextTasks: Array.isArray(patch.nextTasks) ? patch.nextTasks : current.nextTasks,
    technology: {
      ...current.technology,
      ...(patch.technology ?? {}),
    },
    localSync: {
      sourceType: syncResult?.sourceType,
      sourceName: syncResult?.sourceName,
      syncedAt: localIsoTimestamp(),
      branch: syncResult?.git?.branch,
      commit: syncResult?.git?.commit,
      filesRead: syncResult?.filesRead,
    },
  });
  return existingProjects.map((project) => (project.id === projectId ? synced : project));
}

export function createProjectBackup(projects = []) {
  return JSON.stringify(
    {
      schemaVersion: PROJECT_SCHEMA_VERSION,
      exportedAt: localIsoTimestamp(),
      projects,
    },
    null,
    2,
  );
}

function validateImportedProject(project, index) {
  const rawErrors = validateProjectDraft({
    ...EMPTY_PROJECT_DRAFT,
    name: project?.name,
    short: project?.short,
    milestone: project?.milestone,
    status: project?.status,
    progress: project?.progress,
    repositoryUrl: project?.repositoryUrl ?? "",
    documentationPath: project?.documentationPath ?? "",
    demoUrl: project?.demoUrl ?? "",
  });
  if (!cleanText(project?.id) || Object.keys(rawErrors).length) {
    throw new Error(`备份中的第 ${index + 1} 个项目字段无效。`);
  }
  const normalized = normalizeProject(project, index);
  return normalized;
}

export function importProjectBackup(raw, existingProjects = [], mode = "merge") {
  if (mode !== "merge" && mode !== "replace") throw new Error("导入模式无效。");
  let payload;
  try {
    payload = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    throw new Error("JSON 文件格式无效。");
  }
  if (payload?.schemaVersion !== PROJECT_SCHEMA_VERSION || !Array.isArray(payload.projects)) {
    throw new Error("备份版本或项目结构不受支持。");
  }

  const imported = payload.projects.map(validateImportedProject);
  const importedIds = new Set();
  imported.forEach((project) => {
    if (importedIds.has(project.id)) throw new Error(`备份中存在重复项目 ID：${project.id}`);
    importedIds.add(project.id);
  });

  if (mode === "replace") {
    return {
      projects: imported,
      importedCount: imported.length,
      reassignedIds: 0,
      idMap: Object.fromEntries(imported.map((project) => [project.id, project.id])),
    };
  }

  const merged = [...existingProjects];
  let reassignedIds = 0;
  const idMap = {};
  imported.forEach((project) => {
    if (merged.some((current) => current.id === project.id)) {
      const duplicate = createProjectRecord(projectToDraft(project), merged);
      merged.push(normalizeProject({ ...duplicate, updatedAt: project.updatedAt }));
      idMap[project.id] = duplicate.id;
      reassignedIds += 1;
    } else {
      merged.push(project);
      idMap[project.id] = project.id;
    }
  });
  return { projects: merged, importedCount: imported.length, reassignedIds, idMap };
}

export function loadProjectStore(storage = getAppStorage()) {
  if (!storage) return { projects: [], error: null };
  const raw = storage.getItem(PROJECT_STORAGE_KEY);
  if (!raw) return { projects: [], error: null };

  try {
    const payload = JSON.parse(raw);
    if (payload.schemaVersion !== PROJECT_SCHEMA_VERSION || !Array.isArray(payload.projects)) {
      throw new Error("unsupported-project-schema");
    }
    return { projects: payload.projects.map(normalizeProject), error: null };
  } catch {
    return {
      projects: [],
      error: "本地项目数据无法读取，已安全回退为空状态。原数据没有被覆盖。",
    };
  }
}

export function saveProjectStore(projects, storage = getAppStorage()) {
  if (!storage) throw new Error("当前浏览器不支持本地存储。");
  storage.setItem(
    PROJECT_STORAGE_KEY,
    JSON.stringify({ schemaVersion: PROJECT_SCHEMA_VERSION, projects }),
  );
}

export function summarizeProjects(projectList = []) {
  return projectList.reduce(
    (summary, project) => {
      summary.total += 1;
      if (Object.hasOwn(summary, project.status)) summary[project.status] += 1;
      return summary;
    },
    {
      total: 0,
      [PROJECT_STATUSES.PLANNING]: 0,
      [PROJECT_STATUSES.ACTIVE]: 0,
      [PROJECT_STATUSES.PAUSED]: 0,
      [PROJECT_STATUSES.DONE]: 0,
    },
  );
}

export function findProjectById(projectList = [], projectId = "") {
  return projectList.find((project) => project.id === projectId) ?? null;
}

export function sortProjectsByUpdatedAt(projectList = []) {
  return [...projectList].sort(
    (left, right) =>
      Number(Boolean(right.pinned)) - Number(Boolean(left.pinned)) ||
      right.updatedTimestamp - left.updatedTimestamp ||
      left.id.localeCompare(right.id),
  );
}

export function createResearchNotes(projectList = []) {
  return projectList
    .flatMap((project) =>
      (Array.isArray(project.log) ? project.log : []).map((content, logIndex) => ({
        id: `${project.id}:note:${logIndex}`,
        projectId: project.id,
        projectName: project.name,
        projectStatus: project.status,
        statusLabel: project.statusLabel,
        statusTone: project.statusTone,
        content,
        logIndex,
        updatedAt: project.updatedAt,
        updatedTimestamp: project.updatedTimestamp,
        updated: project.updated,
        updatedTime: project.updatedTime,
      })),
    )
    .filter((note) => cleanText(note.content))
    .sort(
      (left, right) =>
        right.updatedTimestamp - left.updatedTimestamp ||
        left.projectId.localeCompare(right.projectId) ||
        left.logIndex - right.logIndex,
    );
}

// Development fixtures are intentionally empty. The product starts with no user projects.
export const projectFixtures = Object.freeze([]);
