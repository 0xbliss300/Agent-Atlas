import test from "node:test";
import assert from "node:assert/strict";
import { searchProjectTasks, searchResearchNotes } from "./search.js";

function note(overrides = {}) {
  return {
    id: "note-1",
    projectId: "project-1",
    title: "检索实验记录",
    body: "# 实验\n baseline 命中率 82%。",
    createdAt: "2026-07-20T10:00:00+08:00",
    createdTimestamp: Date.parse("2026-07-20T10:00:00+08:00"),
    updatedAt: "2026-07-24T10:00:00+08:00",
    updatedTimestamp: Date.parse("2026-07-24T10:00:00+08:00"),
    ...overrides,
  };
}

function project(overrides = {}) {
  return {
    id: "project-1",
    name: "知识库 Agent",
    status: "active",
    updatedTimestamp: Date.parse("2026-07-24T10:00:00+08:00"),
    blockers: [],
    nextTasks: [],
    ...overrides,
  };
}

test("研究笔记标题命中后返回该笔记", () => {
  const results = searchResearchNotes([note()], "检索实验");
  assert.equal(results.length, 1);
  assert.equal(results[0].noteId, "note-1");
  assert.equal(results[0].title, "检索实验记录");
});

test("研究笔记 Markdown 正文命中后返回该笔记", () => {
  const results = searchResearchNotes([note()], "命中率 82%");
  assert.equal(results.length, 1);
  assert.equal(results[0].noteId, "note-1");
  assert.ok(results[0].excerpt.includes("命中率 82%"));
});

test("未完成任务文本命中后返回所属项目", () => {
  const source = project({
    nextTasks: [{ id: "task-1", title: "接入向量数据库", done: false }],
  });
  const results = searchProjectTasks([source], "向量数据库");
  assert.equal(results.length, 1);
  assert.equal(results[0].type, "task");
  assert.equal(results[0].projectId, "project-1");
});

test("未解决阻塞文本命中后返回所属项目", () => {
  const source = project({
    blockers: [{ id: "blocker-1", title: "等待模型评估额度", done: false }],
  });
  const results = searchProjectTasks([source], "评估额度");
  assert.equal(results.length, 1);
  assert.equal(results[0].type, "blocker");
  assert.equal(results[0].projectId, "project-1");
});

test("已完成任务与已解决阻塞不参与搜索", () => {
  const source = project({
    nextTasks: [{ id: "task-1", title: "接入向量数据库", done: true }],
    blockers: [{ id: "blocker-1", title: "等待评估额度", done: true }],
  });
  assert.deepEqual(searchProjectTasks([source], "向量数据库"), []);
  assert.deepEqual(searchProjectTasks([source], "评估额度"), []);
});

test("空查询返回空结果", () => {
  const notes = [note()];
  const projects = [project({ nextTasks: [{ id: "task-1", title: "任务", done: false }] })];
  assert.deepEqual(searchResearchNotes(notes, ""), []);
  assert.deepEqual(searchResearchNotes(notes, "   "), []);
  assert.deepEqual(searchProjectTasks(projects, ""), []);
  assert.deepEqual(searchProjectTasks(projects, "   "), []);
});

test("无命中时返回空结果", () => {
  const notes = [note()];
  const projects = [project({ nextTasks: [{ id: "task-1", title: "任务", done: false }] })];
  assert.deepEqual(searchResearchNotes(notes, "不存在的关键词"), []);
  assert.deepEqual(searchProjectTasks(projects, "不存在的关键词"), []);
});

test("搜索结果携带稳定路由字段", () => {
  const noteResults = searchResearchNotes([note()], "检索实验");
  assert.equal(noteResults[0].route, "/notes/note-1");
  const taskResults = searchProjectTasks(
    [
      project({
        nextTasks: [{ id: "task-1", title: "接入向量数据库", done: false }],
      }),
    ],
    "向量数据库",
  );
  assert.equal(taskResults[0].route, "/project/project-1");
});
