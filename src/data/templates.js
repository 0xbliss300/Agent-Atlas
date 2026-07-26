import { EMPTY_PROJECT_DRAFT, projectToDraft } from "./projects.js";
import { getAppStorage } from "./filePersistence.js";

export const TEMPLATE_SCHEMA_VERSION = 1;
export const TEMPLATE_STORAGE_KEY = "agent-project-showcase.templates.v1";

export const TEMPLATE_TYPES = Object.freeze({
  PROJECT: "project",
  NOTE: "note",
});

const PROJECT_TEMPLATE_FIELDS = Object.freeze([
  "short",
  "description",
  "iconKey",
  "featuresText",
  "roadmapText",
  "blockersText",
  "nextTasksText",
  "languagesText",
  "frameworksText",
  "modelsText",
  "dataSourcesText",
  "runCommand",
]);

const PROJECT_EXTRA_FIELD_GROUPS = Object.freeze({
  statusProgress: ["status", "progress"],
  milestone: ["milestone"],
  log: ["logText"],
  localPath: ["localPath"],
  resources: ["repositoryUrl", "documentationPath", "demoUrl", "previewPath"],
});

const BUILTIN_PROJECT_TEMPLATES = Object.freeze([
  {
    id: "builtin-project-blank",
    type: TEMPLATE_TYPES.PROJECT,
    name: "空白项目",
    description: "从完全空白的项目表单开始。",
    builtin: true,
    content: {},
  },
  {
    id: "builtin-project-agent",
    type: TEMPLATE_TYPES.PROJECT,
    name: "Agent 项目",
    description: "预置目标、能力、评测与安全边界结构。",
    builtin: true,
    content: {
      iconKey: "showcase",
      description:
        "## 项目目标\n[说明 Agent 要解决的问题和目标用户]\n\n## 工作边界\n[说明输入、输出、工具权限与人工确认点]\n\n## 成功标准\n[填写可验证的质量、成本或时延指标]",
      featuresText:
        "核心任务流程 | 规划中\n工具与数据访问 | 规划中\n错误恢复与人工确认 | 规划中\n质量评测 | 规划中",
      roadmapText:
        "需求与边界 | 明确任务、权限和成功标准 | current\n最小闭环 | 打通输入、推理、工具和输出 | next\n可靠性 | 增加评测、恢复与观测 | next",
      blockersText: "- [ ] [记录当前阻塞项，没有时删除本行]",
      nextTasksText:
        "- [ ] 明确输入、输出与成功标准\n- [ ] 列出工具权限和人工确认点\n- [ ] 设计最小可验证闭环",
    },
  },
  {
    id: "builtin-project-research",
    type: TEMPLATE_TYPES.PROJECT,
    name: "研究项目",
    description: "预置研究问题、证据、实验和结论结构。",
    builtin: true,
    content: {
      iconKey: "auralis",
      description:
        "## 研究问题\n[填写需要回答的核心问题]\n\n## 假设与范围\n[记录假设、边界和不研究的内容]\n\n## 证据标准\n[说明资料来源、实验方法和判断标准]",
      featuresText: "资料收集与筛选 | 规划中\n实验与证据记录 | 规划中\n结论与限制 | 规划中",
      roadmapText:
        "问题定义 | 明确问题、范围与证据标准 | current\n资料与实验 | 收集证据并验证假设 | next\n综合结论 | 汇总结论、限制与后续问题 | next",
      blockersText: "- [ ] [记录缺失资料、实验条件或待确认假设]",
      nextTasksText:
        "- [ ] 写出可验证的研究问题\n- [ ] 定义资料纳入与排除标准\n- [ ] 设计第一轮资料收集或实验",
    },
  },
  {
    id: "builtin-project-automation",
    type: TEMPLATE_TYPES.PROJECT,
    name: "自动化项目",
    description: "预置触发、处理、异常与人工接管结构。",
    builtin: true,
    content: {
      iconKey: "presentation",
      description:
        "## 自动化目标\n[说明要减少的重复工作]\n\n## 触发与输入\n[记录触发条件、输入来源和前置检查]\n\n## 输出与接管\n[说明产物、失败处理和人工接管条件]",
      featuresText:
        "触发与输入校验 | 规划中\n核心处理流程 | 规划中\n失败重试与人工接管 | 规划中\n运行记录与告警 | 规划中",
      roadmapText:
        "流程梳理 | 标注触发、输入、决策和输出 | current\n安全试运行 | 使用可回滚的小范围数据验证 | next\n稳定运行 | 增加监控、重试与人工接管 | next",
      blockersText: "- [ ] [记录权限、数据质量或外部依赖问题]",
      nextTasksText:
        "- [ ] 画出当前人工流程\n- [ ] 标注不可自动执行的决策点\n- [ ] 定义失败、回滚和人工接管策略",
    },
  },
]);

const BUILTIN_NOTE_TEMPLATES = Object.freeze([
  {
    id: "builtin-note-blank",
    type: TEMPLATE_TYPES.NOTE,
    name: "空白笔记",
    description: "从空白 Markdown 正文开始。",
    builtin: true,
    content: { title: "", body: "" },
  },
  {
    id: "builtin-note-experiment",
    type: TEMPLATE_TYPES.NOTE,
    name: "实验记录",
    description: "记录假设、配置、步骤、观察和结论。",
    builtin: true,
    content: {
      title: "",
      body: "# 实验主题\n\n## 目标与假设\n\n## 环境与配置\n\n## 步骤\n\n1. \n\n## 观察与结果\n\n## 结论与下一步\n",
    },
  },
  {
    id: "builtin-note-research",
    type: TEMPLATE_TYPES.NOTE,
    name: "技术调研",
    description: "比较候选方案、证据、限制和建议。",
    builtin: true,
    content: {
      title: "",
      body: "# 调研主题\n\n## 问题与范围\n\n## 评估标准\n\n## 候选方案\n\n| 方案 | 优点 | 限制 | 证据 |\n| --- | --- | --- | --- |\n|  |  |  |  |\n\n## 建议\n\n## 未决问题\n",
    },
  },
  {
    id: "builtin-note-decision",
    type: TEMPLATE_TYPES.NOTE,
    name: "决策记录",
    description: "记录背景、选项、决定和后果。",
    builtin: true,
    content: {
      title: "",
      body: "# 决策主题\n\n## 状态\n\n提议中\n\n## 背景\n\n## 考虑过的方案\n\n## 决定\n\n## 理由与证据\n\n## 后果与复查日期\n",
    },
  },
  {
    id: "builtin-note-retrospective",
    type: TEMPLATE_TYPES.NOTE,
    name: "复盘",
    description: "回顾目标、结果、经验和行动项。",
    builtin: true,
    content: {
      title: "",
      body: "# 复盘主题\n\n## 原目标\n\n## 实际结果\n\n## 做得好的地方\n\n## 可以改进的地方\n\n## 根因与经验\n\n## 行动项\n\n- [ ] \n",
    },
  },
]);

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function createTemplateId(type, templates = []) {
  const existingIds = new Set(templates.map((template) => template.id));
  let id;
  do {
    id =
      globalThis.crypto?.randomUUID?.() ??
      `${type}-template-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  } while (existingIds.has(id));
  return id;
}

function localIsoTimestamp(date = new Date()) {
  return date.toISOString();
}

function cloneTemplate(template) {
  return {
    ...template,
    content: { ...template.content },
    includedFields: [...(template.includedFields ?? [])],
  };
}

export function getBuiltinProjectTemplates() {
  return BUILTIN_PROJECT_TEMPLATES.map(cloneTemplate);
}

export function getBuiltinNoteTemplates() {
  return BUILTIN_NOTE_TEMPLATES.map(cloneTemplate);
}

export function getTemplatesByType(customTemplates = [], type) {
  const builtins =
    type === TEMPLATE_TYPES.PROJECT ? getBuiltinProjectTemplates() : getBuiltinNoteTemplates();
  return [
    ...builtins,
    ...customTemplates
      .filter((template) => template.type === type)
      .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name))
      .map(cloneTemplate),
  ];
}

function assertUniqueName(name, type, templates, ignoreId = "") {
  const normalizedName = cleanText(name);
  if (!normalizedName) throw new Error("请输入模板名称。");
  const all = [
    ...(type === TEMPLATE_TYPES.PROJECT ? BUILTIN_PROJECT_TEMPLATES : BUILTIN_NOTE_TEMPLATES),
    ...templates,
  ];
  if (
    all.some(
      (template) =>
        template.type === type &&
        template.id !== ignoreId &&
        template.name.localeCompare(normalizedName, "zh-CN", { sensitivity: "accent" }) === 0,
    )
  ) {
    throw new Error(`已存在名为“${normalizedName}”的模板。`);
  }
  return normalizedName;
}

function projectSourceToDraft(source) {
  return source?.technology || Array.isArray(source?.features)
    ? projectToDraft(source)
    : { ...EMPTY_PROJECT_DRAFT, ...source };
}

export function createCustomProjectTemplate(
  name,
  source,
  templates = [],
  extraFields = {},
  date = new Date(),
) {
  const templateName = assertUniqueName(name, TEMPLATE_TYPES.PROJECT, templates);
  const draft = projectSourceToDraft(source);
  const includedFields = [...PROJECT_TEMPLATE_FIELDS];
  Object.entries(PROJECT_EXTRA_FIELD_GROUPS).forEach(([group, fields]) => {
    if (extraFields[group]) includedFields.push(...fields);
  });
  const content = Object.fromEntries(
    includedFields.map((field) => [field, String(draft[field] ?? "")]),
  );
  const typeTemplates = templates.filter((template) => template.type === TEMPLATE_TYPES.PROJECT);
  return {
    id: createTemplateId(TEMPLATE_TYPES.PROJECT, templates),
    type: TEMPLATE_TYPES.PROJECT,
    name: templateName,
    description: "自定义项目结构",
    builtin: false,
    order: typeTemplates.length,
    content,
    includedFields,
    createdAt: localIsoTimestamp(date),
    updatedAt: localIsoTimestamp(date),
  };
}

export function createCustomNoteTemplate(name, draft, templates = [], date = new Date()) {
  const templateName = assertUniqueName(name, TEMPLATE_TYPES.NOTE, templates);
  const typeTemplates = templates.filter((template) => template.type === TEMPLATE_TYPES.NOTE);
  return {
    id: createTemplateId(TEMPLATE_TYPES.NOTE, templates),
    type: TEMPLATE_TYPES.NOTE,
    name: templateName,
    description: "自定义 Markdown 大纲",
    builtin: false,
    order: typeTemplates.length,
    content: {
      title: cleanText(draft?.title),
      body: String(draft?.body ?? "").trim(),
    },
    includedFields: ["title", "body"],
    createdAt: localIsoTimestamp(date),
    updatedAt: localIsoTimestamp(date),
  };
}

export function applyProjectTemplate(template, currentDraft = EMPTY_PROJECT_DRAFT) {
  if (!template || template.type !== TEMPLATE_TYPES.PROJECT) {
    throw new Error("请选择有效的项目模板。");
  }
  return {
    ...EMPTY_PROJECT_DRAFT,
    name: cleanText(currentDraft?.name),
    ...template.content,
  };
}

export function applyNoteTemplate(template, currentDraft = {}) {
  if (!template || template.type !== TEMPLATE_TYPES.NOTE) {
    throw new Error("请选择有效的研究笔记模板。");
  }
  return {
    projectId: cleanText(currentDraft?.projectId),
    title: String(template.content.title ?? ""),
    body: String(template.content.body ?? ""),
  };
}

export function renameCustomTemplate(templateId, name, templates = [], date = new Date()) {
  const current = templates.find((template) => template.id === templateId);
  if (!current) throw new Error("找不到需要重命名的自定义模板。");
  const nextName = assertUniqueName(name, current.type, templates, current.id);
  return templates.map((template) =>
    template.id === templateId
      ? { ...template, name: nextName, updatedAt: localIsoTimestamp(date) }
      : template,
  );
}

function uniqueCopyName(source, templates) {
  let index = 1;
  let candidate = `${source.name}（副本）`;
  const names = new Set(
    [
      ...(source.type === TEMPLATE_TYPES.PROJECT
        ? BUILTIN_PROJECT_TEMPLATES
        : BUILTIN_NOTE_TEMPLATES),
      ...templates,
    ]
      .filter((template) => template.type === source.type)
      .map((template) => template.name.toLocaleLowerCase("zh-CN")),
  );
  while (names.has(candidate.toLocaleLowerCase("zh-CN"))) {
    index += 1;
    candidate = `${source.name}（副本 ${index}）`;
  }
  return candidate;
}

export function duplicateCustomTemplate(templateId, templates = [], date = new Date()) {
  const source = templates.find((template) => template.id === templateId);
  if (!source) throw new Error("找不到需要复制的自定义模板。");
  const typeTemplates = templates.filter((template) => template.type === source.type);
  return [
    ...templates,
    {
      ...cloneTemplate(source),
      id: createTemplateId(source.type, templates),
      name: uniqueCopyName(source, templates),
      order: typeTemplates.length,
      createdAt: localIsoTimestamp(date),
      updatedAt: localIsoTimestamp(date),
    },
  ];
}

export function moveCustomTemplate(templateId, direction, templates = []) {
  if (direction !== -1 && direction !== 1) throw new Error("模板排序方向无效。");
  const current = templates.find((template) => template.id === templateId);
  if (!current) throw new Error("找不到需要排序的自定义模板。");
  const ordered = templates
    .filter((template) => template.type === current.type)
    .sort((left, right) => left.order - right.order);
  const index = ordered.findIndex((template) => template.id === templateId);
  const target = index + direction;
  if (target < 0 || target >= ordered.length) return templates;
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  const orderMap = new Map(ordered.map((template, order) => [template.id, order]));
  return templates.map((template) =>
    orderMap.has(template.id) ? { ...template, order: orderMap.get(template.id) } : template,
  );
}

export function deleteCustomTemplate(templateId, templates = []) {
  if (!templates.some((template) => template.id === templateId)) {
    throw new Error("找不到需要删除的自定义模板。");
  }
  const removed = templates.find((template) => template.id === templateId);
  return templates
    .filter((template) => template.id !== templateId)
    .map((template) =>
      template.type === removed.type && template.order > removed.order
        ? { ...template, order: template.order - 1 }
        : template,
    );
}

export function normalizeCustomTemplate(template, index = 0) {
  const id = cleanText(template?.id);
  const type = cleanText(template?.type);
  const name = cleanText(template?.name);
  if (
    !id ||
    !name ||
    !Object.values(TEMPLATE_TYPES).includes(type) ||
    !template?.content ||
    typeof template.content !== "object" ||
    Array.isArray(template.content)
  ) {
    throw new Error(`自定义模板第 ${index + 1} 项结构无效。`);
  }
  const allowedFields =
    type === TEMPLATE_TYPES.PROJECT
      ? [...PROJECT_TEMPLATE_FIELDS, ...Object.values(PROJECT_EXTRA_FIELD_GROUPS).flat()]
      : ["title", "body"];
  const includedFields = Array.isArray(template.includedFields)
    ? template.includedFields.filter((field) => allowedFields.includes(field))
    : Object.keys(template.content).filter((field) => allowedFields.includes(field));
  const content = Object.fromEntries(
    includedFields.map((field) => [field, String(template.content[field] ?? "")]),
  );
  return {
    id,
    type,
    name,
    description: cleanText(template.description) || "自定义模板",
    builtin: false,
    order: Number.isInteger(template.order) && template.order >= 0 ? template.order : index,
    content,
    includedFields,
    createdAt: cleanText(template.createdAt) || localIsoTimestamp(),
    updatedAt:
      cleanText(template.updatedAt) || cleanText(template.createdAt) || localIsoTimestamp(),
  };
}

export function resolveImportedTemplateConflicts(imported = [], existing = [], mode = "merge") {
  if (mode !== "merge" && mode !== "replace") throw new Error("模板导入模式无效。");
  const result = mode === "replace" ? [] : existing.map(cloneTemplate);
  const ids = new Set(result.map((template) => template.id));
  imported.forEach((raw, index) => {
    const template = normalizeCustomTemplate(raw, index);
    const id = ids.has(template.id) ? createTemplateId(template.type, result) : template.id;
    ids.add(id);
    const source = { ...template, id };
    const name = uniqueCopyName(
      {
        ...source,
        name: source.name,
      },
      result,
    );
    const hasNameConflict = [
      ...(source.type === TEMPLATE_TYPES.PROJECT
        ? BUILTIN_PROJECT_TEMPLATES
        : BUILTIN_NOTE_TEMPLATES),
      ...result,
    ].some(
      (item) =>
        item.type === source.type &&
        item.name.localeCompare(source.name, "zh-CN", { sensitivity: "accent" }) === 0,
    );
    result.push({
      ...source,
      name: hasNameConflict ? name : source.name,
      order: result.filter((item) => item.type === source.type).length,
    });
  });
  return result;
}

export function loadTemplateStore(storage = getAppStorage()) {
  if (!storage) return { templates: [], error: null };
  const raw = storage.getItem(TEMPLATE_STORAGE_KEY);
  if (!raw) return { templates: [], error: null };
  try {
    const payload = JSON.parse(raw);
    if (payload.schemaVersion !== TEMPLATE_SCHEMA_VERSION || !Array.isArray(payload.templates)) {
      throw new Error("unsupported-template-schema");
    }
    return {
      templates: resolveImportedTemplateConflicts(payload.templates, [], "replace"),
      error: null,
    };
  } catch {
    return {
      templates: [],
      error: "本地自定义模板无法读取，已安全回退为内置模板。原数据没有被覆盖。",
    };
  }
}

export function saveTemplateStore(templates, storage = getAppStorage()) {
  if (!storage) throw new Error("当前浏览器不支持本地存储。");
  const normalized = templates.map(normalizeCustomTemplate);
  storage.setItem(
    TEMPLATE_STORAGE_KEY,
    JSON.stringify({ schemaVersion: TEMPLATE_SCHEMA_VERSION, templates: normalized }),
  );
  return normalized;
}
