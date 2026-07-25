import test from "node:test";
import assert from "node:assert/strict";
import {
  createResearchNoteRecord,
  deleteResearchNoteRecord,
  deleteResearchNotesForProject,
  loadResearchNoteStore,
  RESEARCH_NOTE_STORAGE_KEY,
  saveResearchNoteStore,
  sortResearchNotes,
  updateResearchNoteRecord,
  validateResearchNoteDraft,
} from "./researchNotes.js";

const projects = [{ id: "project-1", name: "测试项目" }];

function memoryStorage(value = null) {
  return {
    value,
    getItem(key) {
      return key === RESEARCH_NOTE_STORAGE_KEY ? this.value : null;
    },
    setItem(key, nextValue) {
      if (key === RESEARCH_NOTE_STORAGE_KEY) this.value = nextValue;
    },
  };
}

test("研究笔记必须关联现有项目并包含标题和 Markdown 正文", () => {
  const errors = validateResearchNoteDraft({ projectId: "missing", title: "", body: "" }, projects);
  assert.ok(errors.projectId);
  assert.ok(errors.title);
  assert.ok(errors.body);
});

test("研究笔记支持创建、编辑、排序和删除", () => {
  const older = createResearchNoteRecord(
    { projectId: "project-1", title: "第一篇", body: "# 第一篇" },
    [],
    projects,
    new Date("2026-07-24T02:00:00.000Z"),
  );
  const newer = createResearchNoteRecord(
    { projectId: "project-1", title: "第二篇", body: "- [ ] 实验" },
    [older],
    projects,
    new Date("2026-07-25T02:00:00.000Z"),
  );
  const edited = updateResearchNoteRecord(
    older.id,
    { projectId: "project-1", title: "第一篇（更新）", body: "| A | B |" },
    [older, newer],
    projects,
    new Date("2026-07-26T02:00:00.000Z"),
  );
  assert.equal(edited.id, older.id);
  assert.equal(sortResearchNotes([newer, edited])[0].id, older.id);
  assert.equal(deleteResearchNoteRecord(newer.id, [edited, newer]).length, 1);
});

test("研究笔记独立保存、恢复并在删除项目时级联清理", () => {
  const storage = memoryStorage();
  const note = createResearchNoteRecord(
    { projectId: "project-1", title: "本地笔记", body: "**仅本地**" },
    [],
    projects,
  );
  saveResearchNoteStore([note], storage);
  assert.equal(loadResearchNoteStore(storage).notes[0].title, "本地笔记");
  assert.deepEqual(deleteResearchNotesForProject("project-1", [note]), []);
});

test("旧环境没有研究笔记存储时安全回退为空集合", () => {
  assert.deepEqual(loadResearchNoteStore(memoryStorage()).notes, []);
  const broken = memoryStorage('{"schemaVersion":99,"notes":[]}');
  assert.ok(loadResearchNoteStore(broken).error);
});
