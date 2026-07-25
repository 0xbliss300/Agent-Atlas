import test from "node:test";
import assert from "node:assert/strict";
import { createWorkbenchModel, filterWorkbenchItems, getProjectStaleState } from "./workbench.js";

function project(overrides = {}) {
  return {
    id: "project-1",
    name: "项目一",
    status: "active",
    statusLabel: "开发中",
    progress: 50,
    milestone: "完成闭环",
    updatedAt: "2026-07-24T10:00:00+08:00",
    updatedTimestamp: Date.parse("2026-07-24T10:00:00+08:00"),
    blockers: [],
    nextTasks: [],
    collectionIds: [],
    ...overrides,
  };
}

test("跨项目汇总任务、阻塞、活跃和停滞统计", () => {
  const projects = [
    project({
      blockers: [{ id: "block-1", title: "等待授权", done: false }],
      nextTasks: [
        { id: "task-1", title: "完成测试", done: false },
        { id: "task-2", title: "已完成", done: true },
      ],
    }),
    project({
      id: "project-2",
      name: "项目二",
      status: "paused",
      statusLabel: "已暂停",
      updatedAt: "2026-07-01T10:00:00+08:00",
      updatedTimestamp: Date.parse("2026-07-01T10:00:00+08:00"),
      nextTasks: [{ id: "task-3", title: "恢复开发", done: false }],
    }),
  ];
  const model = createWorkbenchModel(projects, [], new Date("2026-07-25T10:00:00+08:00"));
  assert.deepEqual(model.summary, {
    totalTasks: 3,
    pendingTasks: 2,
    unresolvedBlockers: 1,
    activeProjects: 1,
    pausedProjects: 1,
    staleProjects: 1,
  });
});

test("连续十四天未更新且未完成的项目才标记为可能停滞", () => {
  const source = project({
    updatedAt: "2026-07-11T10:00:00+08:00",
    updatedTimestamp: Date.parse("2026-07-11T10:00:00+08:00"),
  });
  assert.equal(getProjectStaleState(source, new Date("2026-07-25T09:59:59+08:00")).stale, false);
  assert.equal(getProjectStaleState(source, new Date("2026-07-25T10:00:00+08:00")).stale, true);
  assert.equal(
    getProjectStaleState({ ...source, status: "done" }, new Date("2026-08-25T10:00:00+08:00"))
      .stale,
    false,
  );
});

test("默认顺序为阻塞、开发中任务、其他任务和停滞项目且排序稳定", () => {
  const projects = [
    project({
      id: "b",
      name: "B",
      blockers: [{ id: "z", title: "阻塞", done: false }],
      nextTasks: [{ id: "a", title: "活跃任务", done: false }],
    }),
    project({
      id: "a",
      name: "A",
      status: "paused",
      statusLabel: "已暂停",
      updatedAt: "2026-06-01T10:00:00+08:00",
      updatedTimestamp: Date.parse("2026-06-01T10:00:00+08:00"),
      nextTasks: [{ id: "a", title: "暂停任务", done: false }],
    }),
  ];
  const model = createWorkbenchModel(projects, [], new Date("2026-07-25T10:00:00+08:00"));
  assert.deepEqual(
    model.defaultItems.map((item) => [item.type, item.title]),
    [
      ["blocker", "阻塞"],
      ["task", "活跃任务"],
      ["task", "暂停任务"],
      ["project", "可能停滞"],
    ],
  );
});

test("按项目和内容类型筛选，任务筛选包含已完成任务以支持取消勾选", () => {
  const projects = [
    project({
      nextTasks: [
        { id: "open", title: "待办", done: false },
        { id: "done", title: "完成", done: true },
      ],
    }),
  ];
  const model = createWorkbenchModel(projects);
  assert.equal(filterWorkbenchItems(model, { type: "task" }).length, 2);
  assert.equal(filterWorkbenchItems(model, { type: "task", projectId: "missing" }).length, 0);
  assert.equal(filterWorkbenchItems(model, { type: "all" }).length, 1);
});

test("工作台可按集合过滤任务、阻塞和停滞项目", () => {
  const projects = [
    project({
      id: "focus",
      collectionIds: ["collection-focus", "collection-all"],
      blockers: [{ id: "block", title: "重点阻塞", done: false }],
      nextTasks: [{ id: "task", title: "重点任务", done: false }],
    }),
    project({
      id: "other",
      collectionIds: ["collection-all"],
      nextTasks: [{ id: "task", title: "其他任务", done: false }],
    }),
  ];
  const model = createWorkbenchModel(projects);
  const focused = filterWorkbenchItems(model, {
    collectionId: "collection-focus",
    type: "all",
  });
  assert.ok(focused.length >= 2);
  assert.ok(focused.every((item) => item.projectId === "focus"));
  assert.equal(
    filterWorkbenchItems(model, { collectionId: "collection-missing", type: "all" }).length,
    0,
  );
});

test("最近研究笔记和项目按更新时间稳定排序", () => {
  const projects = [project({ id: "b", name: "B" }), project({ id: "a", name: "A" })];
  const notes = [
    {
      id: "note-b",
      projectId: "b",
      title: "B 笔记",
      body: "B",
      updatedAt: "2026-07-25T10:00:00+08:00",
      updatedTimestamp: Date.parse("2026-07-25T10:00:00+08:00"),
    },
    {
      id: "note-a",
      projectId: "a",
      title: "A 笔记",
      body: "A",
      updatedAt: "2026-07-25T10:00:00+08:00",
      updatedTimestamp: Date.parse("2026-07-25T10:00:00+08:00"),
    },
  ];
  const model = createWorkbenchModel(projects, notes);
  assert.deepEqual(
    model.recentProjects.map((item) => item.id),
    ["a", "b"],
  );
  assert.deepEqual(
    model.recentNotes.map((item) => item.entryId),
    ["note-a", "note-b"],
  );
});
