import test from "node:test";
import assert from "node:assert/strict";
import { createProjectImportDraft, IMPORT_FIELD_STATUS } from "./projectImport.js";

test("本地读取结果映射为可编辑的新项目草稿和来源元数据", () => {
  const imported = createProjectImportDraft(
    {
      sourceType: "directory",
      sourceName: "agent-demo",
      filesRead: ["README.md", "package.json"],
      git: { branch: "main", commit: "abc123" },
      notes: ["读取 README"],
      project: {
        name: "Demo Agent",
        short: "本地演示 Agent",
        status: "active",
        progress: 50,
        milestone: "完成导入",
        nextTasks: [{ title: "补充测试", done: false }],
        technology: {
          languages: ["TypeScript"],
          frameworks: ["React"],
          runCommand: "npm run dev",
        },
      },
    },
    [],
    new Date("2026-07-25T10:00:00.000Z"),
  );
  assert.equal(imported.draft.name, "Demo Agent");
  assert.equal(imported.draft.progress, "50");
  assert.match(imported.draft.nextTasksText, /补充测试/);
  assert.equal(imported.fieldStatus.name, IMPORT_FIELD_STATUS.DETECTED);
  assert.equal(imported.fieldStatus.progress, IMPORT_FIELD_STATUS.DETECTED);
  assert.equal(imported.fieldStatus.description, IMPORT_FIELD_STATUS.MISSING);
  assert.equal(imported.sourceMetadata.sourceName, "agent-demo");
  assert.equal(imported.sourceMetadata.syncedAt, "2026-07-25T10:00:00.000Z");
});

test("目录名兜底会标记需确认，并提示同名项目", () => {
  const imported = createProjectImportDraft(
    {
      sourceType: "directory",
      sourceName: "已有项目",
      filesRead: ["package.json"],
      project: { technology: {} },
    },
    [{ name: "已有项目" }],
  );
  assert.equal(imported.draft.name, "已有项目");
  assert.equal(imported.fieldStatus.name, IMPORT_FIELD_STATUS.CONFIRM);
  assert.equal(imported.duplicateName, true);
  assert.equal(imported.draft.localPath, "");
});

test("git-repository 来源映射 repositoryUrl 并以 repo 名兜底", () => {
  const imported = createProjectImportDraft(
    {
      sourceType: "git-repository",
      sourceName: "owner/demo-agent",
      filesRead: ["repository metadata"],
      git: { branch: "main", commit: "abc123" },
      notes: ["读取仓库元数据"],
      project: {
        repositoryUrl: "https://github.com/owner/demo-agent",
        short: "demo",
      },
    },
    [],
    new Date("2026-08-01T00:00:00.000Z"),
  );
  assert.equal(imported.draft.name, "demo-agent");
  assert.equal(imported.draft.repositoryUrl, "https://github.com/owner/demo-agent");
  assert.equal(imported.draft.logText, "从 Git 仓库导入：owner/demo-agent");
  assert.equal(imported.fieldStatus.name, IMPORT_FIELD_STATUS.CONFIRM);
  assert.equal(imported.fieldStatus.repositoryUrl, IMPORT_FIELD_STATUS.DETECTED);
  assert.equal(imported.sourceMetadata.sourceType, "git-repository");
  assert.equal(imported.sourceMetadata.branch, "main");
  assert.equal(imported.sourceMetadata.commit, "abc123");
  assert.equal(imported.sourceMetadata.syncedAt, "2026-08-01T00:00:00.000Z");
});
