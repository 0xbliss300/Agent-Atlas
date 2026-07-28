import { getResearchNoteExcerpt } from "./researchNotes.js";

const SEARCH_TYPES = Object.freeze({
  note: "note",
  task: "task",
  blocker: "blocker",
});

function normalizeQuery(query) {
  return String(query ?? "")
    .trim()
    .toLocaleLowerCase("zh-CN");
}

function includesQuery(text, normalizedQuery) {
  return String(text ?? "")
    .toLocaleLowerCase("zh-CN")
    .includes(normalizedQuery);
}

function stableResultSort(left, right) {
  return (
    left.typePriority - right.typePriority ||
    right.updatedTimestamp - left.updatedTimestamp ||
    left.id.localeCompare(right.id)
  );
}

export function searchResearchNotes(notes = [], query = "") {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) return [];
  return notes
    .filter(
      (note) =>
        includesQuery(note.title, normalizedQuery) || includesQuery(note.body, normalizedQuery),
    )
    .map((note) => ({
      id: `note:${note.id}`,
      type: SEARCH_TYPES.note,
      typePriority: 0,
      noteId: note.id,
      projectId: note.projectId,
      title: note.title,
      excerpt: getResearchNoteExcerpt(note.body),
      route: `/notes/${encodeURIComponent(note.id)}`,
      updatedTimestamp: note.updatedTimestamp ?? 0,
    }))
    .sort(stableResultSort);
}

export function searchProjectTasks(projects = [], query = "") {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) return [];
  const results = [];
  projects.forEach((project) => {
    (project.nextTasks ?? [])
      .filter((task) => !task.done && includesQuery(task.title, normalizedQuery))
      .forEach((task) => {
        results.push({
          id: `task:${project.id}:${task.id}`,
          type: SEARCH_TYPES.task,
          typePriority: 1,
          typeLabel: "任务",
          entryId: task.id,
          projectId: project.id,
          projectName: project.name,
          title: task.title,
          route: `/project/${encodeURIComponent(project.id)}`,
          updatedTimestamp: project.updatedTimestamp ?? 0,
        });
      });
    (project.blockers ?? [])
      .filter((blocker) => !blocker.done && includesQuery(blocker.title, normalizedQuery))
      .forEach((blocker) => {
        results.push({
          id: `blocker:${project.id}:${blocker.id}`,
          type: SEARCH_TYPES.blocker,
          typePriority: 0,
          typeLabel: "阻塞",
          entryId: blocker.id,
          projectId: project.id,
          projectName: project.name,
          title: blocker.title,
          route: `/project/${encodeURIComponent(project.id)}`,
          updatedTimestamp: project.updatedTimestamp ?? 0,
        });
      });
  });
  return results.sort(stableResultSort);
}
