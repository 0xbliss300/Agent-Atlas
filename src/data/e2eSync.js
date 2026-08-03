import { createAppBackup, importAppBackup } from "./backup.js";
import { decryptJson, encryptJson, generateDeviceId } from "./crypto.js";
import { downloadFile, uploadFile } from "./webdavClient.js";

export const SYNC_PAYLOAD_VERSION = 1;

/**
 * 构建端到端加密的同步载荷。
 *
 * 载荷结构（加密前）：
 * {
 *   v: 1,
 *   deviceId,            // 发起同步的设备标识
 *   pushedAt,            // ISO 时间戳
 *   backup               // 复用 createAppBackup 的完整 JSON 字符串（解析为对象）
 * }
 *
 * 加密后通过 WebDAV 上传，远端只看到密文。
 */
export async function buildSyncPayload(
  { projects, notes, histories, events, templates, collections, trashEntries, evaluations },
  { deviceId, now = new Date() } = {},
) {
  const backupText = createAppBackup(
    projects,
    notes,
    histories,
    events,
    templates,
    collections,
    trashEntries,
    evaluations,
  );
  return {
    v: SYNC_PAYLOAD_VERSION,
    deviceId: deviceId || generateDeviceId(),
    pushedAt: now.toISOString(),
    backup: JSON.parse(backupText),
  };
}

export async function encryptSyncPayload(payload, password) {
  return encryptJson(payload, password);
}

export async function decryptSyncPayload(encryptedPayload, password) {
  const payload = await decryptJson(encryptedPayload, password);
  if (!payload || payload.v !== SYNC_PAYLOAD_VERSION) {
    throw new Error(`不支持的同步载荷版本：${payload?.v}。`);
  }
  if (!payload.backup) {
    throw new Error("同步载荷缺少备份数据。");
  }
  return payload;
}

/**
 * 合并远端载荷与本地数据。
 *
 * 冲突策略：
 * - 项目/笔记/模板/集合：以 ID 去重，远端与本地都保留，冲突时保留双方并生成副本名（沿用 importAppBackup 的合并语义）。
 * - 版本历史/事件/评测：以 ID 合并去重。
 * - 回收站：以条目 ID 去重，保留较新的删除时间。
 * - 最后写入胜出：对于 updatedAt 更新的同类项优先（具体合并交由 importAppBackup）。
 *
 * 返回合并后的导入结果。
 */
export function mergeRemotePayload(remotePayload, localStores, { strategy = "merge" } = {}) {
  if (strategy !== "merge" && strategy !== "replace") {
    throw new Error(`未知的同步策略：${strategy}。`);
  }
  const remoteBackupText = JSON.stringify(remotePayload.backup);
  return importAppBackup(
    remoteBackupText,
    localStores.projects ?? [],
    localStores.notes ?? [],
    strategy,
    localStores.histories ?? [],
    localStores.events ?? [],
    localStores.templates ?? [],
    localStores.collections ?? [],
    localStores.trashEntries ?? [],
    localStores.evaluations ?? [],
  );
}

/**
 * 判断远端载荷是否比本地更新（基于 pushedAt）。
 */
export function isRemoteNewer(remotePayload, lastSyncedAt) {
  if (!lastSyncedAt) return true;
  const remoteTime = Date.parse(remotePayload.pushedAt ?? "");
  const localTime = Date.parse(lastSyncedAt);
  if (!Number.isFinite(remoteTime)) return false;
  if (!Number.isFinite(localTime)) return true;
  return remoteTime > localTime;
}

/**
 * 推送本地数据到远端（加密上传）。
 * @param {object} stores - 本地数据存储
 * @param {object} syncConfig - 同步配置（baseUrl/basePath/username/filePath/deviceId）
 * @param {string} password - 加密口令（不保存到配置）
 * @param {object} options - 可选 fetchImpl、now
 * @returns {Promise<{pushedAt: string, deviceId: string}>}
 */
export async function pushToRemote(stores, syncConfig, password, options = {}) {
  const { fetchImpl = globalThis.fetch, now = new Date() } = options;
  if (!password) throw new Error("请输入加密口令。");
  const payload = await buildSyncPayload(stores, {
    deviceId: syncConfig.deviceId,
    now,
  });
  const encrypted = await encryptSyncPayload(payload, password);
  await uploadFile(
    {
      baseUrl: syncConfig.baseUrl,
      basePath: syncConfig.basePath,
      username: syncConfig.username,
      password,
    },
    syncConfig.filePath,
    JSON.stringify(encrypted),
    { fetchImpl },
  );
  return { pushedAt: payload.pushedAt, deviceId: payload.deviceId };
}

/**
 * 从远端拉取并合并到本地（解密 + 合并）。
 * @param {object} stores - 本地数据存储
 * @param {object} syncConfig - 同步配置
 * @param {string} password - 加密口令
 * @param {object} options - 可选 fetchImpl、strategy
 * @returns {Promise<{result: object, remotePayload: object}>}
 */
export async function pullFromRemote(stores, syncConfig, password, options = {}) {
  const { fetchImpl = globalThis.fetch, strategy = "merge" } = options;
  if (!password) throw new Error("请输入加密口令。");
  const encryptedText = await downloadFile(
    {
      baseUrl: syncConfig.baseUrl,
      basePath: syncConfig.basePath,
      username: syncConfig.username,
      password,
    },
    syncConfig.filePath,
    { fetchImpl },
  );
  let encryptedPayload;
  try {
    encryptedPayload = JSON.parse(encryptedText);
  } catch {
    throw new Error("远端载荷不是有效的 JSON。");
  }
  const remotePayload = await decryptSyncPayload(encryptedPayload, password);
  const result = mergeRemotePayload(remotePayload, stores, { strategy });
  return { result, remotePayload };
}

export { createAppBackup, importAppBackup };
