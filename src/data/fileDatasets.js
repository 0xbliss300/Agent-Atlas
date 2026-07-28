export const FILE_DATA_SCHEMA_VERSION = 1;

export const FILE_DATASETS = Object.freeze([
  {
    id: "projects",
    storageKey: "agent-project-showcase.projects.v1",
    relativePath: "projects/projects.json",
  },
  {
    id: "research-notes",
    storageKey: "agent-project-showcase.research-notes.v1",
    relativePath: "research-notes/notes.json",
  },
  {
    id: "drafts",
    storageKey: "agent-project-showcase.research-note-drafts.v1",
    relativePath: "drafts/drafts.json",
  },
  {
    id: "history",
    storageKey: "agent-project-showcase.research-note-history.v1",
    relativePath: "history/history.json",
  },
  {
    id: "events",
    storageKey: "agent-project-showcase.project-events.v1",
    relativePath: "events/events.json",
  },
  {
    id: "templates",
    storageKey: "agent-project-showcase.templates.v1",
    relativePath: "templates/templates.json",
  },
  {
    id: "organization",
    storageKey: "agent-project-showcase.collections.v1",
    relativePath: "organization/collections.json",
  },
  {
    id: "settings",
    storageKey: "agent-project-showcase.settings.v1",
    relativePath: "settings/settings.json",
  },
  {
    id: "recent-access",
    storageKey: "agent-project-showcase.recent-access.v1",
    relativePath: "recent-access/recent-access.json",
  },
  {
    id: "trash",
    storageKey: "agent-project-showcase.trash.v1",
    relativePath: "trash/trash.json",
  },
]);

export const FILE_DATASET_BY_ID = Object.freeze(
  Object.fromEntries(FILE_DATASETS.map((dataset) => [dataset.id, dataset])),
);

export const FILE_DATASET_BY_STORAGE_KEY = Object.freeze(
  Object.fromEntries(FILE_DATASETS.map((dataset) => [dataset.storageKey, dataset])),
);
