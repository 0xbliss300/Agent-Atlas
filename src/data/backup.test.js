import test from "node:test";
import assert from "node:assert/strict";
import { createAppBackup, createSingleProjectBackup, importAppBackup } from "./backup.js";
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
import { createEvaluationRecord, EVALUATION_SCHEMA_VERSION } from "./evaluations.js";

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

test("单项目导出仅包含该项目及其关联笔记、历史、事件与集合", () => {
  const projectA = createProjectRecord(projectDraft("项目 A"), []);
  const projectB = createProjectRecord(projectDraft("项目 B"), [projectA]);
  const collection = createCollection("重点项目");
  const organizedA = { ...projectA, collectionIds: [collection.id] };
  const noteA = createResearchNoteRecord(
    { projectId: projectA.id, title: "A 笔记", body: "A 内容" },
    [],
    [organizedA],
  );
  const noteB = createResearchNoteRecord(
    { projectId: projectB.id, title: "B 笔记", body: "B 内容" },
    [],
    [projectB],
  );
  const historiesA = addResearchNoteHistorySnapshot(noteA, []);
  const historiesB = addResearchNoteHistorySnapshot(noteB, historiesA);
  const eventsA = [
    createProjectCreatedEvent(organizedA),
    createResearchNoteEvent(noteA, "created"),
  ];
  const eventsB = [createProjectCreatedEvent(projectB), createResearchNoteEvent(noteB, "created")];

  const payload = JSON.parse(
    createSingleProjectBackup(
      organizedA,
      [noteA, noteB],
      historiesB,
      [...eventsA, ...eventsB],
      [collection],
    ),
  );

  assert.equal(payload.projects.length, 1);
  assert.equal(payload.projects[0].id, organizedA.id);
  assert.equal(payload.researchNotes.length, 1);
  assert.equal(payload.researchNotes[0].id, noteA.id);
  assert.equal(payload.researchNoteHistories.length, 1);
  assert.equal(payload.researchNoteHistories[0].noteId, noteA.id);
  assert.equal(payload.projectEvents.length, 2);
  assert.ok(payload.projectEvents.every((event) => event.projectId === organizedA.id));
  assert.equal(payload.collections.length, 1);
  assert.equal(payload.collections[0].id, collection.id);
});

test("单项目导出在关联集合缺失时仍保留项目主体并清理无效集合关联", () => {
  const project = createProjectRecord(projectDraft(), []);
  const organized = { ...project, collectionIds: ["missing-collection"] };
  const payload = JSON.parse(createSingleProjectBackup(organized, [], [], [], []));
  assert.equal(payload.projects[0].collectionIds[0], "missing-collection");
  assert.deepEqual(payload.collections, []);
  const restored = importAppBackup(payload, [], [], "replace");
  assert.deepEqual(restored.projects[0].collectionIds, []);
});

test("单项目备份可合并导入，项目 ID 冲突时重映射并保持笔记关联", () => {
  const project = createProjectRecord(projectDraft(), []);
  const collection = createCollection("核心集合");
  const organized = { ...project, collectionIds: [collection.id] };
  const note = createResearchNoteRecord(
    { projectId: project.id, title: "核心笔记", body: "核心内容" },
    [],
    [organized],
  );
  const histories = addResearchNoteHistorySnapshot(note, []);
  const events = [createProjectCreatedEvent(organized), createResearchNoteEvent(note, "created")];
  const payload = JSON.parse(
    createSingleProjectBackup(organized, [note], histories, events, [collection]),
  );

  const merged = importAppBackup(
    payload,
    [organized],
    [note],
    "merge",
    histories,
    events,
    [],
    [collection],
  );

  assert.equal(merged.projects.length, 2);
  assert.equal(merged.importedCount, 1);
  const importedProject = merged.projects.find((item) => item.id !== organized.id);
  const importedNote = merged.notes.find((item) => item.id !== note.id);
  assert.ok(importedProject);
  assert.ok(importedNote);
  assert.equal(importedNote.projectId, importedProject.id);
  assert.ok(
    merged.histories.some(
      (snapshot) =>
        snapshot.noteId === importedNote.id && snapshot.projectId === importedProject.id,
    ),
  );
  assert.ok(
    merged.events.some(
      (event) =>
        event.projectId === importedProject.id &&
        event.subject?.kind === "note" &&
        event.subject.id === importedNote.id,
    ),
  );
  assert.equal(merged.collections.length, 2);
  assert.ok(merged.collections.some((item) => item.name === "核心集合（导入）"));
});

test("评测结果随完整备份导出并在替换导入后恢复", () => {
  const project = createProjectRecord(projectDraft("评测项目"), []);
  const evaluation = createEvaluationRecord(
    { projectId: project.id, metric: "准确率", value: "92.3%", evaluatedAt: "2026-08-01" },
    [],
    [project],
  );
  const payload = JSON.parse(createAppBackup([project], [], [], [], [], [], [], [evaluation]));
  assert.equal(payload.evaluationSchemaVersion, EVALUATION_SCHEMA_VERSION);
  assert.equal(payload.evaluations[0].metric, "准确率");
  const restored = importAppBackup(payload, [], [], "replace");
  assert.equal(restored.evaluations.length, 1);
  assert.equal(restored.evaluations[0].id, evaluation.id);
  assert.equal(restored.evaluations[0].numericValue, 92.3);
  assert.equal(restored.importedEvaluationsCount, 1);
  assert.equal(restored.reassignedEvaluationIds, 0);
});

test("旧备份缺少评测数据时安全迁移为空评测结果", () => {
  const project = createProjectRecord(projectDraft("旧项目"), []);
  const payload = JSON.parse(createAppBackup([project]));
  delete payload.evaluationSchemaVersion;
  delete payload.evaluations;
  const restored = importAppBackup(
    payload,
    [],
    [],
    "replace",
    [],
    [],
    [],
    [],
    [],
    [createEvaluationRecord({ projectId: "x", metric: "m", value: "1" }, [], [{ id: "x" }])],
  );
  assert.deepEqual(restored.evaluations, []);
});

test("合并备份时评测结果 ID 冲突会重新生成并保留项目关联", () => {
  const project = createProjectRecord(projectDraft("冲突项目"), []);
  const evaluation = createEvaluationRecord(
    { projectId: project.id, metric: "准确率", value: "92.3%", evaluatedAt: "2026-08-01" },
    [],
    [project],
  );
  const merged = importAppBackup(
    createAppBackup([project], [], [], [], [], [], [], [evaluation]),
    [project],
    [],
    "merge",
    [],
    [],
    [],
    [],
    [],
    [evaluation],
  );
  assert.equal(merged.evaluations.length, 2);
  assert.equal(new Set(merged.evaluations.map((item) => item.id)).size, 2);
  const importedProject = merged.projects.find((item) => item.id !== project.id);
  const importedEvaluation = merged.evaluations.find((item) => item.id !== evaluation.id);
  assert.equal(importedEvaluation.projectId, importedProject.id);
  assert.ok(
    merged.evaluations.some((item) => item.id === evaluation.id && item.projectId === project.id),
  );
  assert.equal(merged.importedEvaluationsCount, 1);
  assert.equal(merged.reassignedEvaluationIds, 1);
});

test("单项目导出仅包含该项目关联的评测结果", () => {
  const projectA = createProjectRecord(projectDraft("项目 A"), []);
  const projectB = createProjectRecord(projectDraft("项目 B"), [projectA]);
  const evalA = createEvaluationRecord(
    { projectId: projectA.id, metric: "准确率", value: "92%", evaluatedAt: "2026-08-01" },
    [],
    [projectA, projectB],
  );
  const evalB = createEvaluationRecord(
    { projectId: projectB.id, metric: "延迟", value: "1.2s", evaluatedAt: "2026-08-02" },
    [evalA],
    [projectA, projectB],
  );
  const payload = JSON.parse(createSingleProjectBackup(projectA, [], [], [], [], [evalA, evalB]));
  assert.equal(payload.evaluations.length, 1);
  assert.equal(payload.evaluations[0].id, evalA.id);
});
