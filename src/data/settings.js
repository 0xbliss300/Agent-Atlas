import { getAppStorage } from "./filePersistence.js";

export const SETTINGS_SCHEMA_VERSION = 1;
export const SETTINGS_STORAGE_KEY = "agent-project-showcase.settings.v1";
export const ONBOARDING_STATES = Object.freeze({
  PENDING: "pending",
  COMPLETED: "completed",
  SKIPPED: "skipped",
});

export const DEFAULT_SETTINGS = Object.freeze({
  showCompleted: true,
  sortBy: "updated",
  density: "standard",
  showRecent: true,
  enableShortcuts: true,
  onboardingState: ONBOARDING_STATES.PENDING,
});

const VALID_SORTS = new Set(["updated", "progress", "status"]);
const VALID_DENSITIES = new Set(["standard", "compact"]);
const VALID_ONBOARDING_STATES = new Set(Object.values(ONBOARDING_STATES));
const STATUS_ORDER = Object.freeze({ active: 0, planning: 1, paused: 2, done: 3 });
const VALID_STATUS_FILTERS = new Set(["all", ...Object.keys(STATUS_ORDER)]);

export const STATUS_FILTER_OPTIONS = Object.freeze([
  ["all", "全部状态"],
  ["active", "开发中"],
  ["planning", "规划中"],
  ["paused", "已暂停"],
  ["done", "已完成"],
]);

export function normalizeSettings(value = {}) {
  return {
    showCompleted:
      typeof value.showCompleted === "boolean"
        ? value.showCompleted
        : DEFAULT_SETTINGS.showCompleted,
    sortBy: VALID_SORTS.has(value.sortBy) ? value.sortBy : DEFAULT_SETTINGS.sortBy,
    density: VALID_DENSITIES.has(value.density) ? value.density : DEFAULT_SETTINGS.density,
    showRecent:
      typeof value.showRecent === "boolean" ? value.showRecent : DEFAULT_SETTINGS.showRecent,
    enableShortcuts:
      typeof value.enableShortcuts === "boolean"
        ? value.enableShortcuts
        : DEFAULT_SETTINGS.enableShortcuts,
    onboardingState: VALID_ONBOARDING_STATES.has(value.onboardingState)
      ? value.onboardingState
      : DEFAULT_SETTINGS.onboardingState,
  };
}

export function loadSettings(storage = getAppStorage()) {
  if (!storage) return { settings: { ...DEFAULT_SETTINGS }, error: null };
  try {
    const raw = storage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { settings: { ...DEFAULT_SETTINGS }, error: null };
    const payload = JSON.parse(raw);
    if (payload.schemaVersion !== SETTINGS_SCHEMA_VERSION)
      throw new Error("unsupported-settings-schema");
    return { settings: normalizeSettings(payload.settings), error: null };
  } catch {
    return { settings: { ...DEFAULT_SETTINGS }, error: "显示设置无法读取，已恢复默认值。" };
  }
}

export function saveSettings(settings, storage = getAppStorage()) {
  if (!storage) throw new Error("当前浏览器不支持本地设置存储。");
  const normalized = normalizeSettings(settings);
  storage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({ schemaVersion: SETTINGS_SCHEMA_VERSION, settings: normalized }),
  );
  return normalized;
}

function matchesProjectQuery(project, query) {
  if (!query) return true;
  const technology = project.technology ?? {};
  const searchable = [
    project.name,
    project.short,
    project.description,
    project.milestone,
    ...(project.tags ?? []),
    ...(technology.languages ?? []),
    ...(technology.frameworks ?? []),
    ...(technology.models ?? []),
    ...(technology.dataSources ?? []),
  ]
    .filter(Boolean)
    .join("\n")
    .toLocaleLowerCase("zh-CN");
  return searchable.includes(query);
}

export function selectVisibleProjects(projects = [], settings = DEFAULT_SETTINGS, filters = {}) {
  const normalized = normalizeSettings(settings);
  const status = VALID_STATUS_FILTERS.has(filters.status) ? filters.status : "all";
  const tag = String(filters.tag ?? "").trim();
  const collectionId = String(filters.collectionId ?? "").trim();
  const query = String(filters.query ?? "")
    .trim()
    .toLocaleLowerCase("zh-CN");
  let visible = normalized.showCompleted
    ? [...projects]
    : projects.filter((project) => project.status !== "done");
  if (status !== "all") visible = visible.filter((project) => project.status === status);
  if (tag) {
    const normalizedTag = tag.toLocaleLowerCase("zh-CN");
    visible = visible.filter((project) =>
      project.tags?.some((projectTag) => projectTag.toLocaleLowerCase("zh-CN") === normalizedTag),
    );
  }
  if (collectionId && collectionId !== "all") {
    visible = visible.filter((project) => project.collectionIds?.includes(collectionId));
  }
  if (query) visible = visible.filter((project) => matchesProjectQuery(project, query));
  if (normalized.sortBy === "progress") {
    return visible.sort(
      (left, right) =>
        right.progress - left.progress || right.updatedTimestamp - left.updatedTimestamp,
    );
  }
  if (normalized.sortBy === "status") {
    return visible.sort(
      (left, right) =>
        (STATUS_ORDER[left.status] ?? 99) - (STATUS_ORDER[right.status] ?? 99) ||
        right.updatedTimestamp - left.updatedTimestamp,
    );
  }
  return visible.sort(
    (left, right) =>
      Number(Boolean(right.pinned)) - Number(Boolean(left.pinned)) ||
      right.updatedTimestamp - left.updatedTimestamp ||
      left.id.localeCompare(right.id),
  );
}

export function getProjectTagOptions(projects = []) {
  const tags = new Map();
  projects.forEach((project) => {
    project.tags?.forEach((tag) => {
      const key = tag.toLocaleLowerCase("zh-CN");
      if (!tags.has(key)) tags.set(key, tag);
    });
  });
  return [...tags.values()].sort((left, right) => left.localeCompare(right, "zh-CN"));
}
