import { analyzeLocalDirectory, MAX_LOCAL_TOTAL_BYTES } from "./localStatus.js";
import { createProjectImportDraft, IMPORT_FIELD_STATUS } from "./projectImport.js";
import { EMPTY_PROJECT_DRAFT, PROJECT_STATUSES, createProjectRecord } from "./projects.js";

export const MAX_BATCH_DIRECTORIES = 20;
export const MAX_BATCH_TOTAL_BYTES = 16 * 1024 * 1024;
export const MAX_BATCH_RECORDS = 100;

const BATCH_CSV_COLUMNS = [
  "name",
  "short",
  "description",
  "status",
  "progress",
  "milestone",
  "repositoryUrl",
  "localPath",
  "documentationPath",
  "demoUrl",
  "previewPath",
  "languagesText",
  "frameworksText",
  "modelsText",
  "dataSourcesText",
  "runCommand",
  "tagsText",
];

const STATUS_ALIASES = new Map([
  ["planning", PROJECT_STATUSES.PLANNING],
  ["planned", PROJECT_STATUSES.PLANNING],
  ["active", PROJECT_STATUSES.ACTIVE],
  ["developing", PROJECT_STATUSES.ACTIVE],
  ["paused", PROJECT_STATUSES.PAUSED],
  ["done", PROJECT_STATUSES.DONE],
  ["completed", PROJECT_STATUSES.DONE],
]);

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toTextList(value) {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean).join(", ");
  return cleanText(value);
}

function normalizeStatus(value) {
  const key = cleanText(value).toLowerCase();
  return STATUS_ALIASES.get(key) ?? (Object.values(PROJECT_STATUSES).includes(key) ? key : "");
}

function fieldState(value) {
  if (Array.isArray(value)) {
    return value.length ? IMPORT_FIELD_STATUS.DETECTED : IMPORT_FIELD_STATUS.MISSING;
  }
  return (typeof value === "number" && Number.isFinite(value)) || cleanText(value)
    ? IMPORT_FIELD_STATUS.DETECTED
    : IMPORT_FIELD_STATUS.MISSING;
}

export function suggestUniqueName(name, existingProjects = [], index = 0) {
  const base = cleanText(name) || "未命名项目";
  const existingNames = new Set(
    existingProjects.map((project) => cleanText(project.name).toLocaleLowerCase()),
  );
  if (!existingNames.has(base.toLocaleLowerCase())) return base;
  const candidate = `${base} (${index + 1})`;
  if (!existingNames.has(candidate.toLocaleLowerCase())) return candidate;
  return suggestUniqueName(base, existingProjects, index + 1);
}

/**
 * 扫描父目录下的子项目目录，批量生成草稿。
 * 沿用显式授权与白名单读取边界，每个子目录复用 analyzeLocalDirectory，
 * 并在跨目录层面限制总读取量。
 */
export async function scanParentDirectory(
  parentHandle,
  existingProjects = [],
  { now = new Date() } = {},
) {
  if (!parentHandle?.values) {
    throw new Error("未获得可读取的父目录。");
  }
  const subdirectories = [];
  for await (const entry of parentHandle.values()) {
    if (entry.kind === "directory") {
      subdirectories.push(entry);
    }
  }
  if (!subdirectories.length) {
    throw new Error("所选父目录下没有子目录，无法批量扫描。");
  }
  if (subdirectories.length > MAX_BATCH_DIRECTORIES) {
    throw new Error(
      `批量扫描最多支持 ${MAX_BATCH_DIRECTORIES} 个子目录，当前共有 ${subdirectories.length} 个。`,
    );
  }

  const results = [];
  const errors = [];
  let totalBytes = 0;
  for (const subdirectory of subdirectories) {
    try {
      if (totalBytes >= MAX_BATCH_TOTAL_BYTES) {
        errors.push({
          sourceName: subdirectory.name,
          message: `批量读取总量已达上限（${MAX_BATCH_TOTAL_BYTES / 1024 / 1024} MB），已跳过。`,
        });
        continue;
      }
      const result = await analyzeLocalDirectory(subdirectory);
      totalBytes += Number(result.bytesRead ?? 0);
      const draft = createProjectImportDraft(result, existingProjects, now);
      results.push({
        key: `${subdirectory.name}-${results.length}`,
        sourceName: subdirectory.name,
        draft: draft.draft,
        fieldStatus: draft.fieldStatus,
        duplicateName: draft.duplicateName,
        suggestedName: draft.duplicateName
          ? suggestUniqueName(draft.draft.name, existingProjects)
          : "",
        notes: draft.notes,
        sourceMetadata: draft.sourceMetadata,
        error: null,
      });
    } catch (error) {
      errors.push({
        sourceName: subdirectory.name,
        message: error.message || "无法读取子目录。",
      });
    }
  }
  return { results, errors, totalBytes };
}

function splitCsvLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (inQuotes) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

export function parseBatchCsvText(text, fileName = "批量导入.csv") {
  const raw = cleanText(text);
  if (!raw) throw new Error(`${fileName} 没有可解析的内容。`);
  const lines = raw.split(/\r?\n/).filter((line) => cleanText(line));
  if (lines.length < 2) {
    throw new Error(`${fileName} 至少需要表头与一条数据。`);
  }
  const headers = splitCsvLine(lines[0]).map((header) => cleanText(header).toLowerCase());
  const unknown = headers.filter((header) => header && !BATCH_CSV_COLUMNS.includes(header));
  if (unknown.length) {
    throw new Error(`${fileName} 包含不支持的列：${unknown.join("、")}。`);
  }
  const records = [];
  for (let index = 1; index < lines.length; index += 1) {
    const values = splitCsvLine(lines[index]);
    const record = {};
    headers.forEach((header, position) => {
      if (header) record[header] = cleanText(values[position] ?? "");
    });
    records.push(record);
  }
  if (records.length > MAX_BATCH_RECORDS) {
    throw new Error(
      `${fileName} 包含 ${records.length} 条记录，超过 ${MAX_BATCH_RECORDS} 条上限。`,
    );
  }
  return { records, sourceName: fileName };
}

export function parseBatchJsonText(text, fileName = "批量导入.json") {
  let payload;
  try {
    payload = JSON.parse(cleanText(text) || "[]");
  } catch {
    throw new Error(`${fileName} 不是有效的 JSON 文件。`);
  }
  const records = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.projects)
      ? payload.projects
      : null;
  if (!records) {
    throw new Error(`${fileName} 应为对象数组或包含 projects 数组。`);
  }
  if (records.length > MAX_BATCH_RECORDS) {
    throw new Error(
      `${fileName} 包含 ${records.length} 条记录，超过 ${MAX_BATCH_RECORDS} 条上限。`,
    );
  }
  return { records, sourceName: fileName };
}

function buildDraftFromRecord(record, existingProjects, sourceType, sourceName, now) {
  const status = normalizeStatus(record.status);
  const progressNumber = Number(record.progress);
  const draft = {
    ...EMPTY_PROJECT_DRAFT,
    name: cleanText(record.name),
    short: cleanText(record.short),
    description: cleanText(record.description),
    status: status || PROJECT_STATUSES.PLANNING,
    progress: Number.isFinite(progressNumber) ? String(progressNumber) : "0",
    milestone: cleanText(record.milestone),
    repositoryUrl: cleanText(record.repositoryUrl),
    localPath: cleanText(record.localPath),
    documentationPath: cleanText(record.documentationPath),
    demoUrl: cleanText(record.demoUrl),
    previewPath: cleanText(record.previewPath),
    languagesText: toTextList(record.languagesText ?? record.languages),
    frameworksText: toTextList(record.frameworksText ?? record.frameworks),
    modelsText: toTextList(record.modelsText ?? record.models),
    dataSourcesText: toTextList(record.dataSourcesText ?? record.dataSources),
    runCommand: cleanText(record.runCommand),
    tagsText: toTextList(record.tagsText ?? record.tags),
    logText: `从批量导入创建：${sourceName}`,
  };
  const name = cleanText(draft.name);
  const duplicateName = existingProjects.some(
    (project) => cleanText(project.name).toLocaleLowerCase() === name.toLocaleLowerCase(),
  );
  const fieldStatus = {
    name: fieldState(name),
    short: fieldState(draft.short),
    description: fieldState(draft.description),
    status: fieldState(status),
    progress: fieldState(progressNumber),
    milestone: fieldState(draft.milestone),
    repositoryUrl: fieldState(draft.repositoryUrl),
    blockersText: IMPORT_FIELD_STATUS.MISSING,
    nextTasksText: IMPORT_FIELD_STATUS.MISSING,
    languagesText: fieldState(draft.languagesText),
    frameworksText: fieldState(draft.frameworksText),
    modelsText: fieldState(draft.modelsText),
    dataSourcesText: fieldState(draft.dataSourcesText),
    runCommand: fieldState(draft.runCommand),
  };
  return {
    draft,
    fieldStatus,
    duplicateName,
    suggestedName: duplicateName ? suggestUniqueName(name, existingProjects) : "",
    notes: [`从 ${sourceType.toUpperCase()} 记录读取：${sourceName}`],
    sourceMetadata: {
      sourceType,
      sourceName,
      syncedAt: now.toISOString(),
      branch: "",
      commit: "",
      filesRead: [sourceName],
    },
  };
}

export function buildBatchDrafts(
  records,
  existingProjects = [],
  { sourceType, sourceName, now = new Date() } = {},
) {
  if (!Array.isArray(records) || !records.length) {
    throw new Error("没有可用于生成草稿的记录。");
  }
  const items = [];
  const errors = [];
  records.forEach((record, index) => {
    const key = `${sourceType}-${index}`;
    try {
      let entry;
      if (sourceType === "directory") {
        const draft = createProjectImportDraft(record, existingProjects, now);
        entry = {
          key,
          sourceName: draft.sourceMetadata.sourceName,
          draft: draft.draft,
          fieldStatus: draft.fieldStatus,
          duplicateName: draft.duplicateName,
          suggestedName: draft.duplicateName
            ? suggestUniqueName(draft.draft.name, existingProjects)
            : "",
          notes: draft.notes,
          sourceMetadata: draft.sourceMetadata,
          error: null,
        };
      } else {
        const built = buildDraftFromRecord(record, existingProjects, sourceType, sourceName, now);
        entry = { key, sourceName, ...built, error: null };
      }
      items.push(entry);
    } catch (error) {
      errors.push({
        key,
        sourceName: cleanText(record?.name) || `第 ${index + 1} 条`,
        message: error.message || "无法生成草稿。",
      });
    }
  });
  return { items, errors };
}

/**
 * 批量创建项目，部分失败不影响已成功项。
 * 每次成功后把新项目加入 existingProjects，避免后续草稿产生 ID 冲突。
 */
export function createProjectsBatch(drafts, selectedKeys, existingProjects = []) {
  const selected = new Set(selectedKeys);
  const created = [];
  const failed = [];
  let nextProjects = [...existingProjects];
  for (const item of drafts) {
    if (!selected.has(item.key)) continue;
    try {
      const record = createProjectRecord(item.draft, nextProjects, item.sourceMetadata ?? null);
      nextProjects.push(record);
      created.push(record);
    } catch (error) {
      const fields = error.fields ? Object.values(error.fields).join("；") : "";
      failed.push({
        key: item.key,
        sourceName: item.sourceName || item.draft?.name || "未命名",
        message: fields || error.message || "项目创建失败。",
      });
    }
  }
  return { created, failed, nextProjects };
}

export { MAX_LOCAL_TOTAL_BYTES };
