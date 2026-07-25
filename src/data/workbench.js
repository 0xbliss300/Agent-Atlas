const STALE_AFTER_DAYS = 14;
const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

function stableProjectSort(left, right) {
  return (
    right.updatedTimestamp - left.updatedTimestamp ||
    left.name.localeCompare(right.name, "zh-CN") ||
    left.id.localeCompare(right.id)
  );
}

function stableItemSort(left, right) {
  return (
    left.priority - right.priority ||
    right.updatedTimestamp - left.updatedTimestamp ||
    left.projectName.localeCompare(right.projectName, "zh-CN") ||
    left.projectId.localeCompare(right.projectId) ||
    left.id.localeCompare(right.id)
  );
}

export function getProjectStaleState(project, now = new Date()) {
  if (project.status === "done") {
    return { stale: false, inactiveDays: 0 };
  }
  const nowTimestamp = now instanceof Date ? now.getTime() : Date.parse(now);
  const elapsed = Math.max(0, nowTimestamp - project.updatedTimestamp);
  const inactiveDays = Math.floor(elapsed / DAY_MILLISECONDS);
  return {
    stale: elapsed >= STALE_AFTER_DAYS * DAY_MILLISECONDS,
    inactiveDays,
  };
}

export function createWorkbenchModel(projects = [], notes = [], now = new Date()) {
  const sortedProjects = [...projects].sort(stableProjectSort);
  const staleStates = new Map(
    sortedProjects.map((project) => [project.id, getProjectStaleState(project, now)]),
  );
  const blockers = [];
  const tasks = [];
  const projectItems = [];

  sortedProjects.forEach((project) => {
    const staleState = staleStates.get(project.id);
    project.blockers
      .filter((blocker) => !blocker.done)
      .forEach((blocker) => {
        blockers.push({
          id: `blocker:${project.id}:${blocker.id}`,
          entryId: blocker.id,
          type: "blocker",
          priority: 0,
          projectId: project.id,
          projectName: project.name,
          collectionIds: project.collectionIds ?? [],
          title: blocker.title,
          statusLabel: project.statusLabel,
          updatedTimestamp: project.updatedTimestamp,
          updatedAt: project.updatedAt,
        });
      });

    project.nextTasks.forEach((task) => {
      const pendingPriority = project.status === "active" ? 1 : 2;
      tasks.push({
        id: `task:${project.id}:${task.id}`,
        entryId: task.id,
        type: "task",
        priority: task.done ? 5 : pendingPriority,
        projectId: project.id,
        projectName: project.name,
        collectionIds: project.collectionIds ?? [],
        title: task.title,
        done: task.done,
        statusLabel: project.statusLabel,
        updatedTimestamp: project.updatedTimestamp,
        updatedAt: project.updatedAt,
      });
    });

    if (project.status === "active" || project.status === "paused") {
      projectItems.push({
        id: `project:${project.id}`,
        entryId: project.id,
        type: "project",
        priority: staleState.stale ? 3 : 4,
        projectId: project.id,
        projectName: project.name,
        collectionIds: project.collectionIds ?? [],
        title: staleState.stale ? "可能停滞" : project.statusLabel,
        description: project.milestone,
        statusLabel: project.statusLabel,
        stale: staleState.stale,
        inactiveDays: staleState.inactiveDays,
        updatedTimestamp: project.updatedTimestamp,
        updatedAt: project.updatedAt,
      });
    }
  });

  const noteItems = [...notes]
    .sort(
      (left, right) =>
        right.updatedTimestamp - left.updatedTimestamp || left.id.localeCompare(right.id),
    )
    .map((note) => {
      const project = projects.find((item) => item.id === note.projectId);
      return {
        id: `note:${note.id}`,
        entryId: note.id,
        type: "note",
        priority: 6,
        projectId: note.projectId,
        projectName: project?.name ?? "项目不存在",
        collectionIds: project?.collectionIds ?? [],
        title: note.title,
        description: note.body,
        updatedTimestamp: note.updatedTimestamp,
        updatedAt: note.updatedAt,
      };
    });

  const staleProjects = projectItems.filter((item) => item.stale);
  const pendingTasks = tasks.filter((item) => !item.done);
  return {
    summary: {
      totalTasks: tasks.length,
      pendingTasks: pendingTasks.length,
      unresolvedBlockers: blockers.length,
      activeProjects: projects.filter((project) => project.status === "active").length,
      pausedProjects: projects.filter((project) => project.status === "paused").length,
      staleProjects: staleProjects.length,
    },
    projectOptions: sortedProjects.map((project) => ({
      id: project.id,
      name: project.name,
    })),
    items: [...blockers, ...tasks, ...projectItems, ...noteItems].sort(stableItemSort),
    defaultItems: [...blockers, ...pendingTasks, ...staleProjects].sort(stableItemSort),
    focusProjects: projectItems.sort(stableItemSort),
    recentProjects: sortedProjects.slice(0, 5),
    recentNotes: noteItems.slice(0, 5),
  };
}

export function filterWorkbenchItems(model, filters = {}) {
  const projectId = filters.projectId ?? "all";
  const type = filters.type ?? "all";
  const collectionId = filters.collectionId ?? "all";
  const source =
    type === "all" ? model.defaultItems : model.items.filter((item) => item.type === type);
  return source.filter(
    (item) =>
      (projectId === "all" || item.projectId === projectId) &&
      (collectionId === "all" || item.collectionIds.includes(collectionId)),
  );
}

export { STALE_AFTER_DAYS };
