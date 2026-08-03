import test from "node:test";
import assert from "node:assert/strict";
import { computeSignature, createAutoSyncManager } from "./autoSync.js";

function makeSyncResult(overrides = {}) {
  return {
    sourceName: "demo",
    git: { branch: "main", commit: "abc123", updatedAt: null, filesRead: [], size: 0 },
    filesRead: ["README.md", "package.json"],
    project: { updatedAt: "2026-08-03T10:00:00+08:00" },
    ...overrides,
  };
}

function mockDirectoryHandle() {
  return { name: "demo-project", kind: "directory" };
}

function createMockObserver() {
  const instances = [];
  class MockObserver {
    constructor(callback) {
      this.callback = callback;
      this.observed = [];
      this.disconnected = false;
      instances.push(this);
    }
    observe(handle) {
      this.observed.push(handle);
    }
    disconnect() {
      this.disconnected = true;
    }
    trigger() {
      this.callback([]);
    }
  }
  MockObserver.instances = instances;
  return MockObserver;
}

test("computeSignature 基于 Git 提交、分支、updatedAt 与文件列表", () => {
  const sig1 = computeSignature(makeSyncResult());
  const sig2 = computeSignature(makeSyncResult());
  assert.equal(sig1, sig2);

  const changedCommit = computeSignature(
    makeSyncResult({ git: { branch: "main", commit: "def456" } }),
  );
  assert.notEqual(sig1, changedCommit);

  const changedFiles = computeSignature({ ...makeSyncResult(), filesRead: ["README.md"] });
  assert.notEqual(sig1, changedFiles);

  assert.equal(computeSignature(null), "");
  assert.equal(computeSignature({}), "");
});

test("watch 后 isWatching 返回 true，unwatch 后返回 false", async () => {
  const MockObserver = createMockObserver();
  const manager = createAutoSyncManager({
    FileSystemObserverImpl: MockObserver,
    analyzeImpl: async () => makeSyncResult(),
  });
  const handle = mockDirectoryHandle();

  assert.equal(manager.isWatching("p1"), false);
  await manager.watch("p1", handle, { onSync: () => {} });
  assert.equal(manager.isWatching("p1"), true);
  assert.equal(MockObserver.instances.length, 1);
  assert.equal(MockObserver.instances[0].observed.length, 1);

  manager.unwatch("p1");
  assert.equal(manager.isWatching("p1"), false);
  assert.equal(MockObserver.instances[0].disconnected, true);
});

test("getWatchedProjects 返回当前监听的项目 ID 列表", async () => {
  const MockObserver = createMockObserver();
  const manager = createAutoSyncManager({
    FileSystemObserverImpl: MockObserver,
    analyzeImpl: async () => makeSyncResult(),
  });

  assert.deepEqual(manager.getWatchedProjects(), []);
  await manager.watch("p1", mockDirectoryHandle(), { onSync: () => {} });
  await manager.watch("p2", mockDirectoryHandle(), { onSync: () => {} });
  assert.deepEqual(manager.getWatchedProjects(), ["p1", "p2"]);

  manager.unwatch("p1");
  assert.deepEqual(manager.getWatchedProjects(), ["p2"]);
});

test("文件变化触发 onSync，无变化时不触发", async () => {
  const MockObserver = createMockObserver();
  let callCount = 0;
  let currentResult = makeSyncResult();
  const manager = createAutoSyncManager({
    FileSystemObserverImpl: MockObserver,
    analyzeImpl: async () => currentResult,
  });

  await manager.watch("p1", mockDirectoryHandle(), {
    onSync: () => {
      callCount += 1;
    },
  });

  MockObserver.instances[0].trigger();
  await Promise.resolve();
  assert.equal(callCount, 0);

  currentResult = makeSyncResult({
    git: { branch: "main", commit: "def456" },
  });
  MockObserver.instances[0].trigger();
  await Promise.resolve();
  assert.equal(callCount, 1);

  MockObserver.instances[0].trigger();
  await Promise.resolve();
  assert.equal(callCount, 1);
});

test("关闭后不再触发 onSync", async () => {
  const MockObserver = createMockObserver();
  let callCount = 0;
  let currentResult = makeSyncResult();
  const manager = createAutoSyncManager({
    FileSystemObserverImpl: MockObserver,
    analyzeImpl: async () => currentResult,
  });

  await manager.watch("p1", mockDirectoryHandle(), {
    onSync: () => {
      callCount += 1;
    },
  });

  manager.unwatch("p1");

  currentResult = makeSyncResult({ git: { branch: "main", commit: "new" } });
  MockObserver.instances[0].trigger();
  await Promise.resolve();
  assert.equal(callCount, 0);
});

test("unwatchAll 清理所有监听", async () => {
  const MockObserver = createMockObserver();
  const manager = createAutoSyncManager({
    FileSystemObserverImpl: MockObserver,
    analyzeImpl: async () => makeSyncResult(),
  });

  await manager.watch("p1", mockDirectoryHandle(), { onSync: () => {} });
  await manager.watch("p2", mockDirectoryHandle(), { onSync: () => {} });
  assert.equal(manager.getWatchedProjects().length, 2);

  manager.unwatchAll();
  assert.equal(manager.getWatchedProjects().length, 0);
  assert.equal(MockObserver.instances[0].disconnected, true);
  assert.equal(MockObserver.instances[1].disconnected, true);
});

test("初始读取失败时调用 onError 并抛出", async () => {
  const MockObserver = createMockObserver();
  let errorCaught = null;
  const manager = createAutoSyncManager({
    FileSystemObserverImpl: MockObserver,
    analyzeImpl: async () => {
      throw new Error("目录不可读");
    },
  });

  await assert.rejects(
    manager.watch("p1", mockDirectoryHandle(), {
      onError: (error) => {
        errorCaught = error;
      },
    }),
    /目录不可读/,
  );
  assert.ok(errorCaught);
  assert.equal(manager.isWatching("p1"), false);
});

test("轮询回退：无 FileSystemObserver 时使用 setInterval", async () => {
  const intervals = [];
  const manager = createAutoSyncManager({
    FileSystemObserverImpl: null,
    setIntervalImpl: (fn, ms) => {
      const id = intervals.length;
      intervals.push({ fn, ms });
      return id;
    },
    clearIntervalImpl: (id) => {
      intervals[id] = null;
    },
    analyzeImpl: async () => makeSyncResult(),
    pollIntervalMs: 1000,
  });

  await manager.watch("p1", mockDirectoryHandle(), { onSync: () => {} });
  assert.equal(intervals.length, 1);
  assert.equal(intervals[0].ms, 1000);
  assert.equal(manager.isWatching("p1"), true);

  manager.unwatch("p1");
  assert.equal(intervals[0], null);
  assert.equal(manager.isWatching("p1"), false);
});

test("轮询回退：签名变化时触发 onSync", async () => {
  let callCount = 0;
  let currentResult = makeSyncResult();
  let intervalFn = null;
  const manager = createAutoSyncManager({
    FileSystemObserverImpl: null,
    setIntervalImpl: (fn) => {
      intervalFn = fn;
      return 0;
    },
    clearIntervalImpl: () => {},
    analyzeImpl: async () => currentResult,
    pollIntervalMs: 100,
  });

  await manager.watch("p1", mockDirectoryHandle(), {
    onSync: () => {
      callCount += 1;
    },
  });

  intervalFn();
  await Promise.resolve();
  assert.equal(callCount, 0);

  currentResult = makeSyncResult({ git: { branch: "main", commit: "changed" } });
  intervalFn();
  await Promise.resolve();
  assert.equal(callCount, 1);

  intervalFn();
  await Promise.resolve();
  assert.equal(callCount, 1);
});

test("watch 同一项目时先停止旧监听再建立新监听", async () => {
  const MockObserver = createMockObserver();
  const manager = createAutoSyncManager({
    FileSystemObserverImpl: MockObserver,
    analyzeImpl: async () => makeSyncResult(),
  });

  await manager.watch("p1", mockDirectoryHandle(), { onSync: () => {} });
  const firstObserver = MockObserver.instances[0];
  await manager.watch("p1", mockDirectoryHandle(), { onSync: () => {} });

  assert.equal(MockObserver.instances.length, 2);
  assert.equal(firstObserver.disconnected, true);
  assert.equal(MockObserver.instances[1].disconnected, false);
  assert.equal(manager.isWatching("p1"), true);
});

test("onError 在监听期间出错时被调用", async () => {
  const MockObserver = createMockObserver();
  let errorCaught = null;
  let shouldFail = false;
  const manager = createAutoSyncManager({
    FileSystemObserverImpl: MockObserver,
    analyzeImpl: async () => {
      if (shouldFail) throw new Error("读取中断");
      return makeSyncResult();
    },
  });

  await manager.watch("p1", mockDirectoryHandle(), {
    onSync: () => {},
    onError: (error) => {
      errorCaught = error;
    },
  });

  shouldFail = true;
  MockObserver.instances[0].trigger();
  await Promise.resolve();
  assert.ok(errorCaught);
  assert.match(errorCaught.message, /读取中断/);
});
