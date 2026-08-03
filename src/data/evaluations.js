import { getAppStorage } from "./filePersistence.js";

// TODO-065：Agent 评测结果追踪。
// 评测数据使用独立分类存储（见 fileDatasets.js 的 evaluations 条目），
// 随完整 JSON 备份导出/恢复；旧项目无评测数据时安全迁移为空。
export const EVALUATION_SCHEMA_VERSION = 1;
export const EVALUATION_STORAGE_KEY = "agent-project-showcase.evaluations.v1";

export const EMPTY_EVALUATION_DRAFT = Object.freeze({
  metric: "",
  value: "",
  evaluatedAt: "",
  note: "",
});

const MAX_METRIC_LENGTH = 120;
const MAX_NOTE_LENGTH = 500;

function cleanText(value, maximum = 0) {
  const text = typeof value === "string" ? value.trim() : String(value ?? "").trim();
  return maximum > 0 ? text.slice(0, maximum) : text;
}

function localIsoTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  const milliseconds = String(date.getMilliseconds()).padStart(3, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${milliseconds}${sign}${pad(Math.floor(absoluteOffset / 60))}:${pad(absoluteOffset % 60)}`;
}

function localDateInput(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function createEvaluationId(existingEvaluations = []) {
  const ids = new Set(existingEvaluations.map((item) => item.id));
  let id;
  do {
    id =
      globalThis.crypto?.randomUUID?.() ??
      `eval-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  } while (ids.has(id));
  return id;
}

// 解析数值用于趋势图：支持“92.3”“1.2s”“~$0.012/次”“85%”等带前缀/后缀的字符串。
// 提取首个浮点数；无法解析时返回 null（图表跳过该点，但记录仍保留）。
function parseMetricValue(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const text = String(raw).trim();
  if (!text) return null;
  // 匹配可能带符号、千分位逗号、科学计数法的数值（含可选百分号、单位）
  const match = text.match(/-?\d[\d,]*\.?\d*(?:e[+-]?\d+)?/i);
  if (!match) return null;
  const normalized = match[0].replace(/,/g, "");
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

export function validateEvaluationDraft(draft, projects = []) {
  const errors = {};
  const projectId = cleanText(draft?.projectId);
  const metric = cleanText(draft?.metric, MAX_METRIC_LENGTH);
  const value = cleanText(draft?.value, MAX_NOTE_LENGTH);

  if (!projectId) {
    errors.projectId = "请选择评测所属项目。";
  } else if (!projects.some((project) => project.id === projectId)) {
    errors.projectId = "所选项目不存在，请重新选择。";
  }
  if (!metric) errors.metric = "请输入指标名（如准确率、延迟、成本）。";
  if (!value) errors.value = "请输入指标数值。";
  return errors;
}

export function normalizeEvaluation(evaluation, index = 0) {
  const id = cleanText(evaluation?.id, 100);
  const projectId = cleanText(evaluation?.projectId, 100);
  const metric = cleanText(evaluation?.metric, MAX_METRIC_LENGTH);
  const rawValue = cleanText(evaluation?.value, MAX_NOTE_LENGTH);
  const evaluatedAt = cleanText(evaluation?.evaluatedAt, 50);
  const note = cleanText(evaluation?.note, MAX_NOTE_LENGTH);
  const createdAt = cleanText(evaluation?.createdAt, 50);

  if (!id || !projectId || !metric || !rawValue) {
    throw new Error(`评测结果第 ${index + 1} 项缺少必要字段。`);
  }
  const evaluatedTimestamp = Date.parse(evaluatedAt);
  const createdTimestamp = Date.parse(createdAt);
  if (!Number.isFinite(evaluatedTimestamp) || !Number.isFinite(createdTimestamp)) {
    throw new Error(`评测结果第 ${index + 1} 项时间戳无效。`);
  }

  return Object.freeze({
    id,
    projectId,
    metric,
    value: rawValue,
    numericValue: parseMetricValue(rawValue),
    evaluatedAt,
    evaluatedTimestamp,
    evaluated: evaluatedAt.slice(0, 10),
    note,
    createdAt,
    createdTimestamp,
  });
}

export function createEvaluationRecord(
  draft,
  existingEvaluations = [],
  projects = [],
  date = new Date(),
) {
  const errors = validateEvaluationDraft(draft, projects);
  if (Object.keys(errors).length) {
    const error = new Error("评测结果表单校验失败。");
    error.fields = errors;
    throw error;
  }
  const evaluatedAtInput = cleanText(draft.evaluatedAt);
  const evaluatedAt = evaluatedAtInput
    ? `${evaluatedAtInput}T00:00:00.000${localTimeOffset(date)}`
    : localIsoTimestamp(date);
  return normalizeEvaluation({
    id: createEvaluationId(existingEvaluations),
    projectId: cleanText(draft.projectId),
    metric: cleanText(draft.metric, MAX_METRIC_LENGTH),
    value: cleanText(draft.value, MAX_NOTE_LENGTH),
    evaluatedAt,
    note: cleanText(draft.note, MAX_NOTE_LENGTH),
    createdAt: localIsoTimestamp(date),
  });
}

function localTimeOffset(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  return `${sign}${pad(Math.floor(absoluteOffset / 60))}:${pad(absoluteOffset % 60)}`;
}

export function updateEvaluationRecord(
  evaluationId,
  draft,
  existingEvaluations = [],
  projects = [],
  date = new Date(),
) {
  const current = existingEvaluations.find((item) => item.id === evaluationId);
  if (!current) throw new Error("找不到需要编辑的评测结果。");
  const errors = validateEvaluationDraft(draft, projects);
  if (Object.keys(errors).length) {
    const error = new Error("评测结果表单校验失败。");
    error.fields = errors;
    throw error;
  }
  const evaluatedAtInput = cleanText(draft.evaluatedAt);
  const evaluatedAt = evaluatedAtInput
    ? `${evaluatedAtInput}T00:00:00.000${localTimeOffset(date)}`
    : current.evaluatedAt;
  return normalizeEvaluation({
    ...current,
    projectId: cleanText(draft.projectId),
    metric: cleanText(draft.metric, MAX_METRIC_LENGTH),
    value: cleanText(draft.value, MAX_NOTE_LENGTH),
    evaluatedAt,
    note: cleanText(draft.note, MAX_NOTE_LENGTH),
  });
}

export function deleteEvaluationRecord(evaluationId, existingEvaluations = []) {
  if (!existingEvaluations.some((item) => item.id === evaluationId)) {
    throw new Error("找不到需要删除的评测结果。");
  }
  return existingEvaluations.filter((item) => item.id !== evaluationId);
}

export function deleteEvaluationsForProject(projectId, existingEvaluations = []) {
  return existingEvaluations.filter((item) => item.projectId !== projectId);
}

// 按评测时间升序排序，便于趋势图横轴递进；同时间按 id 稳定排序。
export function sortEvaluations(evaluations = []) {
  return [...evaluations].sort(
    (left, right) =>
      left.evaluatedTimestamp - right.evaluatedTimestamp || left.id.localeCompare(right.id),
  );
}

export function selectProjectEvaluations(evaluations = [], projectId = "") {
  return sortEvaluations(evaluations.filter((item) => item.projectId === projectId));
}

// 按指标名分组并保留时间序列，用于趋势图按指标绘制独立折线。
export function groupEvaluationsByMetric(evaluations = []) {
  const groups = new Map();
  for (const item of sortEvaluations(evaluations)) {
    if (!groups.has(item.metric)) groups.set(item.metric, []);
    groups.get(item.metric).push(item);
  }
  return [...groups.entries()].map(([metric, items]) => ({ metric, items }));
}

// 从 JSON 文件导入评测结果。文件结构：{ schemaVersion, evaluations: [...] }
// projectIdMap 用于把备份中的旧项目 ID 映射到当前环境的新 ID（合并导入时）。
export function importEvaluationBackup(
  raw,
  existingEvaluations = [],
  projects = [],
  mode = "merge",
  projectIdMap = {},
) {
  let payload;
  try {
    payload = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    throw new Error("评测结果 JSON 文件格式无效。");
  }
  if (payload?.schemaVersion !== EVALUATION_SCHEMA_VERSION || !Array.isArray(payload.evaluations)) {
    throw new Error("评测结果备份版本或结构不受支持。");
  }
  const projectIds = new Set(projects.map((project) => project.id));
  const imported = payload.evaluations.map((entry, index) => {
    const mappedProjectId = projectIdMap[entry.projectId] ?? entry.projectId ?? "";
    if (!projectIds.has(mappedProjectId)) {
      throw new Error(`评测结果第 ${index + 1} 项关联的项目不存在。`);
    }
    return normalizeEvaluation({ ...entry, projectId: mappedProjectId });
  });
  const importedIds = new Set();
  imported.forEach((item) => {
    if (importedIds.has(item.id)) {
      throw new Error(`备份中存在重复评测结果 ID：${item.id}`);
    }
    importedIds.add(item.id);
  });

  const evaluations = mode === "replace" ? [] : [...existingEvaluations];
  const existingIds = new Set(evaluations.map((item) => item.id));
  let reassignedIds = 0;
  imported.forEach((item) => {
    if (existingIds.has(item.id)) {
      const regenerated = createEvaluationRecord(
        {
          projectId: item.projectId,
          metric: item.metric,
          value: item.value,
          evaluatedAt: item.evaluated,
          note: item.note,
        },
        evaluations,
        projects,
      );
      evaluations.push(regenerated);
      existingIds.add(regenerated.id);
      reassignedIds += 1;
    } else {
      evaluations.push(item);
      existingIds.add(item.id);
    }
  });
  return {
    evaluations,
    importedCount: imported.length,
    reassignedIds,
  };
}

export function loadEvaluationStore(storage = getAppStorage()) {
  if (!storage) return { evaluations: [], error: null };
  const raw = storage.getItem(EVALUATION_STORAGE_KEY);
  if (!raw) return { evaluations: [], error: null };
  try {
    const payload = JSON.parse(raw);
    if (
      payload.schemaVersion !== EVALUATION_SCHEMA_VERSION ||
      !Array.isArray(payload.evaluations)
    ) {
      throw new Error("unsupported-evaluation-schema");
    }
    return { evaluations: payload.evaluations.map(normalizeEvaluation), error: null };
  } catch {
    return {
      evaluations: [],
      error: "本地评测结果无法读取，已安全回退为空状态。原数据没有被覆盖。",
    };
  }
}

export function saveEvaluationStore(evaluations, storage = getAppStorage()) {
  if (!storage) throw new Error("当前浏览器不支持本地存储。");
  storage.setItem(
    EVALUATION_STORAGE_KEY,
    JSON.stringify({ schemaVersion: EVALUATION_SCHEMA_VERSION, evaluations }),
  );
}

export function createEvaluationInputDate(date = new Date()) {
  return localDateInput(date);
}
