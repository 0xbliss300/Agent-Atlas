import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  selectVisibleProjects,
  resolveTheme,
  THEME_OPTIONS,
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

test("Agent 专属字段纳入全局搜索并可命中所属项目", () => {
  const withAgentProfile = [
    {
      id: "agent-eval",
      name: "评测 Agent",
      status: "active",
      progress: 40,
      updatedTimestamp: 40,
      tags: [],
      collectionIds: [],
      pinned: false,
      agentProfile: {
        modelVersion: "GPT-5 2026-08",
        promptVersion: "v1.3.0",
        datasets: ["MMLU 子集"],
        runtime: "Node 22",
        tokenCost: "~$0.012/次",
        inferenceParams: "temperature=0.2",
      },
    },
  ];
  assert.deepEqual(
    selectVisibleProjects(withAgentProfile, DEFAULT_SETTINGS, { query: "GPT-5 2026-08" }).map(
      (item) => item.id,
    ),
    ["agent-eval"],
  );
  assert.deepEqual(
    selectVisibleProjects(withAgentProfile, DEFAULT_SETTINGS, { query: "MMLU" }).map(
      (item) => item.id,
    ),
    ["agent-eval"],
  );
  assert.deepEqual(
    selectVisibleProjects(withAgentProfile, DEFAULT_SETTINGS, { query: "temperature" }).map(
      (item) => item.id,
    ),
    ["agent-eval"],
  );
  // 旧项目缺少 agentProfile 时搜索不报错且不误命中
  const legacy = [{ id: "legacy", name: "旧项目", status: "active", updatedTimestamp: 1 }];
  assert.deepEqual(
    selectVisibleProjects(legacy, DEFAULT_SETTINGS, { query: "GPT-5" }).map((item) => item.id),
    [],
  );
});

test("最近更新排序中置顶优先且同组保持稳定排序", () => {
  assert.deepEqual(
    selectVisibleProjects(projects, DEFAULT_SETTINGS).map((item) => item.id),
    ["planning-high", "active-low", "done"],
  );
});

test("主题偏好默认为 system 且可保存 light/dark 并刷新后保留", () => {
  assert.equal(DEFAULT_SETTINGS.theme, THEME_OPTIONS.SYSTEM);
  const memory = storage();
  saveSettings({ ...DEFAULT_SETTINGS, theme: THEME_OPTIONS.DARK }, memory);
  assert.equal(loadSettings(memory).settings.theme, THEME_OPTIONS.DARK);
  saveSettings({ ...DEFAULT_SETTINGS, theme: THEME_OPTIONS.LIGHT }, memory);
  assert.equal(loadSettings(memory).settings.theme, THEME_OPTIONS.LIGHT);
  saveSettings({ ...DEFAULT_SETTINGS, theme: THEME_OPTIONS.SYSTEM }, memory);
  assert.equal(loadSettings(memory).settings.theme, THEME_OPTIONS.SYSTEM);
});

test("非法主题值回退为默认 system", () => {
  const memory = storage();
  saveSettings({ ...DEFAULT_SETTINGS, theme: "high-contrast" }, memory);
  assert.equal(loadSettings(memory).settings.theme, THEME_OPTIONS.SYSTEM);
  saveSettings({ ...DEFAULT_SETTINGS, theme: 123 }, memory);
  assert.equal(loadSettings(memory).settings.theme, THEME_OPTIONS.SYSTEM);
});

test("旧版备份缺少 theme 字段时安全迁移为默认 system", () => {
  const memory = storage(
    JSON.stringify({
      schemaVersion: 1,
      settings: { ...DEFAULT_SETTINGS, theme: undefined },
    }),
  );
  assert.equal(loadSettings(memory).settings.theme, THEME_OPTIONS.SYSTEM);
});

test("resolveTheme 直接返回 light/dark，system 跟随 prefersDark 参数", () => {
  assert.equal(resolveTheme(THEME_OPTIONS.LIGHT, true), THEME_OPTIONS.LIGHT);
  assert.equal(resolveTheme(THEME_OPTIONS.LIGHT, false), THEME_OPTIONS.LIGHT);
  assert.equal(resolveTheme(THEME_OPTIONS.DARK, true), THEME_OPTIONS.DARK);
  assert.equal(resolveTheme(THEME_OPTIONS.DARK, false), THEME_OPTIONS.DARK);
  assert.equal(resolveTheme(THEME_OPTIONS.SYSTEM, true), THEME_OPTIONS.DARK);
  assert.equal(resolveTheme(THEME_OPTIONS.SYSTEM, false), THEME_OPTIONS.LIGHT);
});

test("resolveTheme 对非法值回退为默认并按 system 处理", () => {
  assert.equal(resolveTheme("unknown", true), THEME_OPTIONS.DARK);
  assert.equal(resolveTheme("unknown", false), THEME_OPTIONS.LIGHT);
});
