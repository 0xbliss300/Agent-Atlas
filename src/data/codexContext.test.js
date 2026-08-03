import test from "node:test";
import assert from "node:assert/strict";
import {
  CONTEXT_LENGTH_WARNING,
  createCodexContext,
  generateCodexContext,
  sanitizeContextFilename,
  selectDefaultContextNoteIds,
} from "./codexContext.js";

const completeProject = {
  name: "知识库 Agent",
  short: "整理研究资料",
  description: "让新会话快速理解项目。",
  statusLabel: "开发中",
  progress: 60,
  milestone: "完成检索闭环",
  updatedAt: "2026-07-25T12:00:00+08:00",
  blockers: [
    { title: "等待模型评估", done: false },
    { title: "旧阻塞", done: true },
  ],
  nextTasks: [
    { title: "完成任务清单", done: false },
    { title: "已交付", done: true },
  ],
  technology: {
    languages: ["JavaScript"],
    frameworks: ["React"],
    models: ["GPT-5"],
    dataSources: ["Markdown"],
    runCommand: "npm run dev",
  },
  agentProfile: {
    modelVersion: "GPT-5 2026-08",
    promptVersion: "v1.3.0 / commit abc123",
    datasets: ["私有知识库", "MMLU 子集"],
    runtime: "Node 22 / Ollama",
    tokenCost: "~$0.012/次",
    inferenceParams: "temperature=0.2, max_tokens=4096",
  },
  localPath: "E:\\work\\agent",
  repositoryUrl: "https://example.com/repo?q=原始",
  documentationPath: "README.md",
  demoUrl: "http://127.0.0.1:5173/",
  previewPath: "dist/index.html",
  log: ["完成导入", "建立测试"],
};

const note = {
  id: "note-1",
  title: "实验 [一]",
  body: "## 结论\n\n<script>alert(1)</script>\n[危险](javascript:alert(1))",
  updatedAt: "2026-07-25T13:00:00+08:00",
  updatedTimestamp: Date.parse("2026-07-25T13:00:00+08:00"),
};

test("生成稳定章节并只包含未完成任务和未解决阻塞项", () => {
  const markdown = generateCodexContext(
    completeProject,
    [note],
    new Date("2026-07-25T14:30:00+08:00"),
  );
  const headings = [...markdown.matchAll(/^## \d+\..+$/gm)].map((match) => match[0]);
  assert.deepEqual(headings, [
    "## 1. 项目目标",
    "## 2. 当前状态",
    "## 3. 未解决阻塞项",
    "## 4. 未完成任务",
    "## 5. 技术栈",
    "## 6. Agent 技术档案",
    "## 7. 运行命令",
    "## 8. 本地资源",
    "## 9. 最近开发记录",
    "## 10. 研究笔记索引",
    "## 11. 已选研究笔记",
  ]);
  assert.match(markdown, /- \[ \] 等待模型评估/);
  assert.match(markdown, /- \[ \] 完成任务清单/);
  assert.doesNotMatch(markdown, /旧阻塞|已交付/);
  assert.match(markdown, /本地启动：`npm run dev`/);
  assert.match(markdown, /本地目录：`E:\\work\\agent`/);
  assert.match(markdown, /https:\/\/example\.com\/repo\?q=原始/);
});

test("缺失字段仍生成完整上下文并明确标记", () => {
  const markdown = generateCodexContext(
    { name: "空项目", blockers: [], nextTasks: [], technology: {}, log: [] },
    [],
    new Date("2026-07-25T14:30:00+08:00"),
  );
  assert.match(markdown, /一句话简介：未配置/);
  assert.match(markdown, /未配置（当前没有相关条目）。/);
  assert.match(markdown, /未选择研究笔记/);
});

test("Agent 技术档案章节包含已配置字段并对缺失回退为未配置", () => {
  const filled = generateCodexContext(completeProject, []);
  assert.match(filled, /模型版本：GPT\\-5 2026\\-08/);
  assert.match(filled, /Prompt 版本：v1\\.3\\.0 \/ commit abc123/);
  assert.match(filled, /数据集：`私有知识库`、`MMLU 子集`/);
  assert.match(filled, /运行环境：Node 22 \/ Ollama/);
  assert.match(filled, /Token 成本：~\$0\\.012\/次/);
  assert.match(filled, /推理参数：temperature=0\\.2, max\\_tokens=4096/);

  const empty = generateCodexContext(
    { name: "无 Agent 字段", blockers: [], nextTasks: [], technology: {}, log: [] },
    [],
  );
  assert.match(empty, /模型版本：未配置/);
  assert.match(empty, /Prompt 版本：未配置/);
  assert.match(empty, /数据集：未配置/);
  assert.match(empty, /运行环境：未配置/);
  assert.match(empty, /Token 成本：未配置/);
  assert.match(empty, /推理参数：未配置/);
});

test("多篇笔记按更新时间排序，默认仅选最近三篇", () => {
  const notes = [1, 4, 2, 3].map((day) => ({
    id: `note-${day}`,
    title: `笔记 ${day}`,
    body: "正文",
    updatedAt: `2026-07-${String(20 + day).padStart(2, "0")}T00:00:00+08:00`,
    updatedTimestamp: Date.parse(`2026-07-${String(20 + day).padStart(2, "0")}T00:00:00+08:00`),
  }));
  assert.deepEqual(selectDefaultContextNoteIds(notes), ["note-4", "note-3", "note-2"]);
  const markdown = generateCodexContext(completeProject, notes);
  assert.ok(markdown.indexOf("笔记 4") < markdown.indexOf("笔记 3"));
});

test("特殊字符不会破坏 Markdown 结构或生成可执行 HTML", () => {
  const markdown = generateCodexContext(
    { ...completeProject, name: "# 项目 <img onerror=alert(1)>" },
    [note],
  );
  assert.match(markdown, /\\# 项目 &lt;img onerror=alert\\\(1\\\)&gt;/);
  assert.doesNotMatch(markdown, /<script>|javascript:/i);
  assert.match(markdown, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(markdown, /javascript-blocked:/);
});

test("统计字符、笔记数量并对长内容给出标记", () => {
  const longNote = { ...note, body: "长".repeat(CONTEXT_LENGTH_WARNING) };
  const context = createCodexContext(completeProject, [longNote]);
  assert.equal(context.characterCount, context.markdown.length);
  assert.equal(context.noteCount, 1);
  assert.equal(context.isLong, true);
});

test("下载文件名会清理危险字符并限制长度", () => {
  assert.equal(sanitizeContextFilename(' ../A:B*项目? " '), "A-B-项目-CODEX_CONTEXT.md");
  assert.equal(sanitizeContextFilename("   "), "project-CODEX_CONTEXT.md");
  assert.ok(sanitizeContextFilename("a".repeat(200)).length <= 97);
});
