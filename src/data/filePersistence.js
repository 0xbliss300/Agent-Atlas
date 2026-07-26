import { FILE_DATASET_BY_STORAGE_KEY, FILE_DATASETS } from "./fileDatasets.js";

const values = new Map();
const listeners = new Set();
const failedWrites = new Map();
let initialized = false;
let fileMode = false;
let writeQueue = Promise.resolve();
let pendingWrites = 0;
let status = Object.freeze({
  mode: "initializing",
  phase: "loading",
  message: "正在读取 data/ 分类文件…",
  migratedCount: 0,
});

function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function publish(patch) {
  status = Object.freeze({ ...status, ...patch });
  listeners.forEach((listener) => listener());
}

async function request(url, options) {
  const response = await globalThis.fetch(url, {
    cache: "no-store",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "本地数据文件请求失败。");
  return payload;
}

function refreshWriteStatus() {
  if (failedWrites.size) {
    publish({
      phase: "error",
      message: `有 ${failedWrites.size} 类数据尚未写入，请重试。`,
    });
  } else if (pendingWrites) {
    publish({ phase: "saving", message: "正在保存到 data/…" });
  } else {
    publish({ phase: "saved", message: "全部数据已保存到 data/。" });
  }
}

function queueDatasetWrite(storageKey, value, remove = false) {
  const dataset = FILE_DATASET_BY_STORAGE_KEY[storageKey];
  if (!fileMode || !dataset) return;
  pendingWrites += 1;
  refreshWriteStatus();
  writeQueue = writeQueue
    .catch(() => {})
    .then(async () => {
      try {
        await request(`/api/data/dataset/${dataset.id}`, {
          method: remove ? "DELETE" : "PUT",
          body: remove ? undefined : JSON.stringify({ value }),
        });
        failedWrites.delete(storageKey);
      } catch (error) {
        failedWrites.set(storageKey, { value, remove, error: error.message });
      } finally {
        pendingWrites -= 1;
        refreshWriteStatus();
      }
    });
}

const fileStorage = {
  getItem(key) {
    if (values.has(key)) return values.get(key);
    if (!FILE_DATASET_BY_STORAGE_KEY[key]) return browserStorage()?.getItem(key) ?? null;
    return null;
  },
  setItem(key, value) {
    const normalized = String(value);
    if (!FILE_DATASET_BY_STORAGE_KEY[key]) {
      browserStorage()?.setItem(key, normalized);
      return;
    }
    values.set(key, normalized);
    queueDatasetWrite(key, normalized);
  },
  removeItem(key) {
    if (!FILE_DATASET_BY_STORAGE_KEY[key]) {
      browserStorage()?.removeItem(key);
      return;
    }
    values.delete(key);
    queueDatasetWrite(key, null, true);
  },
};

export function getAppStorage() {
  if (fileMode) return fileStorage;
  return browserStorage();
}

export async function initializeFilePersistence() {
  if (initialized) return status;
  initialized = true;

  try {
    const snapshot = await request("/api/data/snapshot");
    const legacy = browserStorage();
    const migrationValues = {};
    const legacyStorageKeys = [];
    const erroredDatasetIds = new Set((snapshot.errors ?? []).map((entry) => entry.dataset));

    for (const dataset of FILE_DATASETS) {
      const fileValue = snapshot.datasets?.[dataset.storageKey];
      if (typeof fileValue === "string") {
        values.set(dataset.storageKey, fileValue);
        continue;
      }
      const legacyValue = legacy?.getItem(dataset.storageKey);
      if (typeof legacyValue === "string") {
        values.set(dataset.storageKey, legacyValue);
        if (!erroredDatasetIds.has(dataset.id)) {
          migrationValues[dataset.storageKey] = legacyValue;
          legacyStorageKeys.push(dataset.storageKey);
        }
      }
    }

    let migratedCount = 0;
    if (Object.keys(migrationValues).length) {
      const migration = await request("/api/data/migrate", {
        method: "POST",
        body: JSON.stringify({ datasets: migrationValues, legacyStorageKeys }),
      });
      migratedCount = migration.migratedCount ?? 0;
    }

    fileMode = true;
    if (snapshot.errors?.length) {
      publish({
        mode: "file",
        phase: "error",
        message: `${snapshot.errors.length} 类数据文件无法读取，原文件已保留。`,
        migratedCount,
      });
    } else {
      publish({
        mode: "file",
        phase: "saved",
        message: migratedCount
          ? `已迁移 ${migratedCount} 类旧数据并保存到 data/。`
          : "全部数据从 data/ 分类文件读取。",
        migratedCount,
      });
    }
  } catch (error) {
    fileMode = false;
    publish({
      mode: "browser-fallback",
      phase: "error",
      message: `data/ 不可用，暂时读取浏览器旧数据：${error.message}`,
    });
  }
  return status;
}

export function getFilePersistenceStatus() {
  return status;
}

export function subscribeFilePersistence(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function retryFilePersistence() {
  if (!fileMode || !failedWrites.size) return;
  const retries = [...failedWrites.entries()];
  failedWrites.clear();
  retries.forEach(([key, entry]) => {
    queueDatasetWrite(key, entry.value, entry.remove);
  });
  await flushFilePersistence();
}

export async function flushFilePersistence() {
  await writeQueue.catch(() => {});
  return getFilePersistenceStatus();
}

export function resetFilePersistenceForTests() {
  values.clear();
  failedWrites.clear();
  initialized = false;
  fileMode = false;
  writeQueue = Promise.resolve();
  pendingWrites = 0;
  status = Object.freeze({
    mode: "initializing",
    phase: "loading",
    message: "正在读取 data/ 分类文件…",
    migratedCount: 0,
  });
}
