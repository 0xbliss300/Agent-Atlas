import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_PROJECT_DRAFT } from "./projects.js";
import {
  applyNoteTemplate,
  applyProjectTemplate,
  createCustomNoteTemplate,
  createCustomProjectTemplate,
  deleteCustomTemplate,
  duplicateCustomTemplate,
  getBuiltinNoteTemplates,
  getBuiltinProjectTemplates,
  getTemplatesByType,
  loadTemplateStore,
  moveCustomTemplate,
  renameCustomTemplate,
  saveTemplateStore,
  TEMPLATE_SCHEMA_VERSION,
  TEMPLATE_STORAGE_KEY,
  TEMPLATE_TYPES,
} from "./templates.js";

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

const projectDraft = {
  ...EMPTY_PROJECT_DRAFT,
  name: "私有项目",
  short: "可复用简介",
  description: "可复用结构",
  status: "done",
  progress: "88",
  milestone: "私有里程碑",
  localPath: "E:\\private",
  repositoryUrl: "https://example.com/private",
  documentationPath: "E:\\private\\README.md",
  demoUrl: "http://127.0.0.1:3000",
  previewPath: "E:\\private\\demo.pdf",
  featuresText: "能力 | 规划中",
  roadmapText: "阶段 | 说明 | next",
  logText: "历史记录",
  blockersText: "- [ ] 阻塞",
  nextTasksText: "- [ ] 任务",
  languagesText: "JavaScript",
  frameworksText: "React",
  modelsText: "GPT",
  dataSourcesText: "私有文档",
  runCommand: "npm run dev",
};

test("所有内置项目与研究笔记模板可用且保持只读来源", () => {
  const projects = getBuiltinProjectTemplates();
  const notes = getBuiltinNoteTemplates();
  assert.deepEqual(
    projects.map((template) => template.name),
    ["空白项目", "Agent 项目", "研究项目", "自动化项目"],
  );
  assert.deepEqual(
    notes.map((template) => template.name),
    ["空白笔记", "实验记录", "技术调研", "决策记录", "复盘"],
  );
  assert.ok(projects.every((template) => template.builtin));
  assert.ok(notes.every((template) => template.builtin));
});

test("套用内置模板只返回可编辑草稿并保留已输入项目名或所属项目", () => {
  const agent = getBuiltinProjectTemplates().find((template) => template.name === "Agent 项目");
  const projectResult = applyProjectTemplate(agent, { name: "我的 Agent" });
  assert.equal(projectResult.name, "我的 Agent");
  assert.match(projectResult.description, /项目目标/);
  projectResult.description = "可编辑";
  assert.match(agent.content.description, /项目目标/);

  const experiment = getBuiltinNoteTemplates().find((template) => template.name === "实验记录");
  const noteResult = applyNoteTemplate(experiment, { projectId: "project-1" });
  assert.equal(noteResult.projectId, "project-1");
  assert.match(noteResult.body, /目标与假设/);
});

test("自定义项目模板默认排除身份、状态、历史、路径和资源字段", () => {
  const template = createCustomProjectTemplate(
    "安全结构",
    projectDraft,
    [],
    {},
    new Date("2026-07-25T10:00:00.000Z"),
  );
  assert.equal(template.content.description, "可复用结构");
  assert.equal(template.content.runCommand, "npm run dev");
  for (const field of [
    "id",
    "name",
    "status",
    "progress",
    "milestone",
    "logText",
    "localPath",
    "repositoryUrl",
    "documentationPath",
    "demoUrl",
    "previewPath",
    "updatedAt",
    "researchNotes",
    "events",
  ]) {
    assert.equal(Object.hasOwn(template.content, field), false, field);
  }
});

test("用户明确选择后才保存额外项目字段", () => {
  const template = createCustomProjectTemplate("带额外字段", projectDraft, [], {
    statusProgress: true,
    milestone: true,
    log: true,
    localPath: true,
    resources: true,
  });
  assert.equal(template.content.status, "done");
  assert.equal(template.content.progress, "88");
  assert.equal(template.content.milestone, "私有里程碑");
  assert.equal(template.content.logText, "历史记录");
  assert.equal(template.content.localPath, "E:\\private");
  assert.equal(template.content.repositoryUrl, "https://example.com/private");
});

test("研究笔记模板仅保存标题和 Markdown，不保存项目及历史", () => {
  const template = createCustomNoteTemplate("实验大纲", {
    projectId: "project-private",
    title: "实验",
    body: "# 实验\n\n内容",
    histories: [{ id: "history-1" }],
  });
  assert.deepEqual(template.content, { title: "实验", body: "# 实验\n\n内容" });
  assert.equal(Object.hasOwn(template.content, "projectId"), false);
  assert.equal(Object.hasOwn(template.content, "histories"), false);
});

test("自定义模板支持重命名、复制、排序和删除", () => {
  const first = createCustomNoteTemplate("模板一", { body: "# 一" });
  const second = createCustomNoteTemplate("模板二", { body: "# 二" }, [first]);
  let templates = [first, second];
  templates = renameCustomTemplate(first.id, "模板甲", templates);
  assert.equal(templates[0].name, "模板甲");
  templates = duplicateCustomTemplate(first.id, templates);
  assert.equal(templates[2].name, "模板甲（副本）");
  templates = moveCustomTemplate(templates[2].id, -1, templates);
  assert.deepEqual(
    getTemplatesByType(templates, TEMPLATE_TYPES.NOTE)
      .filter((template) => !template.builtin)
      .map((template) => template.name),
    ["模板甲", "模板甲（副本）", "模板二"],
  );
  const createdProject = applyNoteTemplate(templates[0], { projectId: "project-1" });
  templates = deleteCustomTemplate(templates[0].id, templates);
  assert.equal(templates.length, 2);
  assert.equal(createdProject.body, "# 一");
});

test("模板名称与内置或自定义模板冲突时拒绝保存", () => {
  assert.throws(() => createCustomProjectTemplate("Agent 项目", projectDraft), /已存在名为/);
  const existing = createCustomNoteTemplate("团队大纲", { body: "# 内容" });
  assert.throws(
    () => createCustomNoteTemplate("团队大纲", { body: "# 其他" }, [existing]),
    /已存在名为/,
  );
});

test("版本化模板存储可往返，损坏或旧版本安全回退", () => {
  const storage = createStorage();
  const template = createCustomNoteTemplate("模板", { body: "# 内容" });
  saveTemplateStore([template], storage);
  assert.equal(loadTemplateStore(storage).templates[0].name, "模板");

  const corrupt = createStorage({ [TEMPLATE_STORAGE_KEY]: "{bad" });
  assert.deepEqual(loadTemplateStore(corrupt).templates, []);
  assert.match(loadTemplateStore(corrupt).error, /安全回退/);

  const old = createStorage({
    [TEMPLATE_STORAGE_KEY]: JSON.stringify({
      schemaVersion: TEMPLATE_SCHEMA_VERSION - 1,
      templates: [template],
    }),
  });
  assert.deepEqual(loadTemplateStore(old).templates, []);
  assert.match(loadTemplateStore(old).error, /安全回退/);
});
