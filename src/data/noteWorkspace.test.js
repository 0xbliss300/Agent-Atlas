import test from "node:test";
import assert from "node:assert/strict";
import {
  addResearchNoteHistorySnapshot,
  createNoteDraftDiff,
  deleteResearchNoteDraft,
  deleteResearchNoteDraftsForNote,
  deleteResearchNoteDraftsForProject,
  deleteResearchNoteHistoriesForNote,
  deleteResearchNoteHistoriesForProject,
  findResearchNoteDraft,
  getResearchNoteDraftKey,
  loadResearchNoteDraftStore,
  loadResearchNoteHistoryStore,
  NOTE_DRAFT_STORAGE_KEY,
  NOTE_HISTORY_LIMIT,
  NOTE_HISTORY_STORAGE_KEY,
  saveResearchNoteDraftStore,
  saveResearchNoteHistoryStore,
  selectResearchNoteHistories,
  upsertResearchNoteDraft,
} from "./noteWorkspace.js";

function memoryStorage() {
  return {
    values: new Map(),
    getItem(key) {
      return this.values.get(key) ?? null;
    },
    setItem(key, value) {
      this.values.set(key, value);
    },
  };
}

const note = {
  id: "note-1",
  projectId: "project-1",
  title: "实验记录",
  body: "# 结论",
  updatedAt: "2026-07-25T10:00:00+08:00",
};

test("新建与已有笔记使用隔离草稿键并支持多笔记保存", () => {
  assert.equal(getResearchNoteDraftKey("", "project-1"), "new:project-1");
  assert.equal(getResearchNoteDraftKey("note-1"), "note:note-1");
  let drafts = upsertResearchNoteDraft(
    "new:project-1",
    { projectId: "project-1", title: "新建", body: "正文" },
    [],
    new Date("2026-07-25T10:00:00+08:00"),
  );
  drafts = upsertResearchNoteDraft(
    "note:note-1",
    { projectId: "project-1", title: "编辑", body: "修改" },
    drafts,
    new Date("2026-07-25T11:00:00+08:00"),
    "note-1",
  );
  assert.equal(findResearchNoteDraft(drafts, "new:project-1").title, "新建");
  assert.equal(findResearchNoteDraft(drafts, "note:note-1").title, "编辑");
});

test("草稿独立持久化，损坏数据和写入失败不会影响正式笔记", () => {
  const storage = memoryStorage();
  const drafts = upsertResearchNoteDraft(
    "note:note-1",
    { projectId: "project-1", title: "草稿", body: "正文" },
    [],
  );
  saveResearchNoteDraftStore(drafts, storage);
  assert.equal(loadResearchNoteDraftStore(storage).drafts[0].title, "草稿");
  storage.values.set(NOTE_DRAFT_STORAGE_KEY, '{"schemaVersion":99}');
  assert.ok(loadResearchNoteDraftStore(storage).error);
  assert.throws(() =>
    saveResearchNoteDraftStore(drafts, {
      setItem() {
        throw new Error("quota");
      },
    }),
  );
});

test("版本历史按时间倒序且每篇最多保留十版", () => {
  let histories = [];
  for (let index = 0; index < 12; index += 1) {
    histories = addResearchNoteHistorySnapshot(
      { ...note, title: `版本 ${index}`, body: `正文 ${index}` },
      histories,
      new Date(`2026-07-${String(index + 1).padStart(2, "0")}T10:00:00+08:00`),
    );
  }
  const selected = selectResearchNoteHistories(histories, note.id);
  assert.equal(selected.length, NOTE_HISTORY_LIMIT);
  assert.equal(selected[0].title, "版本 11");
  assert.equal(selected.at(-1).title, "版本 2");
});

test("版本历史持久化损坏时安全回退", () => {
  const storage = memoryStorage();
  const histories = addResearchNoteHistorySnapshot(note, []);
  saveResearchNoteHistoryStore(histories, storage);
  assert.equal(loadResearchNoteHistoryStore(storage).histories[0].noteId, "note-1");
  storage.values.set(NOTE_HISTORY_STORAGE_KEY, "broken");
  assert.ok(loadResearchNoteHistoryStore(storage).error);
});

test("项目删除会级联清理草稿与历史", () => {
  const drafts = [
    ...upsertResearchNoteDraft(
      "note:note-1",
      { projectId: "project-1", title: "A", body: "A" },
      [],
      new Date(),
      "note-1",
    ),
    ...upsertResearchNoteDraft(
      "note:note-2",
      { projectId: "project-2", title: "B", body: "B" },
      [],
      new Date(),
      "note-2",
    ),
  ];
  const histories = [
    ...addResearchNoteHistorySnapshot(note, []),
    ...addResearchNoteHistorySnapshot({ ...note, id: "note-2", projectId: "project-2" }, []),
  ];
  assert.equal(deleteResearchNoteDraftsForProject(drafts, "project-1").length, 1);
  assert.equal(deleteResearchNoteHistoriesForProject(histories, "project-1").length, 1);
});

test("正式保存和删除笔记会清理对应草稿及历史且不影响其他笔记", () => {
  const firstDraft = upsertResearchNoteDraft(
    "note:note-1",
    { projectId: "project-1", title: "A", body: "A" },
    [],
    new Date(),
    "note-1",
  );
  const drafts = upsertResearchNoteDraft(
    "note:note-2",
    { projectId: "project-1", title: "B", body: "B" },
    firstDraft,
    new Date(),
    "note-2",
  );
  assert.equal(deleteResearchNoteDraft(drafts, "note:note-1").length, 1);
  assert.equal(deleteResearchNoteDraftsForNote(drafts, "note-1").length, 1);
  const histories = [
    ...addResearchNoteHistorySnapshot(note, []),
    ...addResearchNoteHistorySnapshot({ ...note, id: "note-2" }, []),
  ];
  assert.equal(deleteResearchNoteHistoriesForNote(histories, "note-1").length, 1);
});

test("差异预览包含字段变化及正文增删行", () => {
  const diff = createNoteDraftDiff(
    { projectId: "project-1", title: "旧标题", body: "A\nB" },
    { projectId: "project-1", title: "新标题", body: "A\nC\nD" },
  );
  assert.equal(diff.changed, true);
  assert.equal(diff.fields[0].label, "标题");
  assert.ok(diff.body.some((line) => line.type === "removed" && line.before === "B"));
  assert.ok(diff.body.some((line) => line.type === "added" && line.after === "C"));
});
