import assert from "node:assert/strict";
import test from "node:test";
import {
  COLLECTION_SCHEMA_VERSION,
  COLLECTION_STORAGE_KEY,
  createCollection,
  deleteCollection,
  importCollections,
  loadCollectionStore,
  MAX_PROJECT_TAGS,
  MAX_TAG_LENGTH,
  moveCollection,
  normalizeProjectTags,
  renameCollection,
  saveCollectionStore,
  validateProjectTags,
} from "./organization.js";

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

test("标签去空、忽略大小写重复并限制数量与长度", () => {
  assert.deepEqual(normalizeProjectTags(" Agent, agent， 研究 \n\n本地优先 "), [
    "Agent",
    "研究",
    "本地优先",
  ]);
  assert.match(validateProjectTags("a".repeat(MAX_TAG_LENGTH + 1)), /最多 24/);
  assert.match(
    validateProjectTags(
      Array.from({ length: MAX_PROJECT_TAGS + 1 }, (_, index) => `标签${index}`).join(","),
    ),
    /最多 12/,
  );
  const normalized = normalizeProjectTags([
    "x".repeat(MAX_TAG_LENGTH + 3),
    ...Array.from({ length: MAX_PROJECT_TAGS + 3 }, (_, index) => `T${index}`),
  ]);
  assert.equal(normalized.length, MAX_PROJECT_TAGS);
  assert.equal(normalized[0].length, MAX_TAG_LENGTH);
});

test("集合支持创建、重命名、稳定排序和名称冲突保护", () => {
  const first = createCollection("当前重点", [], new Date("2026-07-25T10:00:00.000Z"));
  const second = createCollection("研究", [first], new Date("2026-07-25T11:00:00.000Z"));
  let collections = [first, second];
  collections = renameCollection(first.id, "近期交付", collections);
  assert.equal(collections[0].name, "近期交付");
  assert.throws(() => renameCollection(first.id, "研究", collections), /已存在/);
  collections = moveCollection(second.id, -1, collections);
  assert.equal(collections.find((item) => item.id === second.id).order, 0);
  assert.equal(collections.find((item) => item.id === first.id).order, 1);
});

test("删除集合只解除多项目关联，不删除项目主体或其他集合关联", () => {
  const first = createCollection("集合一");
  const second = createCollection("集合二", [first]);
  const projects = [
    {
      id: "project-1",
      name: "项目一",
      collectionIds: [first.id, second.id],
      researchNotes: ["note-1"],
    },
    { id: "project-2", name: "项目二", collectionIds: [first.id] },
  ];
  const result = deleteCollection(first.id, [first, second], projects);
  assert.equal(result.collections.length, 1);
  assert.equal(result.projects.length, 2);
  assert.deepEqual(result.projects[0].collectionIds, [second.id]);
  assert.deepEqual(result.projects[0].researchNotes, ["note-1"]);
  assert.deepEqual(result.projects[1].collectionIds, []);
});

test("集合备份合并时重映射 ID 并保留名称冲突双方", () => {
  const existing = {
    id: "collection-1",
    name: "研究",
    order: 0,
    createdAt: "2026-07-25T10:00:00.000Z",
    updatedAt: "2026-07-25T10:00:00.000Z",
  };
  const imported = { ...existing };
  const result = importCollections([imported], [existing], "merge");
  assert.equal(result.collections.length, 2);
  assert.notEqual(result.idMap[imported.id], existing.id);
  assert.equal(result.collections[1].name, "研究（导入）");
});

test("集合独立版本化存储可往返，损坏与旧版本安全回退", () => {
  const storage = createStorage();
  const collection = createCollection("重点");
  saveCollectionStore([collection], storage);
  assert.equal(loadCollectionStore(storage).collections[0].name, "重点");

  const corrupt = createStorage({ [COLLECTION_STORAGE_KEY]: "{bad" });
  assert.deepEqual(loadCollectionStore(corrupt).collections, []);
  assert.match(loadCollectionStore(corrupt).error, /项目主体没有被覆盖/);

  const old = createStorage({
    [COLLECTION_STORAGE_KEY]: JSON.stringify({
      schemaVersion: COLLECTION_SCHEMA_VERSION - 1,
      collections: [collection],
    }),
  });
  assert.deepEqual(loadCollectionStore(old).collections, []);
  assert.match(loadCollectionStore(old).error, /安全回退/);
});
