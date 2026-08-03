import { analyzeLocalDirectory } from "./localStatus.js";

export const AUTO_SYNC_POLL_INTERVAL_MS = 30000;

/**
 * 计算同步结果的签名，用于判断是否有实际变化。
 * 签名包含 Git 提交、分支、项目 updatedAt 与读取的文件列表。
 */
function computeSignature(syncResult) {
  const parts = [];
  if (syncResult?.git?.commit) parts.push(`commit:${syncResult.git.commit}`);
  if (syncResult?.git?.branch) parts.push(`branch:${syncResult.git.branch}`);
  if (syncResult?.project?.updatedAt) parts.push(`updated:${syncResult.project.updatedAt}`);
  const files = syncResult?.filesRead ?? [];
  if (files.length) parts.push(`files:${[...files].sort().join(",")}`);
  return parts.join("|");
}

/**
 * 创建自动同步管理器。
 *
 * 监听机制优先使用浏览器 FileSystemObserver API；
 * 不可用时回退到定时轮询（对比签名变化）。
 *
 * 目录句柄仅保存在内存中，不持久化到磁盘；
 * 关闭监听或页面刷新后自动释放。
 */
export function createAutoSyncManager({
  FileSystemObserverImpl = typeof globalThis.FileSystemObserver !== "undefined"
    ? globalThis.FileSystemObserver
    : null,
  setIntervalImpl = globalThis.setInterval?.bind(globalThis),
  clearIntervalImpl = globalThis.clearInterval?.bind(globalThis),
  analyzeImpl = analyzeLocalDirectory,
  pollIntervalMs = AUTO_SYNC_POLL_INTERVAL_MS,
} = {}) {
  const watchers = new Map();

  const unwatch = (projectId) => {
    const entry = watchers.get(projectId);
    if (!entry) return;
    entry.dispose?.();
    watchers.delete(projectId);
  };

  const performSync = async (entry) => {
    try {
      const syncResult = await analyzeImpl(entry.handle);
      const signature = computeSignature(syncResult);
      if (signature === entry.lastSignature) return;
      entry.lastSignature = signature;
      await entry.onSync?.(syncResult);
    } catch (error) {
      await entry.onError?.(error);
    }
  };

  /**
   * 开始监听指定项目的目录。
   * 会先读取一次以建立基线签名，之后仅在签名变化时触发 onSync。
   */
  const watch = async (projectId, directoryHandle, { onSync, onError } = {}) => {
    unwatch(projectId);

    let baselineSignature = "";
    try {
      const baseline = await analyzeImpl(directoryHandle);
      baselineSignature = computeSignature(baseline);
    } catch (error) {
      await onError?.(error);
      throw error;
    }

    const entry = {
      handle: directoryHandle,
      onSync,
      onError,
      lastSignature: baselineSignature,
      observer: null,
      interval: null,
      dispose: null,
    };

    if (FileSystemObserverImpl) {
      const observer = new FileSystemObserverImpl(async () => {
        await performSync(entry);
      });
      observer.observe(directoryHandle);
      entry.observer = observer;
      entry.dispose = () => observer.disconnect();
    } else if (setIntervalImpl && clearIntervalImpl) {
      entry.interval = setIntervalImpl(() => {
        performSync(entry).catch(() => {});
      }, pollIntervalMs);
      entry.dispose = () => clearIntervalImpl(entry.interval);
    } else {
      throw new Error("当前环境不支持目录监听（需要 FileSystemObserver 或定时器）。");
    }

    watchers.set(projectId, entry);
  };

  const isWatching = (projectId) => watchers.has(projectId);

  const getWatchedProjects = () => Array.from(watchers.keys());

  const unwatchAll = () => {
    for (const projectId of Array.from(watchers.keys())) {
      unwatch(projectId);
    }
  };

  return { watch, unwatch, isWatching, getWatchedProjects, unwatchAll };
}

export { computeSignature };
