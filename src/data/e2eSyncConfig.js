import { getAppStorage } from "./filePersistence.js";

export const SYNC_CONFIG_STORAGE_KEY = "agent-project-showcase.e2e-sync-config.v1";
export const SYNC_CONFIG_SCHEMA_VERSION = 1;

export const DEFAULT_SYNC_CONFIG = Object.freeze({
  baseUrl: "",
  basePath: "/agent-atlas/",
  username: "",
  filePath: "/sync.enc.json",
  deviceId: "",
  lastSyncedAt: "",
  autoSyncIntervalMin: 0,
});

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeSyncConfig(value = {}) {
  return {
    baseUrl: cleanText(value.baseUrl),
    basePath: cleanText(value.basePath) || DEFAULT_SYNC_CONFIG.basePath,
    username: cleanText(value.username),
    filePath: cleanText(value.filePath) || DEFAULT_SYNC_CONFIG.filePath,
    deviceId: cleanText(value.deviceId),
    lastSyncedAt: cleanText(value.lastSyncedAt),
    autoSyncIntervalMin:
      Number.isFinite(value.autoSyncIntervalMin) && value.autoSyncIntervalMin >= 0
        ? Math.min(Math.floor(value.autoSyncIntervalMin), 1440)
        : 0,
  };
}

export function loadSyncConfig(storage = getAppStorage()) {
  if (!storage) return { config: { ...DEFAULT_SYNC_CONFIG }, error: null };
  try {
    const raw = storage.getItem(SYNC_CONFIG_STORAGE_KEY);
    if (!raw) return { config: { ...DEFAULT_SYNC_CONFIG }, error: null };
    const payload = JSON.parse(raw);
    if (payload.schemaVersion !== SYNC_CONFIG_SCHEMA_VERSION) {
      throw new Error("unsupported-sync-config-schema");
    }
    return { config: normalizeSyncConfig(payload.config), error: null };
  } catch {
    return {
      config: { ...DEFAULT_SYNC_CONFIG },
      error: "同步配置无法读取，已恢复默认值。",
    };
  }
}

export function saveSyncConfig(config, storage = getAppStorage()) {
  if (!storage) throw new Error("当前浏览器不支持本地配置存储。");
  const normalized = normalizeSyncConfig(config);
  storage.setItem(
    SYNC_CONFIG_STORAGE_KEY,
    JSON.stringify({ schemaVersion: SYNC_CONFIG_SCHEMA_VERSION, config: normalized }),
  );
  return normalized;
}

export function clearSyncConfig(storage = getAppStorage()) {
  if (!storage) return;
  storage.removeItem(SYNC_CONFIG_STORAGE_KEY);
}

/**
 * 校验同步配置是否完整可用。
 * 注意：密码不保存在配置中，由用户在每次同步时输入或保存在会话内存中。
 */
export function isSyncConfigComplete(config) {
  const normalized = normalizeSyncConfig(config);
  return Boolean(normalized.baseUrl && normalized.filePath);
}
