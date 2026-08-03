import { EMPTY_PROJECT_DRAFT, PROJECT_STATUSES } from "./projects.js";

export const IMPORT_FIELD_STATUS = Object.freeze({
  DETECTED: "detected",
  CONFIRM: "confirm",
  MISSING: "missing",
});

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function checklistToText(items = []) {
  return items
    .map((item) => `- [${item.done ? "x" : " "}] ${cleanText(item.title)}`)
    .filter((line) => !line.endsWith("] "))
    .join("\n");
}

function listToText(items = []) {
  return items.map(cleanText).filter(Boolean).join(", ");
}

function fileStem(name = "") {
  return cleanText(name).replace(/\.(?:json|md|markdown)$/i, "");
}

function fieldState(value, fallbackWasUsed = false) {
  if (fallbackWasUsed) return IMPORT_FIELD_STATUS.CONFIRM;
  if (Array.isArray(value)) {
    return value.length ? IMPORT_FIELD_STATUS.DETECTED : IMPORT_FIELD_STATUS.MISSING;
  }
  return (typeof value === "number" && Number.isFinite(value)) || cleanText(value)
    ? IMPORT_FIELD_STATUS.DETECTED
    : IMPORT_FIELD_STATUS.MISSING;
}

export function createProjectImportDraft(result, existingProjects = [], now = new Date()) {
  if (!result?.project) throw new Error("没有可用于创建项目的读取结果。");
  const sourceProject = result.project;
  const sourceName = cleanText(result.sourceName) || "本地来源";
  const inferredName = cleanText(sourceProject.name);
  const fallbackName =
    result.sourceType === "directory"
      ? sourceName
      : result.sourceType === "git-repository"
        ? sourceName.split("/").pop() || sourceName
        : fileStem(sourceName);
  const name = inferredName || fallbackName;
  const technology = sourceProject.technology ?? {};

  const draft = {
    ...EMPTY_PROJECT_DRAFT,
    name,
    short: cleanText(sourceProject.short),
    description: cleanText(sourceProject.description),
    status: cleanText(sourceProject.status) || PROJECT_STATUSES.PLANNING,
    progress: Number.isFinite(sourceProject.progress) ? String(sourceProject.progress) : "0",
    milestone: cleanText(sourceProject.milestone),
    repositoryUrl: cleanText(sourceProject.repositoryUrl),
    blockersText: checklistToText(sourceProject.blockers),
    nextTasksText: checklistToText(sourceProject.nextTasks),
    languagesText: listToText(technology.languages),
    frameworksText: listToText(technology.frameworks),
    modelsText: listToText(technology.models),
    dataSourcesText: listToText(technology.dataSources),
    runCommand: cleanText(technology.runCommand),
    logText:
      result.sourceType === "git-repository"
        ? `从 Git 仓库导入：${sourceName}`
        : `从本地来源创建：${sourceName}`,
  };

  const fieldStatus = {
    name: fieldState(inferredName, !inferredName && Boolean(fallbackName)),
    short: fieldState(sourceProject.short),
    description: fieldState(sourceProject.description),
    status: fieldState(sourceProject.status),
    progress: fieldState(sourceProject.progress),
    milestone: fieldState(sourceProject.milestone),
    repositoryUrl: fieldState(sourceProject.repositoryUrl),
    blockersText: fieldState(sourceProject.blockers),
    nextTasksText: fieldState(sourceProject.nextTasks),
    languagesText: fieldState(technology.languages),
    frameworksText: fieldState(technology.frameworks),
    modelsText: fieldState(technology.models),
    dataSourcesText: fieldState(technology.dataSources),
    runCommand: fieldState(technology.runCommand),
  };
  const duplicateName = existingProjects.some(
    (project) => cleanText(project.name).toLocaleLowerCase() === name.toLocaleLowerCase(),
  );

  return {
    draft,
    fieldStatus,
    duplicateName,
    notes: Array.isArray(result.notes) ? result.notes : [],
    sourceMetadata: {
      sourceType: cleanText(result.sourceType),
      sourceName,
      syncedAt: now.toISOString(),
      branch: cleanText(result.git?.branch),
      commit: cleanText(result.git?.commit),
      filesRead: Array.isArray(result.filesRead) ? result.filesRead : [],
    },
  };
}
