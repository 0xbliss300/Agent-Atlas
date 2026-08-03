import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSyncConfig,
  loadSyncConfig,
  saveSyncConfig,
  clearSyncConfig,
  isSyncConfigComplete,
  DEFAULT_SYNC_CONFIG,
  SYNC_CONFIG_STORAGE_KEY,
} from "./e2eSyncConfig.js";

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

test("normalizeSyncConfig 填充默认值并清理文本", () => {
  const normalized = normalizeSyncConfig({
    baseUrl: "  https://dav.example.com  ",
    basePath: "",
    username: "  user  ",
    filePath: "",
  });
  assert.equal(normalized.baseUrl, "https://dav.example.com");
  assert.equal(normalized.basePath, DEFAULT_SYNC_CONFIG.basePath);
  assert.equal(normalized.username, "user");
  assert.equal(normalized.filePath, DEFAULT_SYNC_CONFIG.filePath);
  assert.equal(normalized.deviceId, "");
  assert.equal(normalized.lastSyncedAt, "");
  assert.equal(normalized.autoSyncIntervalMin, 0);
});

test("normalizeSyncConfig autoSyncIntervalMin 限制范围", () => {
  assert.equal(normalizeSyncConfig({ autoSyncIntervalMin: 30 }).autoSyncIntervalMin, 30);
  assert.equal(normalizeSyncConfig({ autoSyncIntervalMin: -5 }).autoSyncIntervalMin, 0);
  assert.equal(normalizeSyncConfig({ autoSyncIntervalMin: 2000 }).autoSyncIntervalMin, 1440);
  assert.equal(normalizeSyncConfig({ autoSyncIntervalMin: "abc" }).autoSyncIntervalMin, 0);
});

test("loadSyncConfig 无存储时返回默认配置", () => {
  const { config, error } = loadSyncConfig(null);
  assert.deepEqual(config, DEFAULT_SYNC_CONFIG);
  assert.equal(error, null);
});

test("saveSyncConfig 与 loadSyncConfig 往返一致", () => {
  const storage = createMemoryStorage();
  const config = {
    baseUrl: "https://dav.example.com",
    basePath: "/atlas/",
    username: "user",
    filePath: "/sync.json",
    deviceId: "dev-1",
    lastSyncedAt: "2026-08-03T10:00:00.000Z",
    autoSyncIntervalMin: 30,
  };
  const saved = saveSyncConfig(config, storage);
  assert.equal(saved.baseUrl, "https://dav.example.com");

  const { config: loaded, error } = loadSyncConfig(storage);
  assert.equal(error, null);
  assert.equal(loaded.baseUrl, "https://dav.example.com");
  assert.equal(loaded.deviceId, "dev-1");
  assert.equal(loaded.lastSyncedAt, "2026-08-03T10:00:00.000Z");
  assert.equal(loaded.autoSyncIntervalMin, 30);
});

test("loadSyncConfig 损坏数据返回默认配置与错误", () => {
  const storage = createMemoryStorage();
  storage.setItem(SYNC_CONFIG_STORAGE_KEY, "not json");
  const { config, error } = loadSyncConfig(storage);
  assert.deepEqual(config, DEFAULT_SYNC_CONFIG);
  assert.ok(error);
});

test("loadSyncConfig schema 版本不匹配返回默认配置", () => {
  const storage = createMemoryStorage();
  storage.setItem(SYNC_CONFIG_STORAGE_KEY, JSON.stringify({ schemaVersion: 99, config: {} }));
  const { config, error } = loadSyncConfig(storage);
  assert.deepEqual(config, DEFAULT_SYNC_CONFIG);
  assert.ok(error);
});

test("clearSyncConfig 移除存储项", () => {
  const storage = createMemoryStorage();
  saveSyncConfig({ baseUrl: "https://dav.example.com" }, storage);
  assert.equal(storage.getItem(SYNC_CONFIG_STORAGE_KEY) !== null, true);
  clearSyncConfig(storage);
  assert.equal(storage.getItem(SYNC_CONFIG_STORAGE_KEY), null);
});

test("isSyncConfigComplete 检查必填字段", () => {
  assert.equal(isSyncConfigComplete({ baseUrl: "https://dav.example.com", filePath: "/x" }), true);
  assert.equal(isSyncConfigComplete({ baseUrl: "", filePath: "/x" }), false);
  assert.equal(isSyncConfigComplete({ baseUrl: "https://dav.example.com", filePath: "" }), false);
  assert.equal(isSyncConfigComplete({}), false);
});
