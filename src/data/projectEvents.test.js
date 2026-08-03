import test from "node:test";
import assert from "node:assert/strict";
import {
  addProjectEvent,
  createBlockerToggledEvent,
  createEvaluationEvent,
  createLocalStatusEvent,
  createProjectCreatedEvent,
  createProjectUpdatedEvent,
  createResearchNoteEvent,
  createTaskToggledEvent,
  deleteProjectEventsForProject,
  loadProjectEventStore,
  markResearchNoteSourceDeleted,
  normalizeProjectEvent,
  PROJECT_EVENT_LIMIT,
  PROJECT_EVENT_STORAGE_KEY,
  PROJECT_EVENT_TYPES,
  saveProjectEventStore,
  selectProjectEvents,
  serializeProjectEvent,
} from "./projectEvents.js";

function project(overrides = {}) {
  return {
    id: "project-1",
    name: "测试项目",
    status: "active",
    statusLabel: "开发中",
    progress: 20,
    milestone: "完成基础",
    nextTasks: [{ id: "task-1", title: "补齐测试", done: false }],
    blockers: [{ id: "blocker-1", title: "等待权限", done: false }],
    ...overrides,
  };
}

function memoryStorage(initial = null) {
  return {
    value: initial,
    getItem(key) {
      return key === PROJECT_EVENT_STORAGE_KEY ? this.value : null;
    },
    setItem(key, value) {
      if (key === PROJECT_EVENT_STORAGE_KEY) this.value = value;
    },
  };
}

test("覆盖项目创建、状态批量变化和无实际变化", () => {
  const before = project();
  const after = project({
    status: "paused",
    statusLabel: "已暂停",
    progress: 50,
    milestone: "完成验收",
  });
  const created = createProjectCreatedEvent(before, new Date("2026-07-25T10:00:00+08:00"));
  const updated = createProjectUpdatedEvent(before, after, new Date("2026-07-25T11:00:00+08:00"));
  assert.equal(created.type, "project");
  assert.equal(updated.type, "status");
  assert.deepEqual(
    updated.changes.map((item) => item.field),
    ["status", "progress", "milestone"],
  );
  assert.equal(createProjectUpdatedEvent(before, { ...before }), null);
});

test("覆盖任务、阻塞和本地状态事件", () => {
  const before = project();
  const taskAfter = project({
    nextTasks: [{ id: "task-1", title: "补齐测试", done: true }],
  });
  const blockerAfter = project({
    blockers: [{ id: "blocker-1", title: "等待权限", done: true }],
  });
  assert.match(createTaskToggledEvent(before, taskAfter, "task-1").summary, /完成任务/);
  assert.match(createBlockerToggledEvent(before, blockerAfter, "blocker-1").summary, /解决阻塞项/);
  const local = createLocalStatusEvent(before, project({ progress: 70 }), {
    sourceName: "status.json",
  });
  assert.equal(local.type, "local");
  assert.match(local.summary, /status.json/);
});

test("研究笔记事件不保存正文，删除后保留并标记来源已删除", () => {
  const note = {
    id: "note-1",
    projectId: "project-1",
    title: "实验记录",
    body: "不应进入事件的完整 Markdown 正文",
  };
  const created = createResearchNoteEvent(note, "created");
  const updated = createResearchNoteEvent(
    { ...note, title: "实验记录（更新）", body: "新的正文也不应保存" },
    "updated",
    new Date(),
    note,
  );
  assert.equal(JSON.stringify(created).includes(note.body), false);
  assert.equal(updated.changes[0].field, "title");
  assert.equal(JSON.stringify(updated).includes("新的正文也不应保存"), false);
  const deleted = createResearchNoteEvent(note, "deleted");
  const marked = markResearchNoteSourceDeleted([created, updated, deleted], note.id);
  assert.equal(marked.length, 3);
  assert.ok(marked.every((event) => event.subject.sourceDeleted));
});

test("每项目稳定倒序并只保留最近 200 条", () => {
  let events = [];
  for (let index = 0; index < PROJECT_EVENT_LIMIT + 5; index += 1) {
    events = addProjectEvent(
      events,
      normalizeProjectEvent({
        id: `event-${String(index).padStart(3, "0")}`,
        projectId: "project-1",
        type: "task",
        occurredAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
        summary: `事件 ${index}`,
      }),
    );
  }
  const selected = selectProjectEvents(events, "project-1");
  assert.equal(selected.length, 200);
  assert.equal(selected[0].summary, "事件 204");
  assert.equal(selected.at(-1).summary, "事件 5");
});

test("事件独立持久化，旧环境与损坏数据安全回退", () => {
  const storage = memoryStorage();
  const event = createProjectCreatedEvent(project());
  saveProjectEventStore([event], storage);
  assert.equal(loadProjectEventStore(storage).events[0].id, event.id);
  assert.deepEqual(loadProjectEventStore(memoryStorage()).events, []);
  const broken = loadProjectEventStore(memoryStorage("{bad"));
  assert.deepEqual(broken.events, []);
  assert.ok(broken.error);
});

test("按类型筛选并在删除项目时级联移除事件", () => {
  const created = createProjectCreatedEvent(project());
  const task = createTaskToggledEvent(
    project(),
    project({ nextTasks: [{ id: "task-1", title: "补齐测试", done: true }] }),
    "task-1",
  );
  assert.deepEqual(selectProjectEvents([created, task], "project-1", "task"), [task]);
  assert.deepEqual(deleteProjectEventsForProject([created, task], "project-1"), []);
});

test("评测事件记录指标名、数值与日期但不复制完整数据集", () => {
  const event = createEvaluationEvent(
    project(),
    {
      id: "eval-1",
      metric: "准确率",
      value: "92.3%",
      evaluated: "2026-08-01",
    },
    new Date("2026-08-01T10:00:00+08:00"),
  );
  assert.equal(event.type, PROJECT_EVENT_TYPES.EVAL);
  assert.match(event.summary, /记录评测“准确率”：92.3%（2026-08-01）/);
  assert.equal(event.subject.kind, "evaluation");
  assert.equal(event.subject.id, "eval-1");
  assert.equal(event.subject.action, "recorded");
  assert.equal(event.subject.title, "准确率：92.3%");
  assert.deepEqual(event.changes, []);
});

test("事件默认 source 为 user，normalize 保留合法值并回退非法值", () => {
  const manual = createProjectCreatedEvent(project());
  assert.equal(manual.source, "user");

  const auto = normalizeProjectEvent({
    ...manual,
    id: "auto-1",
    source: "auto",
  });
  assert.equal(auto.source, "auto");

  const invalid = normalizeProjectEvent({
    ...manual,
    id: "invalid-1",
    source: "malicious",
  });
  assert.equal(invalid.source, "user");

  const missing = normalizeProjectEvent({
    id: "missing-1",
    projectId: "project-1",
    type: "project",
    occurredAt: "2026-08-03T10:00:00+08:00",
    summary: "测试",
  });
  assert.equal(missing.source, "user");
});

test("createLocalStatusEvent 支持 source 参数区分自动与人工事件", () => {
  const before = project();
  const after = project({ progress: 40, status: "paused", statusLabel: "已暂停" });
  const syncResult = { sourceName: "demo-dir", git: { branch: "main", commit: "abc123" } };

  const manualEvent = createLocalStatusEvent(before, after, syncResult);
  assert.equal(manualEvent.source, "user");

  const autoEvent = createLocalStatusEvent(before, after, syncResult, new Date(), "auto");
  assert.equal(autoEvent.source, "auto");
  assert.equal(autoEvent.type, PROJECT_EVENT_TYPES.LOCAL);
  assert.equal(autoEvent.subject.action, "applied");
});

test("serializeProjectEvent 导出 source 字段并保持往返一致", () => {
  const before = project();
  const after = project({ progress: 50 });
  const autoEvent = createLocalStatusEvent(before, after, {}, new Date(), "auto");
  const serialized = serializeProjectEvent(autoEvent);
  assert.equal(serialized.source, "auto");

  const restored = normalizeProjectEvent(serialized);
  assert.equal(restored.source, "auto");
  assert.equal(restored.id, autoEvent.id);
  assert.equal(restored.summary, autoEvent.summary);
});
