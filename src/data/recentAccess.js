import { getAppStorage } from "./filePersistence.js";

export const RECENT_ACCESS_SCHEMA_VERSION = 1;
export const RECENT_ACCESS_STORAGE_KEY = "agent-project-showcase.recent-access.v1";
export const RECENT_ACCESS_MAX_ENTRIES = 8;

/**
 * 规范化最近访问记录：
 * - 仅保留 {projectId, accessedAt} 形态且 accessedAt 可解析为时间的条目；
 * - 同一 projectId 仅保留最新一条；
 * - 按 accessedAt 倒序排列；
 * - 上限 RECENT_ACCESS_MAX_ENTRIES，超出按时间升序裁剪。
 */
export function normalizeRecentAccess(entries = []) {
  if (!Array.isArray(entries)) return [];
  const seen = new Map();
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const projectId = typeof entry.projectId === "string" ? entry.projectId : "";
    if (!projectId) continue;
    const accessedAt =
      entry.accessedAt instanceof Date
        ? entry.accessedAt.toISOString()
        : typeof entry.accessedAt === "string"
          ? entry.accessedAt
          : "";
    if (!accessedAt) continue;
    const parsed = Date.parse(accessedAt);
    if (!Number.isFinite(parsed)) continue;
    const previous = seen.get(projectId);
    if (!previous || parsed > previous.parsed) {
      seen.set(projectId, { projectId, accessedAt, parsed });
    }
  }
  return [...seen.values()]
    .sort((left, right) => right.parsed - left.parsed)
    .slice(0, RECENT_ACCESS_MAX_ENTRIES)
    .map(({ projectId, accessedAt }) => ({ projectId, accessedAt }));
}

export function loadRecentAccess(storage = getAppStorage()) {
  if (!storage) return { entries: [], error: null };
  try {
    const raw = storage.getItem(RECENT_ACCESS_STORAGE_KEY);
    if (!raw) return { entries: [], error: null };
    const payload = JSON.parse(raw);
    if (payload.schemaVersion !== RECENT_ACCESS_SCHEMA_VERSION)
      throw new Error("unsupported-recent-access-schema");
    return { entries: normalizeRecentAccess(payload.entries), error: null };
  } catch {
    return { entries: [], error: "最近访问记录无法读取，已清空。" };
  }
}

export function saveRecentAccess(entries, storage = getAppStorage()) {
  if (!storage) throw new Error("当前浏览器不支持本地存储。");
  const normalized = normalizeRecentAccess(entries);
  storage.setItem(
    RECENT_ACCESS_STORAGE_KEY,
    JSON.stringify({ schemaVersion: RECENT_ACCESS_SCHEMA_VERSION, entries: normalized }),
  );
  return normalized;
}

/**
 * 记录一次项目访问。返回新的数组；若输入已包含同 projectId 的最新条目，
 * 仍会更新时间戳并移到最前。
 */
export function recordRecentAccess(entries = [], projectId, accessedAt = new Date()) {
  if (!projectId || typeof projectId !== "string") return normalizeRecentAccess(entries);
  const timestamp = accessedAt instanceof Date ? accessedAt.toISOString() : String(accessedAt);
  if (!Number.isFinite(Date.parse(timestamp))) return normalizeRecentAccess(entries);
  const filtered = normalizeRecentAccess(entries).filter((entry) => entry.projectId !== projectId);
  const next = [{ projectId, accessedAt: timestamp }, ...filtered];
  return normalizeRecentAccess(next);
}

export function clearRecentAccess(storage = getAppStorage()) {
  if (!storage) return [];
  saveRecentAccess([], storage);
  return [];
}
