import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanupTrash,
  createProjectTrashEntry,
  emptyTrash,
  loadTrashStore,
  normalizeTrashEntry,
  permanentlyDeleteTrashEntry,
  restoreTrashEntry,
  saveTrashStore,
  serializeTrashEntry,
  softDeleteProject,
  softDeleteResearchNote,
  TRASH_MAX_ENTRIES,
  TRASH_SCHEMA_VERSION,
  TRASH_STORAGE_KEY,
} from "./trash.js";
import { createProjectRecord, EMPTY_PROJECT_DRAFT } from "./projects.js";
import { createResearchNoteRecord } from "./researchNotes.js";
import { addResearchNoteHistorySnapshot } from "./noteWorkspace.js";
import { createProjectCreatedEvent, createResearchNoteEvent } from "./projectEvents.js";
import { createEvaluationRecord } from "./evaluations.js";
import { createAppBackup, importAppBackup } from "./backup.js";

function projectDraft(name = "测试项目") {
  return {
    ...EMPTY_PROJECT_DRAFT,
    name,
    short: "回收站测试",
    milestone: "完成测试",
    status: "active",
    progress: "50",
  };
}

function makeProject(name) {
  return createProjectRecord(projectDraft(name), []);
}

function makeNote(project, title, existing = []) {
  return createResearchNoteRecord({ projectId: project.id, title, body: "# 测试正文" }, existing, [
    project,
  ]);
}

function memoryStorage(initial = null) {
  return {
    value: initial,
    getItem(key) {
      return key === TRASH_STORAGE_KEY ? this.value : null;
    },
    setItem(key, value) {
      if (key === TRASH_STORAGE_KEY) this.value = value;
    },
  };
}

test("软删除项目会把项目及其关联笔记、历史、事件和草稿移出活跃数据集并生成回收站条目", () => {
  const project = makeProject("核心 Agent");
  const otherProject = makeProject("另一个 Agent");
  const note = makeNote(project, "核心笔记");
  const otherNote = makeNote(otherProject, "其他笔记", [note]);
  const histories = addResearchNoteHistorySnapshot(note, []);
  const otherHistories = addResearchNoteHistorySnapshot(otherNote, histories);
  const events = [createProjectCreatedEvent(project), createResearchNoteEvent(note, "created")];
  const otherEvents = [createProjectCreatedEvent(otherProject)];
  const drafts = [
    {
      key: `note:${note.id}`,
      noteId: note.id,
      projectId: project.id,
      title: "草稿",
      body: "",
      updatedAt: note.updatedAt,
    },
    {
      key: `new:${otherProject.id}`,
      noteId: null,
      projectId: otherProject.id,
      title: "新草稿",
      body: "",
      updatedAt: otherNote.updatedAt,
    },
  ];

  const result = softDeleteProject(
    project.id,
    [project, otherProject],
    [note, otherNote],
    otherHistories,
    [...events, ...otherEvents],
    drafts,
    [],
  );

  assert.equal(result.projects.length, 1);
  assert.equal(result.projects[0].id, otherProject.id);
  assert.equal(result.notes.length, 1);
  assert.equal(result.notes[0].id, otherNote.id);
  assert.equal(result.histories.length, 1);
  assert.equal(result.histories[0].noteId, otherNote.id);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].projectId, otherProject.id);
  assert.equal(result.drafts.length, 1);
  assert.equal(result.drafts[0].projectId, otherProject.id);

  assert.equal(result.trashEntries.length, 1);
  const entry = result.trashEntries[0];
  assert.equal(entry.kind, "project");
  assert.equal(entry.project.id, project.id);
  assert.equal(entry.notes.length, 1);
  assert.equal(entry.notes[0].id, note.id);
  assert.equal(entry.histories.length, 1);
  assert.equal(entry.events.length, 2);
  assert.equal(entry.drafts.length, 1);
});

test("软删除研究笔记会移出目标笔记及其历史、事件和草稿", () => {
  const project = makeProject("笔记项目");
  const note = makeNote(project, "目标笔记");
  const histories = addResearchNoteHistorySnapshot(note, []);
  const events = [createResearchNoteEvent(note, "created")];
  const drafts = [
    {
      key: `note:${note.id}`,
      noteId: note.id,
      projectId: project.id,
      title: "草稿",
      body: "",
      updatedAt: note.updatedAt,
    },
  ];

  const result = softDeleteResearchNote(note.id, [note], histories, events, drafts, []);

  assert.equal(result.notes.length, 0);
  assert.equal(result.histories.length, 0);
  assert.equal(result.events.length, 0);
  assert.equal(result.drafts.length, 0);
  assert.equal(result.trashEntries.length, 1);
  assert.equal(result.trashEntries[0].kind, "research-note");
  assert.equal(result.trashEntries[0].note.id, note.id);
});

test("软删除不存在的项目或笔记会抛出明确错误", () => {
  assert.throws(() => softDeleteProject("missing", [], [], [], [], [], []), /找不到需要删除的项目/);
  assert.throws(
    () => softDeleteResearchNote("missing", [], [], [], [], []),
    /找不到需要删除的研究笔记/,
  );
});

test("cleanupTrash 会删除过期条目并按删除时间倒序截断到最大上限", () => {
  const now = new Date("2026-07-28T12:00:00.000+08:00");
  const fresh = createProjectTrashEntry(makeProject("新鲜项目"), [], [], [], [], now);
  const expired = createProjectTrashEntry(
    makeProject("过期项目"),
    [],
    [],
    [],
    [],
    new Date("2026-07-20T12:00:00.000+08:00"),
  );
  const result = cleanupTrash([expired, fresh], now);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, fresh.id);

  const many = Array.from({ length: TRASH_MAX_ENTRIES + 5 }, (_, index) =>
    createProjectTrashEntry(
      makeProject(`项目 ${index}`),
      [],
      [],
      [],
      [],
      new Date(now.getTime() - index * 1000),
    ),
  );
  assert.equal(cleanupTrash(many, now).length, TRASH_MAX_ENTRIES);
});

test("恢复项目会把关联内容还原到活跃数据集", () => {
  const project = makeProject("待恢复项目");
  const note = makeNote(project, "待恢复笔记");
  const histories = addResearchNoteHistorySnapshot(note, []);
  const events = [createProjectCreatedEvent(project), createResearchNoteEvent(note, "created")];
  const drafts = [
    {
      key: `note:${note.id}`,
      noteId: note.id,
      projectId: project.id,
      title: "草稿",
      body: "",
      updatedAt: note.updatedAt,
    },
  ];
  const deleted = softDeleteProject(project.id, [project], [note], histories, events, drafts, []);

  const result = restoreTrashEntry(deleted.entry, [], [], [], [], []);

  assert.equal(result.projects.length, 1);
  assert.equal(result.projects[0].id, project.id);
  assert.equal(result.notes.length, 1);
  assert.equal(result.notes[0].id, note.id);
  assert.equal(result.histories.length, 1);
  assert.equal(result.events.length, 2);
  assert.equal(result.drafts.length, 1);
});

test("恢复研究笔记需要原项目仍存在", () => {
  const project = makeProject("原项目");
  const note = makeNote(project, "孤立笔记");
  const deleted = softDeleteResearchNote(note.id, [note], [], [], [], []);

  assert.throws(() => restoreTrashEntry(deleted.entry, [], [], [], [], []), /原项目已被删除/);

  const result = restoreTrashEntry(deleted.entry, [project], [], [], [], []);
  assert.equal(result.notes.length, 1);
  assert.equal(result.notes[0].projectId, project.id);
});

test("恢复时遇到 ID 冲突会重映射并保留关联", () => {
  const project = makeProject("冲突项目");
  const note = makeNote(project, "冲突笔记");
  const histories = addResearchNoteHistorySnapshot(note, []);
  const events = [createProjectCreatedEvent(project), createResearchNoteEvent(note, "created")];
  const drafts = [
    {
      key: `note:${note.id}`,
      noteId: note.id,
      projectId: project.id,
      title: "草稿",
      body: "",
      updatedAt: note.updatedAt,
    },
  ];
  const deleted = softDeleteProject(project.id, [project], [note], histories, events, drafts, []);

  const result = restoreTrashEntry(deleted.entry, [project], [note], histories, events, []);

  assert.equal(result.projects.length, 2);
  const restoredProject = result.projects.find((item) => item.id !== project.id);
  const restoredNote = result.notes.find((item) => item.id !== note.id);
  assert.ok(restoredProject);
  assert.ok(restoredNote);
  assert.equal(restoredNote.projectId, restoredProject.id);
  assert.ok(result.drafts.some((draft) => draft.projectId === restoredProject.id));
});

test("永久删除单条条目和清空回收站会从列表中移除目标", () => {
  const entry = createProjectTrashEntry(makeProject("删除项"), [], [], [], []);
  assert.deepEqual(permanentlyDeleteTrashEntry(entry.id, [entry]), []);
  assert.deepEqual(
    permanentlyDeleteTrashEntry("missing", [entry]).map((item) => item.id),
    [entry.id],
  );
  assert.deepEqual(emptyTrash(), []);
});

test("回收站可随完整备份导出并在替换导入后恢复", () => {
  const project = makeProject("备份项目");
  const note = makeNote(project, "备份笔记");
  const histories = addResearchNoteHistorySnapshot(note, []);
  const events = [createProjectCreatedEvent(project), createResearchNoteEvent(note, "created")];
  const drafts = [
    {
      key: `note:${note.id}`,
      noteId: note.id,
      projectId: project.id,
      title: "草稿",
      body: "",
      updatedAt: note.updatedAt,
    },
  ];
  const deleted = softDeleteProject(project.id, [project], [note], histories, events, drafts, []);

  const payload = JSON.parse(createAppBackup([], [], [], [], [], [], deleted.trashEntries));
  assert.equal(payload.trashSchemaVersion, TRASH_SCHEMA_VERSION);
  assert.equal(payload.trash.length, 1);

  const restored = importAppBackup(payload, [], [], "replace", [], [], [], [], []);
  assert.equal(restored.trash.length, 1);
  assert.equal(restored.trash[0].kind, "project");
  assert.equal(restored.trash[0].project.id, project.id);
});

test("序列化与规范化往返保持条目结构", () => {
  const project = makeProject("序列化项目");
  const entry = createProjectTrashEntry(project, [], [], [], []);
  const serialized = serializeTrashEntry(entry);
  const normalized = normalizeTrashEntry(serialized);
  assert.equal(normalized.id, entry.id);
  assert.equal(normalized.kind, entry.kind);
  assert.equal(normalized.project.id, project.id);
});

test("损坏的回收站存储安全回退为空列表", () => {
  const storage = memoryStorage("{broken");
  const result = loadTrashStore(storage);
  assert.equal(result.entries.length, 0);
  assert.ok(result.error);
  assert.equal(storage.value, "{broken");
});

test("回收站本地存储可保存并恢复", () => {
  const storage = memoryStorage();
  const project = makeProject("持久项目");
  const entry = createProjectTrashEntry(project, [], [], [], []);
  saveTrashStore([entry], storage);
  const loaded = loadTrashStore(storage);
  assert.equal(loaded.entries.length, 1);
  assert.equal(loaded.entries[0].project.id, project.id);
  assert.equal(loaded.error, null);
  const payload = JSON.parse(storage.value);
  assert.equal(payload.schemaVersion, TRASH_SCHEMA_VERSION);
});

test("保存时自动清理过期条目", () => {
  const storage = memoryStorage();
  const fresh = createProjectTrashEntry(makeProject("新鲜项目"), [], [], [], [], new Date());
  const expired = createProjectTrashEntry(
    makeProject("过期项目"),
    [],
    [],
    [],
    [],
    new Date("2026-07-20T12:00:00.000+08:00"),
  );
  saveTrashStore([expired, fresh], storage);
  const loaded = loadTrashStore(storage);
  assert.equal(loaded.entries.length, 1);
  assert.equal(loaded.entries[0].id, fresh.id);
});

test("软删除项目会移出关联评测结果并在恢复时还原", () => {
  const project = makeProject("评测项目");
  const other = makeProject("其他项目");
  const evaluation = createEvaluationRecord(
    { projectId: project.id, metric: "准确率", value: "92.3%", evaluatedAt: "2026-08-01" },
    [],
    [project, other],
  );
  const otherEvaluation = createEvaluationRecord(
    { projectId: other.id, metric: "延迟", value: "1.2s", evaluatedAt: "2026-08-02" },
    [evaluation],
    [project, other],
  );

  const deleted = softDeleteProject(
    project.id,
    [project, other],
    [],
    [],
    [],
    [],
    [],
    [evaluation, otherEvaluation],
  );
  assert.equal(deleted.evaluations.length, 1);
  assert.equal(deleted.evaluations[0].id, otherEvaluation.id);
  assert.equal(deleted.entry.evaluations.length, 1);
  assert.equal(deleted.entry.evaluations[0].id, evaluation.id);

  const restored = restoreTrashEntry(deleted.entry, [], [], [], [], [], [otherEvaluation]);
  assert.equal(restored.projects.length, 1);
  assert.equal(restored.projects[0].id, project.id);
  assert.equal(restored.evaluations.length, 2);
  assert.ok(restored.evaluations.some((item) => item.id === evaluation.id));
  assert.ok(restored.evaluations.some((item) => item.id === otherEvaluation.id));
});

test("恢复项目时遇到评测 ID 冲突会重新生成并保留项目关联", () => {
  const project = makeProject("冲突项目");
  const evaluation = createEvaluationRecord(
    { projectId: project.id, metric: "准确率", value: "92.3%", evaluatedAt: "2026-08-01" },
    [],
    [project],
  );
  const deleted = softDeleteProject(project.id, [project], [], [], [], [], [], [evaluation]);

  const restored = restoreTrashEntry(deleted.entry, [project], [], [], [], [], [evaluation]);
  assert.equal(restored.evaluations.length, 2);
  assert.equal(new Set(restored.evaluations.map((item) => item.id)).size, 2);
  const importedProject = restored.projects.find((item) => item.id !== project.id);
  const importedEvaluation = restored.evaluations.find((item) => item.id !== evaluation.id);
  assert.equal(importedEvaluation.projectId, importedProject.id);
  assert.ok(
    restored.evaluations.some((item) => item.id === evaluation.id && item.projectId === project.id),
  );
});
