import test from "node:test";
import assert from "node:assert/strict";
import {
  clearRecentAccess,
  loadRecentAccess,
  normalizeRecentAccess,
  RECENT_ACCESS_MAX_ENTRIES,
  RECENT_ACCESS_STORAGE_KEY,
  recordRecentAccess,
  saveRecentAccess,
} from "./recentAccess.js";

function storage(initial = null) {
  return {
    value: initial,
    getItem(key) {
      return key === RECENT_ACCESS_STORAGE_KEY ? this.value : null;
    },
    setItem(key, value) {
      if (key === RECENT_ACCESS_STORAGE_KEY) this.value = value;
    },
  };
}

test("空存储返回空记录且无错误", () => {
  const result = loadRecentAccess(storage());
  assert.deepEqual(result.entries, []);
  assert.equal(result.error, null);
});

test("保存与读取最近访问记录往返一致", () => {
  const memory = storage();
  const entries = [
    { projectId: "p-1", accessedAt: "2026-07-28T10:00:00.000Z" },
    { projectId: "p-2", accessedAt: "2026-07-28T11:00:00.000Z" },
  ];
  saveRecentAccess(entries, memory);
  const restored = loadRecentAccess(memory).entries;
  assert.deepEqual(restored, entries);
});

test("损坏 JSON 安全降级为空并返回错误", () => {
  const result = loadRecentAccess(storage("{broken"));
  assert.deepEqual(result.entries, []);
  assert.ok(result.error);
});

test("schemaVersion 不匹配视为损坏", () => {
  const memory = storage(
    JSON.stringify({ schemaVersion: 999, entries: [{ projectId: "p-1", accessedAt: "x" }] }),
  );
  const result = loadRecentAccess(memory);
  assert.deepEqual(result.entries, []);
  assert.ok(result.error);
});

test("recordRecentAccess 将新项目插入最前", () => {
  const base = [{ projectId: "p-1", accessedAt: "2026-07-28T10:00:00.000Z" }];
  const next = recordRecentAccess(base, "p-2", new Date("2026-07-28T11:00:00.000Z"));
  assert.deepEqual(
    next.map((entry) => entry.projectId),
    ["p-2", "p-1"],
  );
});

test("recordRecentAccess 重复访问同项目时移到最前并去重", () => {
  const base = [
    { projectId: "p-1", accessedAt: "2026-07-28T10:00:00.000Z" },
    { projectId: "p-2", accessedAt: "2026-07-28T09:00:00.000Z" },
  ];
  const next = recordRecentAccess(base, "p-2", new Date("2026-07-28T12:00:00.000Z"));
  assert.deepEqual(
    next.map((entry) => entry.projectId),
    ["p-2", "p-1"],
  );
  assert.equal(next.length, 2);
});

test("recordRecentAccess 超过上限时裁剪最旧条目", () => {
  const base = Array.from({ length: RECENT_ACCESS_MAX_ENTRIES }, (_, index) => ({
    projectId: `p-${index}`,
    accessedAt: new Date(2026, 6, 1, 0, index).toISOString(),
  }));
  const next = recordRecentAccess(base, "p-new", new Date("2026-07-28T23:00:00.000Z"));
  assert.equal(next.length, RECENT_ACCESS_MAX_ENTRIES);
  assert.equal(next[0].projectId, "p-new");
  assert.equal(next[next.length - 1].projectId, "p-1");
});

test("normalizeRecentAccess 过滤无效条目并保留每个项目的最新时间", () => {
  const messy = [
    { projectId: "p-1", accessedAt: "2026-07-28T10:00:00.000Z" },
    { projectId: "p-1", accessedAt: "2026-07-28T12:00:00.000Z" },
    { projectId: "", accessedAt: "2026-07-28T10:00:00.000Z" },
    { projectId: "p-2", accessedAt: "not-a-date" },
    null,
    "garbage",
    { projectId: "p-3", accessedAt: "2026-07-28T11:00:00.000Z" },
  ];
  const normalized = normalizeRecentAccess(messy);
  assert.deepEqual(
    normalized.map((entry) => entry.projectId),
    ["p-1", "p-3"],
  );
  assert.equal(normalized[0].accessedAt, "2026-07-28T12:00:00.000Z");
});

test("clearRecentAccess 写入空数组并清空存储", () => {
  const memory = storage();
  saveRecentAccess([{ projectId: "p-1", accessedAt: "2026-07-28T10:00:00.000Z" }], memory);
  clearRecentAccess(memory);
  const restored = loadRecentAccess(memory).entries;
  assert.deepEqual(restored, []);
});

test("recordRecentAccess 忽略空 projectId", () => {
  const base = [{ projectId: "p-1", accessedAt: "2026-07-28T10:00:00.000Z" }];
  const next = recordRecentAccess(base, "");
  assert.deepEqual(next, base);
});
