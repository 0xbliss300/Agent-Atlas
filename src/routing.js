export function normalizeRoutePath(value = "/") {
  const raw = value.startsWith("#") ? value.slice(1) : value;
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : "/";
}

export function parseRoute(path) {
  const normalized = normalizeRoutePath(path);
  if (normalized === "/") return { type: "overview", path: normalized };
  if (normalized === "/workbench") return { type: "workbench", path: normalized };
  if (normalized === "/notes") return { type: "notes", path: normalized };
  if (normalized === "/guide") return { type: "guide", path: normalized };
  if (normalized === "/trash") return { type: "trash", path: normalized };
  if (normalized === "/notes/new") return { type: "note-new", path: normalized };
  const noteNewMatch = normalized.match(/^\/notes\/new\/project\/([^/]+)$/);
  if (noteNewMatch) {
    try {
      return {
        type: "note-new",
        path: normalized,
        preferredProjectId: decodeURIComponent(noteNewMatch[1]),
      };
    } catch {
      return { type: "not-found", path: normalized };
    }
  }
  const noteMatch = normalized.match(/^\/notes\/([^/]+)$/);
  if (noteMatch) {
    try {
      return {
        type: "note",
        path: normalized,
        noteId: decodeURIComponent(noteMatch[1]),
      };
    } catch {
      return { type: "not-found", path: normalized };
    }
  }
  const match = normalized.match(/^\/project\/([^/]+)(?:\/(notes))?$/);
  if (match) {
    try {
      return {
        type: match[2] ? "project-notes" : "project",
        path: normalized,
        projectId: decodeURIComponent(match[1]),
      };
    } catch {
      return { type: "not-found", path: normalized };
    }
  }
  return { type: "not-found", path: normalized };
}

export function getPageTitle(route, project, note) {
  if (route.type === "overview") return "Agent Atlas · 个人 Agent 项目总览";
  if (route.type === "workbench") return "开发工作台 · Agent Atlas";
  if (route.type === "notes") return "研究笔记 · Agent Atlas";
  if (route.type === "guide") return "项目使用指南 · Agent Atlas";
  if (route.type === "trash") return "回收站 · Agent Atlas";
  if (route.type === "note-new") return "新建研究笔记 · Agent Atlas";
  if (route.type === "note" && note) return `${note.title} · 研究笔记`;
  if ((route.type === "project" || route.type === "project-notes") && project) {
    return `${project.name}${route.type === "project-notes" ? " · 开发记录" : ""} · Agent Atlas`;
  }
  return "页面不存在 · Agent Atlas";
}
