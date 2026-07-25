import test from "node:test";
import assert from "node:assert/strict";
import { createAppBackup, importAppBackup } from "./backup.js";
import { createProjectBackup, createProjectRecord, EMPTY_PROJECT_DRAFT } from "./projects.js";
import { createResearchNoteRecord } from "./researchNotes.js";
import { addResearchNoteHistorySnapshot, NOTE_HISTORY_SCHEMA_VERSION } from "./noteWorkspace.js";
import {
  createProjectCreatedEvent,
  createResearchNoteEvent,
  PROJECT_EVENT_SCHEMA_VERSION,
} from "./projectEvents.js";
import {
  createCustomNoteTemplate,
  createCustomProjectTemplate,
  TEMPLATE_SCHEMA_VERSION,
} from "./templates.js";
import { COLLECTION_SCHEMA_VERSION, createCollection } from "./organization.js";

function projectDraft(name = "备份项目") {
  return {
    ...EMPTY_PROJECT_DRAFT,
    name,
    short: "备份测试",
    milestone: "验证恢复",
    status: "active",
    progress: "50",
  };
}

test("应用备份包含研究笔记并可替换恢复", () => {
  const project = createProjectRecord(projectDraft(), []);
  const note = createResearchNoteRecord(
    { projectId: project.id, title: "恢复笔记", body: "# 内容" },
    [],
    [project],
  );
  const histories = addResearchNoteHistorySnapshot(note, []);
  const events = [createProjectCreatedEvent(project), createResearchNoteEvent(note, "created")];
  const templates = [
    createCustomProjectTemplate("项目结构", projectDraft()),
    createCustomNoteTemplate("笔记结构", { title: "", body: "# 大纲" }),
  ];
  const payload = JSON.parse(createAppBackup([project], [note], histories, events, templates));
  assert.equal(payload.researchNoteSchemaVersion, 1);
  assert.equal(payload.researchNoteHistorySchemaVersion, NOTE_HISTORY_SCHEMA_VERSION);
  assert.equal(payload.projectEventSchemaVersion, PROJECT_EVENT_SCHEMA_VERSION);
  assert.equal(payload.templateSchemaVersion, TEMPLATE_SCHEMA_VERSION);
  const restored = importAppBackup(payload, [], [], "replace");
  assert.equal(restored.notes[0].projectId, project.id);
  assert.equal(restored.histories[0].noteId, note.id);
  assert.equal(restored.events.length, 2);
  assert.equal(restored.templates.length, 2);
});

test("旧版仅项目备份仍可导入并安全回退为空研究笔记", () => {
  const project = createProjectRecord(projectDraft(), []);
  const restored = importAppBackup(createProjectBackup([project]), [], [], "replace");
  assert.equal(restored.projects.length, 1);
  assert.deepEqual(restored.notes, []);
  assert.deepEqual(restored.histories, []);
  assert.deepEqual(restored.events, []);
  assert.deepEqual(restored.templates, []);
});

test("合并备份时模板 ID 与名称冲突会安全生成副本", () => {
  const project = createProjectRecord(projectDraft(), []);
  const template = createCustomProjectTemplate("团队结构", projectDraft());
  const merged = importAppBackup(
    createAppBackup([project], [], [], [], [template]),
    [],
    [],
    "merge",
    [],
    [],
    [template],
  );
  assert.equal(merged.templates.length, 2);
  assert.equal(new Set(merged.templates.map((item) => item.id)).size, 2);
  assert.deepEqual(
    merged.templates.map((item) => item.name),
    ["团队结构", "团队结构（副本）"],
  );
  assert.equal(merged.importedTemplatesCount, 1);
});

test("旧备份没有模板字段时替换导入安全迁移为空模板", () => {
  const project = createProjectRecord(projectDraft(), []);
  const payload = JSON.parse(createAppBackup([project]));
  delete payload.templateSchemaVersion;
  delete payload.templates;
  const restored = importAppBackup(
    payload,
    [],
    [],
    "replace",
    [],
    [],
    [createCustomNoteTemplate("已有模板", { body: "# 内容" })],
  );
  assert.deepEqual(restored.templates, []);
});

test("集合随备份恢复，合并 ID 与名称冲突时保持项目关联", () => {
  const collection = createCollection("重点项目");
  const project = createProjectRecord(projectDraft("集合项目"), []);
  const organizedProject = {
    ...project,
    collectionIds: [collection.id],
  };
  const payload = JSON.parse(createAppBackup([organizedProject], [], [], [], [], [collection]));
  assert.equal(payload.collectionSchemaVersion, COLLECTION_SCHEMA_VERSION);
  const merged = importAppBackup(payload, [], [], "merge", [], [], [], [collection]);
  assert.equal(merged.collections.length, 2);
  assert.equal(merged.collections[1].name, "重点项目（导入）");
  assert.notEqual(merged.collections[1].id, collection.id);
  assert.deepEqual(merged.projects[0].collectionIds, [merged.collections[1].id]);
  assert.equal(merged.importedCollectionsCount, 1);
});

test("旧备份缺少集合数据时仍恢复项目主体并清理无效关联", () => {
  const project = createProjectRecord(projectDraft("旧项目"), []);
  const payload = JSON.parse(createAppBackup([{ ...project, collectionIds: ["missing"] }]));
  delete payload.collectionSchemaVersion;
  delete payload.collections;
  const restored = importAppBackup(payload, [], [], "replace");
  assert.equal(restored.projects.length, 1);
  assert.deepEqual(restored.projects[0].collectionIds, []);
  assert.deepEqual(restored.collections, []);
});

test("合并项目 ID 冲突时同步改写导入笔记的项目关联", () => {
  const project = createProjectRecord(projectDraft(), []);
  const note = createResearchNoteRecord(
    { projectId: project.id, title: "关联笔记", body: "项目冲突仍需关联" },
    [],
    [project],
  );
  const histories = addResearchNoteHistorySnapshot(note, []);
  const events = [createProjectCreatedEvent(project), createResearchNoteEvent(note, "created")];
  const merged = importAppBackup(
    createAppBackup([project], [note], histories, events),
    [project],
    [note],
    "merge",
    histories,
    events,
  );
  assert.equal(merged.projects.length, 2);
  const importedNote = merged.notes.find((item) => item.projectId !== project.id);
  assert.ok(importedNote);
  assert.ok(merged.projects.some((item) => item.id === importedNote.projectId));
  assert.ok(
    merged.histories.some(
      (snapshot) =>
        snapshot.noteId === importedNote.id && snapshot.projectId === importedNote.projectId,
    ),
  );
  assert.equal(new Set(merged.events.map((event) => event.id)).size, merged.events.length);
  const importedEvent = merged.events.find(
    (event) => event.projectId === importedNote.projectId && event.subject?.kind === "note",
  );
  assert.equal(importedEvent.subject.id, importedNote.id);
});

test("旧版含笔记但不含历史的备份安全迁移为空历史", () => {
  const project = createProjectRecord(projectDraft(), []);
  const note = createResearchNoteRecord(
    { projectId: project.id, title: "旧笔记", body: "旧内容" },
    [],
    [project],
  );
  const payload = JSON.parse(createAppBackup([project], [note]));
  delete payload.researchNoteHistorySchemaVersion;
  delete payload.researchNoteHistories;
  const restored = importAppBackup(payload, [], [], "replace");
  assert.equal(restored.notes.length, 1);
  assert.deepEqual(restored.histories, []);
  assert.deepEqual(restored.events, []);
});
