import test from "node:test";
import assert from "node:assert/strict";
import {
  applyProjectStatusSync,
  createProjectBackup,
  createProjectRecord,
  createResearchNotes,
  deleteProjectRecord,
  duplicateProjectRecord,
  EMPTY_PROJECT_DRAFT,
  findProjectById,
  importProjectBackup,
  loadProjectStore,
  normalizeProject,
  PROJECT_STORAGE_KEY,
  PROJECT_STATUSES,
  saveProjectStore,
  setProjectPinned,
  sortProjectsByUpdatedAt,
  summarizeProjects,
  toggleProjectBlocker,
  toggleProjectTask,
  updateProjectRecord,
  validateProjectDraft,
} from "./projects.js";

function draft(name = "测试 Agent", overrides = {}) {
  return {
    ...EMPTY_PROJECT_DRAFT,
    name,
    short: "验证项目管理闭环",
    milestone: "完成第一版",
    status: PROJECT_STATUSES.ACTIVE,
    progress: "40",
    ...overrides,
  };
}

function memoryStorage(initial = null) {
  return {
    value: initial,
    getItem(key) {
      return key === PROJECT_STORAGE_KEY ? this.value : null;
    },
    setItem(key, value) {
      if (key === PROJECT_STORAGE_KEY) this.value = value;
    },
  };
}

test("空存储恢复为空项目列表", () => {
  assert.deepEqual(loadProjectStore(memoryStorage()).projects, []);
});

test("合法创建生成唯一 ID，非法字段被拒绝", () => {
  const first = createProjectRecord(draft(), []);
  const second = createProjectRecord(draft("第二个 Agent"), [first]);
  assert.notEqual(first.id, second.id);
  const errors = validateProjectDraft(
    draft("", { progress: "101", repositoryUrl: "ftp://invalid" }),
  );
  assert.ok(errors.name && errors.progress && errors.repositoryUrl);
});

test("项目可以保存并从本地存储恢复", () => {
  const storage = memoryStorage();
  const project = createProjectRecord(draft(), []);
  saveProjectStore([project], storage);
  assert.equal(loadProjectStore(storage).projects[0].id, project.id);
});

test("损坏 JSON 安全回退且不覆盖原数据", () => {
  const storage = memoryStorage("{broken");
  const result = loadProjectStore(storage);
  assert.equal(result.projects.length, 0);
  assert.ok(result.error);
  assert.equal(storage.value, "{broken");
});

test("编辑保留 ID，复制生成新 ID，删除移除目标", () => {
  const original = createProjectRecord(draft(), []);
  const edited = updateProjectRecord(original.id, draft("更新后的 Agent", { progress: "75" }), [
    original,
  ]);
  assert.equal(edited.id, original.id);
  assert.equal(edited.progress, 75);
  const duplicate = duplicateProjectRecord(original.id, [original]);
  assert.notEqual(duplicate.id, original.id);
  assert.match(duplicate.name, /副本/);
  assert.deepEqual(
    deleteProjectRecord(original.id, [original, duplicate]).map((item) => item.id),
    [duplicate.id],
  );
});

test("创建后汇总与最近更新排序同步", () => {
  const first = createProjectRecord(draft("已完成", { status: PROJECT_STATUSES.DONE }), []);
  const second = createProjectRecord(draft("开发中"), [first]);
  const summary = summarizeProjects([first, second]);
  assert.equal(summary.total, 2);
  assert.equal(summary.active, 1);
  assert.equal(summary.done, 1);
  assert.equal(sortProjectsByUpdatedAt([first, second]).length, 2);
});

test("项目详情选择能返回目标项目并处理非法地址", () => {
  const project = createProjectRecord(draft(), []);
  assert.equal(findProjectById([project], project.id), project);
  assert.equal(findProjectById([project], "missing-project"), null);
});

test("缺失可选字段会回退为稳定默认值", () => {
  const project = createProjectRecord(draft("最小项目", { description: "", logText: "" }), []);
  assert.equal(project.description, project.short);
  assert.deepEqual(project.features, []);
  assert.deepEqual(project.roadmap, []);
  assert.deepEqual(project.log, ["创建项目"]);
  assert.deepEqual(project.tags, []);
  assert.equal(project.pinned, false);
  assert.deepEqual(project.collectionIds, []);
});

test("项目标签、置顶与多集合关联会保存，置顶不伪造更新时间", () => {
  const project = createProjectRecord(
    draft("组织项目", {
      tagsText: " Agent, agent, 研究 ",
      pinned: false,
      collectionIds: ["collection-a", "collection-b", "collection-a"],
    }),
    [],
  );
  assert.deepEqual(project.tags, ["Agent", "研究"]);
  assert.deepEqual(project.collectionIds, ["collection-a", "collection-b"]);
  const pinned = setProjectPinned(project.id, true, [project])[0];
  assert.equal(pinned.pinned, true);
  assert.equal(pinned.updatedAt, project.updatedAt);
  assert.equal(sortProjectsByUpdatedAt([project, pinned])[0].pinned, true);
});

test("导出包含版本号并可替换导入", () => {
  const project = createProjectRecord(draft(), []);
  const backup = createProjectBackup([project]);
  assert.equal(JSON.parse(backup).schemaVersion, 1);
  const result = importProjectBackup(backup, [], "replace");
  assert.equal(result.projects[0].id, project.id);
});

test("合并导入遇到 ID 冲突会生成新 ID", () => {
  const project = createProjectRecord(draft(), []);
  const result = importProjectBackup(createProjectBackup([project]), [project], "merge");
  assert.equal(result.projects.length, 2);
  assert.equal(result.reassignedIds, 1);
  assert.notEqual(result.projects[0].id, result.projects[1].id);
});

test("错误备份不会产生可保存的新数据", () => {
  const existing = [createProjectRecord(draft(), [])];
  assert.throws(
    () => importProjectBackup('{"schemaVersion":1,"projects":[{"id":"bad"}]}', existing, "replace"),
    /字段无效/,
  );
  assert.equal(existing.length, 1);
});

test("阻塞项、下一步任务和技术信息会随项目保存与恢复", () => {
  const project = createProjectRecord(
    draft("工程化 Agent", {
      blockersText: "- [ ] 等待模型评估\n- [x] 已确认数据结构",
      nextTasksText: "- [ ] 补充恢复流程\n- [x] 完成路由",
      languagesText: "JavaScript, Python",
      frameworksText: "React\nVite",
      modelsText: "GPT-5",
      dataSourcesText: "本地 Markdown",
      runCommand: "npm run dev",
    }),
    [],
  );
  assert.equal(project.blockers.length, 2);
  assert.equal(project.blockers[1].done, true);
  assert.equal(project.nextTasks[0].done, false);
  assert.deepEqual(project.technology.frameworks, ["React", "Vite"]);
  assert.equal(project.technology.runCommand, "npm run dev");
});

test("详情页任务可以勾选并保留稳定任务 ID", () => {
  const project = createProjectRecord(
    draft("任务 Agent", { nextTasksText: "- [ ] 完成可执行任务" }),
    [],
  );
  const taskId = project.nextTasks[0].id;
  const toggled = toggleProjectTask(project.id, taskId, [project])[0];
  assert.equal(toggled.nextTasks[0].done, true);
  assert.equal(toggled.nextTasks[0].id, taskId);
  const edited = updateProjectRecord(project.id, projectToEditableDraft(toggled), [toggled]);
  assert.equal(edited.nextTasks[0].id, taskId);
});

test("工作台可以解决阻塞项并写回原项目", () => {
  const project = createProjectRecord(
    draft("阻塞 Agent", { blockersText: "- [ ] 等待本地权限" }),
    [],
  );
  const blockerId = project.blockers[0].id;
  const toggled = toggleProjectBlocker(project.id, blockerId, [project])[0];
  assert.equal(toggled.blockers[0].done, true);
  assert.equal(toggled.blockers[0].id, blockerId);
  assert.equal(Number.isFinite(Date.parse(toggled.updatedAt)), true);
});

test("本地读取结果可以安全合并到目标项目", () => {
  const project = createProjectRecord(draft("本地同步 Agent"), []);
  const synced = applyProjectStatusSync(
    project.id,
    {
      sourceType: "directory",
      sourceName: "local-agent",
      filesRead: ["package.json", ".git/HEAD"],
      git: { branch: "main", commit: "abc123" },
      project: {
        progress: 75,
        nextTasks: [{ id: "task-local", title: "完成测试", done: false }],
        technology: { frameworks: ["React"], runCommand: "npm run dev" },
      },
    },
    [project],
  )[0];
  assert.equal(synced.progress, 75);
  assert.equal(synced.nextTasks[0].id, "task-local");
  assert.equal(synced.technology.frameworks[0], "React");
  assert.equal(synced.localSync.branch, "main");
});

test("研究笔记汇总全部项目日志并按时间、项目 ID 和原顺序稳定排序", () => {
  const first = normalizeProject({
    id: "project-b",
    name: "项目 B",
    status: "active",
    progress: 50,
    updatedAt: "2026-07-25T10:00:00.000+08:00",
    log: ["B 的第一条", "B 的第二条"],
  });
  const second = normalizeProject({
    id: "project-a",
    name: "项目 A",
    status: "done",
    progress: 100,
    updatedAt: "2026-07-25T10:00:00.000+08:00",
    log: ["A 的第一条"],
  });
  const latest = normalizeProject({
    id: "project-c",
    name: "项目 C",
    status: "planning",
    progress: 10,
    updatedAt: "2026-07-26T09:00:00.000+08:00",
    log: ["最新记录"],
  });
  const notes = createResearchNotes([first, latest, second]);
  assert.deepEqual(
    notes.map((note) => note.content),
    ["最新记录", "A 的第一条", "B 的第一条", "B 的第二条"],
  );
  assert.equal(notes[1].projectId, "project-a");
  assert.equal(notes[2].logIndex, 0);
});

test("旧项目缺少日志时研究笔记安全回退为空列表", () => {
  assert.deepEqual(
    createResearchNotes([{ id: "legacy", updatedTimestamp: 0, log: undefined }]),
    [],
  );
});

function projectToEditableDraft(project) {
  return {
    ...draft(project.name),
    short: project.short,
    milestone: project.milestone,
    progress: String(project.progress),
    nextTasksText: project.nextTasks
      .map((task) => `- [${task.done ? "x" : " "}] ${task.title}`)
      .join("\n"),
  };
}
