import { getAppStorage } from "./filePersistence.js";

export const COLLECTION_SCHEMA_VERSION = 1;
export const COLLECTION_STORAGE_KEY = "agent-project-showcase.collections.v1";
export const MAX_PROJECT_TAGS = 12;
export const MAX_TAG_LENGTH = 24;
export const MAX_COLLECTIONS = 30;
export const MAX_COLLECTION_NAME_LENGTH = 40;

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function localIsoTimestamp(date = new Date()) {
  return date.toISOString();
}

export function normalizeProjectTags(value) {
  const source = Array.isArray(value) ? value : String(value ?? "").split(/[\n,，]+/);
  const seen = new Set();
  const result = [];
  source.forEach((item) => {
    const tag = cleanText(item).slice(0, MAX_TAG_LENGTH);
    const key = tag.toLocaleLowerCase("zh-CN");
    if (!tag || seen.has(key) || result.length >= MAX_PROJECT_TAGS) return;
    seen.add(key);
    result.push(tag);
  });
  return result;
}

export function validateProjectTags(value) {
  const source = Array.isArray(value)
    ? value.map(cleanText).filter(Boolean)
    : String(value ?? "")
        .split(/[\n,，]+/)
        .map(cleanText)
        .filter(Boolean);
  if (source.some((tag) => tag.length > MAX_TAG_LENGTH)) {
    return `每个标签最多 ${MAX_TAG_LENGTH} 个字符。`;
  }
  const unique = new Set(source.map((tag) => tag.toLocaleLowerCase("zh-CN")));
  if (unique.size > MAX_PROJECT_TAGS) return `每个项目最多 ${MAX_PROJECT_TAGS} 个标签。`;
  return "";
}

export function normalizeCollectionIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(cleanText).filter(Boolean))];
}

function createCollectionId(collections = []) {
  const ids = new Set(collections.map((collection) => collection.id));
  let id;
  do {
    id =
      globalThis.crypto?.randomUUID?.() ??
      `collection-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  } while (ids.has(id));
  return id;
}

function validateCollectionName(name, collections = [], ignoreId = "") {
  const cleaned = cleanText(name);
  if (!cleaned) throw new Error("请输入集合名称。");
  if (cleaned.length > MAX_COLLECTION_NAME_LENGTH) {
    throw new Error(`集合名称最多 ${MAX_COLLECTION_NAME_LENGTH} 个字符。`);
  }
  if (
    collections.some(
      (collection) =>
        collection.id !== ignoreId &&
        collection.name.localeCompare(cleaned, "zh-CN", { sensitivity: "accent" }) === 0,
    )
  ) {
    throw new Error(`已存在名为“${cleaned}”的集合。`);
  }
  return cleaned;
}

export function normalizeCollection(collection, index = 0) {
  const id = cleanText(collection?.id);
  const name = cleanText(collection?.name);
  if (!id || !name || name.length > MAX_COLLECTION_NAME_LENGTH) {
    throw new Error(`项目集合第 ${index + 1} 项结构无效。`);
  }
  return {
    id,
    name,
    order: Number.isInteger(collection.order) && collection.order >= 0 ? collection.order : index,
    createdAt: cleanText(collection.createdAt) || localIsoTimestamp(),
    updatedAt:
      cleanText(collection.updatedAt) || cleanText(collection.createdAt) || localIsoTimestamp(),
  };
}

export function sortCollections(collections = []) {
  return [...collections].sort(
    (left, right) =>
      left.order - right.order ||
      left.name.localeCompare(right.name, "zh-CN") ||
      left.id.localeCompare(right.id),
  );
}

export function createCollection(name, collections = [], date = new Date()) {
  if (collections.length >= MAX_COLLECTIONS) {
    throw new Error(`最多创建 ${MAX_COLLECTIONS} 个项目集合。`);
  }
  const timestamp = localIsoTimestamp(date);
  return {
    id: createCollectionId(collections),
    name: validateCollectionName(name, collections),
    order: collections.length,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function renameCollection(collectionId, name, collections = [], date = new Date()) {
  const current = collections.find((collection) => collection.id === collectionId);
  if (!current) throw new Error("找不到需要重命名的集合。");
  const nextName = validateCollectionName(name, collections, collectionId);
  return collections.map((collection) =>
    collection.id === collectionId
      ? { ...collection, name: nextName, updatedAt: localIsoTimestamp(date) }
      : collection,
  );
}

export function moveCollection(collectionId, direction, collections = []) {
  if (direction !== -1 && direction !== 1) throw new Error("集合排序方向无效。");
  const ordered = sortCollections(collections);
  const index = ordered.findIndex((collection) => collection.id === collectionId);
  if (index < 0) throw new Error("找不到需要排序的集合。");
  const target = index + direction;
  if (target < 0 || target >= ordered.length) return collections;
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  const orders = new Map(ordered.map((collection, order) => [collection.id, order]));
  return collections.map((collection) => ({
    ...collection,
    order: orders.get(collection.id),
  }));
}

export function deleteCollection(collectionId, collections = [], projects = []) {
  if (!collections.some((collection) => collection.id === collectionId)) {
    throw new Error("找不到需要删除的集合。");
  }
  const remaining = sortCollections(
    collections.filter((collection) => collection.id !== collectionId),
  ).map((collection, order) => ({ ...collection, order }));
  const nextProjects = projects.map((project) =>
    project.collectionIds?.includes(collectionId)
      ? {
          ...project,
          collectionIds: project.collectionIds.filter((id) => id !== collectionId),
        }
      : project,
  );
  return { collections: remaining, projects: nextProjects };
}

export function countProjectsInCollection(projects = [], collectionId = "") {
  return projects.filter((project) => project.collectionIds?.includes(collectionId)).length;
}

function importedCopyName(name, collections) {
  let index = 1;
  let candidate = `${name}（导入）`;
  const names = new Set(
    collections.map((collection) => collection.name.toLocaleLowerCase("zh-CN")),
  );
  while (names.has(candidate.toLocaleLowerCase("zh-CN"))) {
    index += 1;
    candidate = `${name}（导入 ${index}）`;
  }
  return candidate;
}

export function importCollections(imported = [], existing = [], mode = "merge") {
  if (mode !== "merge" && mode !== "replace") throw new Error("集合导入模式无效。");
  const result = mode === "replace" ? [] : existing.map(normalizeCollection);
  const idMap = {};
  const ids = new Set(result.map((collection) => collection.id));
  imported.forEach((raw, index) => {
    const normalized = normalizeCollection(raw, index);
    const id = ids.has(normalized.id) ? createCollectionId(result) : normalized.id;
    ids.add(id);
    const nameConflict = result.some(
      (collection) =>
        collection.name.localeCompare(normalized.name, "zh-CN", {
          sensitivity: "accent",
        }) === 0,
    );
    const next = {
      ...normalized,
      id,
      name: nameConflict ? importedCopyName(normalized.name, result) : normalized.name,
      order: result.length,
    };
    result.push(next);
    idMap[normalized.id] = next.id;
  });
  return { collections: result, idMap, importedCount: imported.length };
}

export function loadCollectionStore(storage = getAppStorage()) {
  if (!storage) return { collections: [], error: null };
  const raw = storage.getItem(COLLECTION_STORAGE_KEY);
  if (!raw) return { collections: [], error: null };
  try {
    const payload = JSON.parse(raw);
    if (
      payload.schemaVersion !== COLLECTION_SCHEMA_VERSION ||
      !Array.isArray(payload.collections)
    ) {
      throw new Error("unsupported-collection-schema");
    }
    const { collections } = importCollections(payload.collections, [], "replace");
    return { collections, error: null };
  } catch {
    return {
      collections: [],
      error: "本地项目集合无法读取，已安全回退为空集合。项目主体没有被覆盖。",
    };
  }
}

export function saveCollectionStore(collections, storage = getAppStorage()) {
  if (!storage) throw new Error("当前浏览器不支持本地存储。");
  const normalized = sortCollections(collections.map(normalizeCollection)).map(
    (collection, order) => ({ ...collection, order }),
  );
  storage.setItem(
    COLLECTION_STORAGE_KEY,
    JSON.stringify({ schemaVersion: COLLECTION_SCHEMA_VERSION, collections: normalized }),
  );
  return normalized;
}
