import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  selectVisibleProjects,
  SETTINGS_STORAGE_KEY,
} from "./settings.js";
function storage(initial = null) {
  return {
    value: initial,
    getItem(key) {
      return key === SETTINGS_STORAGE_KEY ? this.value : null;
    },
    setItem(key, value) {
      if (key === SETTINGS_STORAGE_KEY) this.value = value;
    },
  };
}

const projects = [
  {
    id: "done",
    name: "归档项目",
    status: "done",
    progress: 100,
    updatedTimestamp: 10,
    technology: { frameworks: ["React"] },
    tags: ["归档"],
    collectionIds: [],
    pinned: false,
  },
  {
    id: "active-low",
    name: "客服 Agent",
    short: "本地知识库",
    status: "active",
    progress: 20,
    updatedTimestamp: 30,
    technology: { models: ["GPT-5"] },
    tags: ["Agent", "本地优先"],
    collectionIds: ["collection-focus"],
    pinned: false,
  },
  {
    id: "planning-high",
    name: "研究助手",
    status: "planning",
    progress: 80,
    updatedTimestamp: 20,
    technology: { languages: ["Python"] },
    tags: ["研究"],
    collectionIds: ["collection-research"],
    pinned: true,
  },
];

test("默认设置可读取、保存并在刷新后恢复", () => {
  const memory = storage();
  assert.deepEqual(loadSettings(memory).settings, DEFAULT_SETTINGS);
  saveSettings({ ...DEFAULT_SETTINGS, density: "compact", showRecent: false }, memory);
  const restored = loadSettings(memory).settings;
  assert.equal(restored.density, "compact");
  assert.equal(restored.showRecent, false);
});

test("损坏设置安全恢复默认值", () => {
  const result = loadSettings(storage("{broken"));
  assert.deepEqual(result.settings, DEFAULT_SETTINGS);
  assert.ok(result.error);
});

test("引导状态默认为 pending 且可保存 completed/skipped", () => {
  assert.equal(DEFAULT_SETTINGS.onboardingState, "pending");
  const memory = storage();
  saveSettings({ ...DEFAULT_SETTINGS, onboardingState: "skipped" }, memory);
  assert.equal(loadSettings(memory).settings.onboardingState, "skipped");
  saveSettings({ ...DEFAULT_SETTINGS, onboardingState: "completed" }, memory);
  assert.equal(loadSettings(memory).settings.onboardingState, "completed");
  saveSettings({ ...DEFAULT_SETTINGS, onboardingState: "invalid" }, memory);
  assert.equal(loadSettings(memory).settings.onboardingState, "pending");
});

test("隐藏已完成项目并支持更新时间、完成度和状态排序", () => {
  const hidden = selectVisibleProjects(projects, { ...DEFAULT_SETTINGS, showCompleted: false });
  assert.deepEqual(
    hidden.map((item) => item.id),
    ["planning-high", "active-low"],
  );
  const progress = selectVisibleProjects(projects, { ...DEFAULT_SETTINGS, sortBy: "progress" });
  assert.deepEqual(
    progress.map((item) => item.id),
    ["done", "planning-high", "active-low"],
  );
  const status = selectVisibleProjects(projects, { ...DEFAULT_SETTINGS, sortBy: "status" });
  assert.deepEqual(
    status.map((item) => item.id),
    ["active-low", "planning-high", "done"],
  );
});

test("支持状态筛选以及名称、简介和技术关键词搜索", () => {
  const active = selectVisibleProjects(projects, DEFAULT_SETTINGS, { status: "active" });
  assert.deepEqual(
    active.map((item) => item.id),
    ["active-low"],
  );
  const byDescription = selectVisibleProjects(projects, DEFAULT_SETTINGS, {
    query: "知识库",
  });
  assert.deepEqual(
    byDescription.map((item) => item.id),
    ["active-low"],
  );
  const byTechnology = selectVisibleProjects(projects, DEFAULT_SETTINGS, { query: "python" });
  assert.deepEqual(
    byTechnology.map((item) => item.id),
    ["planning-high"],
  );
  const byTagSearch = selectVisibleProjects(projects, DEFAULT_SETTINGS, { query: "本地优先" });
  assert.deepEqual(
    byTagSearch.map((item) => item.id),
    ["active-low"],
  );
  const byTag = selectVisibleProjects(projects, DEFAULT_SETTINGS, { tag: "agent" });
  assert.deepEqual(
    byTag.map((item) => item.id),
    ["active-low"],
  );
  const byCollection = selectVisibleProjects(projects, DEFAULT_SETTINGS, {
    collectionId: "collection-research",
  });
  assert.deepEqual(
    byCollection.map((item) => item.id),
    ["planning-high"],
  );
});

test("最近更新排序中置顶优先且同组保持稳定排序", () => {
  assert.deepEqual(
    selectVisibleProjects(projects, DEFAULT_SETTINGS).map((item) => item.id),
    ["planning-high", "active-low", "done"],
  );
});
