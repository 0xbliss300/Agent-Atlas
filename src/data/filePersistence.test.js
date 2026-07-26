import assert from "node:assert/strict";
import test from "node:test";
import {
  flushFilePersistence,
  getAppStorage,
  getFilePersistenceStatus,
  initializeFilePersistence,
  resetFilePersistenceForTests,
  retryFilePersistence,
} from "./filePersistence.js";
import { PROJECT_STORAGE_KEY } from "./projects.js";
import { SETTINGS_STORAGE_KEY } from "./settings.js";

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function response(payload, ok = true) {
  return { ok, json: async () => payload };
}

async function withGlobals(storage, fetchMock, run) {
  const previousStorage = globalThis.localStorage;
  const previousFetch = globalThis.fetch;
  globalThis.localStorage = storage;
  globalThis.fetch = fetchMock;
  resetFilePersistenceForTests();
  try {
    await run();
  } finally {
    resetFilePersistenceForTests();
    globalThis.localStorage = previousStorage;
    globalThis.fetch = previousFetch;
  }
}

test("文件快照优先于浏览器旧数据", async () => {
  const fileProjects = JSON.stringify({ schemaVersion: 1, projects: [{ id: "file" }] });
  const legacyProjects = JSON.stringify({ schemaVersion: 1, projects: [{ id: "legacy" }] });
  await withGlobals(
    createStorage({ [PROJECT_STORAGE_KEY]: legacyProjects }),
    async () =>
      response({
        schemaVersion: 1,
        datasets: { [PROJECT_STORAGE_KEY]: fileProjects },
        errors: [],
      }),
    async () => {
      await initializeFilePersistence();
      assert.equal(getAppStorage().getItem(PROJECT_STORAGE_KEY), fileProjects);
      assert.equal(getFilePersistenceStatus().mode, "file");
    },
  );
});

test("缺失的文件分类从 localStorage 迁移且保留旧数据", async () => {
  const legacySettings = JSON.stringify({ schemaVersion: 1, settings: { density: "compact" } });
  const storage = createStorage({ [SETTINGS_STORAGE_KEY]: legacySettings });
  const calls = [];
  await withGlobals(
    storage,
    async (url, options = {}) => {
      calls.push({ url, options });
      if (url === "/api/data/snapshot") {
        return response({ schemaVersion: 1, datasets: {}, errors: [] });
      }
      return response({ migratedCount: 1 });
    },
    async () => {
      await initializeFilePersistence();
      assert.equal(getAppStorage().getItem(SETTINGS_STORAGE_KEY), legacySettings);
      assert.equal(storage.getItem(SETTINGS_STORAGE_KEY), legacySettings);
      assert.equal(getFilePersistenceStatus().migratedCount, 1);
      assert.equal(calls[1].url, "/api/data/migrate");
    },
  );
});

test("运行时写入按分类发送到文件 API 并报告已保存", async () => {
  const calls = [];
  await withGlobals(
    createStorage(),
    async (url, options = {}) => {
      calls.push({ url, options });
      if (url === "/api/data/snapshot") {
        return response({ schemaVersion: 1, datasets: {}, errors: [] });
      }
      return response({ ok: true });
    },
    async () => {
      await initializeFilePersistence();
      const next = JSON.stringify({ schemaVersion: 1, projects: [] });
      getAppStorage().setItem(PROJECT_STORAGE_KEY, next);
      await flushFilePersistence();

      assert.equal(calls[1].url, "/api/data/dataset/projects");
      assert.equal(calls[1].options.method, "PUT");
      assert.deepEqual(JSON.parse(calls[1].options.body), { value: next });
      assert.equal(getFilePersistenceStatus().phase, "saved");
    },
  );
});

test("写入失败会保留内存数据并可显式重试", async () => {
  let writes = 0;
  await withGlobals(
    createStorage(),
    async (url) => {
      if (url === "/api/data/snapshot") {
        return response({ schemaVersion: 1, datasets: {}, errors: [] });
      }
      writes += 1;
      return writes === 1 ? response({ error: "disk busy" }, false) : response({ ok: true });
    },
    async () => {
      await initializeFilePersistence();
      const next = JSON.stringify({ schemaVersion: 1, projects: [] });
      getAppStorage().setItem(PROJECT_STORAGE_KEY, next);
      await flushFilePersistence();
      assert.equal(getFilePersistenceStatus().phase, "error");
      assert.equal(getAppStorage().getItem(PROJECT_STORAGE_KEY), next);

      await retryFilePersistence();
      assert.equal(getFilePersistenceStatus().phase, "saved");
      assert.equal(writes, 2);
    },
  );
});
