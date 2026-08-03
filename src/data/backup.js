import { createProjectBackup, importProjectBackup, normalizeProject } from "./projects.js";
import {
  createResearchNoteRecord,
  normalizeResearchNote,
  RESEARCH_NOTE_SCHEMA_VERSION,
} from "./researchNotes.js";
import {
  NOTE_HISTORY_LIMIT,
  NOTE_HISTORY_SCHEMA_VERSION,
  normalizeResearchNoteHistory,
  serializeResearchNoteHistory,
  selectResearchNoteHistories,
} from "./noteWorkspace.js";
import {
  addProjectEvent,
  normalizeProjectEvent,
  PROJECT_EVENT_SCHEMA_VERSION,
  serializeProjectEvent,
} from "./projectEvents.js";
import {
  normalizeCustomTemplate,
  resolveImportedTemplateConflicts,
  TEMPLATE_SCHEMA_VERSION,
} from "./templates.js";
import {
  COLLECTION_SCHEMA_VERSION,
  importCollections,
  normalizeCollection,
} from "./organization.js";
import { normalizeTrashEntry, serializeTrashEntry, TRASH_SCHEMA_VERSION } from "./trash.js";
import {
  EVALUATION_SCHEMA_VERSION,
  importEvaluationBackup,
  normalizeEvaluation,
} from "./evaluations.js";

export function createAppBackup(
  projects = [],
  notes = [],
  histories = [],
  events = [],
  templates = [],
  collections = [],
  trashEntries = [],
  evaluations = [],
) {
  const payload = JSON.parse(createProjectBackup(projects));
  return JSON.stringify(
    {
      ...payload,
      researchNoteSchemaVersion: RESEARCH_NOTE_SCHEMA_VERSION,
      researchNotes: notes,
      researchNoteHistorySchemaVersion: NOTE_HISTORY_SCHEMA_VERSION,
      researchNoteHistories: histories.map(serializeResearchNoteHistory),
      projectEventSchemaVersion: PROJECT_EVENT_SCHEMA_VERSION,
      projectEvents: events.map(serializeProjectEvent),
      templateSchemaVersion: TEMPLATE_SCHEMA_VERSION,
      templates: templates.map(normalizeCustomTemplate),
      collectionSchemaVersion: COLLECTION_SCHEMA_VERSION,
      collections: collections.map(normalizeCollection),
      trashSchemaVersion: TRASH_SCHEMA_VERSION,
      trash: trashEntries.map(serializeTrashEntry),
      evaluationSchemaVersion: EVALUATION_SCHEMA_VERSION,
      evaluations: evaluations.map(normalizeEvaluation),
    },
    null,
    2,
  );
}

export function createSingleProjectBackup(
  project,
  notes = [],
  histories = [],
  events = [],
  collections = [],
  evaluations = [],
) {
  const payload = JSON.parse(createProjectBackup([project]));
  const projectNotes = notes.filter((note) => note.projectId === project.id);
  const projectNoteIds = new Set(projectNotes.map((note) => note.id));
  const projectHistories = histories.filter((snapshot) => projectNoteIds.has(snapshot.noteId));
  const projectEvents = events.filter((event) => event.projectId === project.id);
  const projectCollectionIds = new Set(project.collectionIds ?? []);
  const projectCollections = collections.filter((collection) =>
    projectCollectionIds.has(collection.id),
  );
  const projectEvaluations = evaluations.filter((item) => item.projectId === project.id);

  return JSON.stringify(
    {
      ...payload,
      researchNoteSchemaVersion: RESEARCH_NOTE_SCHEMA_VERSION,
      researchNotes: projectNotes,
      researchNoteHistorySchemaVersion: NOTE_HISTORY_SCHEMA_VERSION,
      researchNoteHistories: projectHistories.map(serializeResearchNoteHistory),
      projectEventSchemaVersion: PROJECT_EVENT_SCHEMA_VERSION,
      projectEvents: projectEvents.map(serializeProjectEvent),
      collectionSchemaVersion: COLLECTION_SCHEMA_VERSION,
      collections: projectCollections.map(normalizeCollection),
      evaluationSchemaVersion: EVALUATION_SCHEMA_VERSION,
      evaluations: projectEvaluations.map(normalizeEvaluation),
    },
    null,
    2,
  );
}

function parsePayload(raw) {
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    throw new Error("JSON 文件格式无效。");
  }
}

function uniqueHistoryId(existingIds) {
  let id;
  do {
    id =
      globalThis.crypto?.randomUUID?.() ??
      `note-version-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  } while (existingIds.has(id));
  return id;
}

function uniqueProjectEventId(existingIds) {
  let id;
  do {
    id =
      globalThis.crypto?.randomUUID?.() ??
      `project-event-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  } while (existingIds.has(id));
  return id;
}

function limitHistories(histories) {
  const noteIds = [...new Set(histories.map((item) => item.noteId))];
  return noteIds.flatMap((noteId) =>
    selectResearchNoteHistories(histories, noteId).slice(0, NOTE_HISTORY_LIMIT),
  );
}

export function importAppBackup(
  raw,
  existingProjects = [],
  existingNotes = [],
  mode = "merge",
  existingHistories = [],
  existingEvents = [],
  existingTemplates = [],
  existingCollections = [],
  existingTrash = [],
  existingEvaluations = [],
) {
  const payload = parsePayload(raw);
  const projectResult = importProjectBackup(payload, existingProjects, mode);
  const hasResearchNotes = Object.hasOwn(payload ?? {}, "researchNotes");
  const hasHistories = Object.hasOwn(payload ?? {}, "researchNoteHistories");
  const hasEvents = Object.hasOwn(payload ?? {}, "projectEvents");
  const hasTemplates = Object.hasOwn(payload ?? {}, "templates");
  const hasCollections = Object.hasOwn(payload ?? {}, "collections");
  const hasTrash = Object.hasOwn(payload ?? {}, "trash");
  const hasEvaluations = Object.hasOwn(payload ?? {}, "evaluations");

  if (
    hasTrash &&
    (payload.trashSchemaVersion !== TRASH_SCHEMA_VERSION || !Array.isArray(payload.trash))
  ) {
    throw new Error("回收站备份版本或结构不受支持。");
  }
  const trash = hasTrash ? payload.trash.map(normalizeTrashEntry) : existingTrash;

  if (
    hasCollections &&
    (payload.collectionSchemaVersion !== COLLECTION_SCHEMA_VERSION ||
      !Array.isArray(payload.collections))
  ) {
    throw new Error("项目集合备份版本或结构不受支持。");
  }
  const rawCollections = hasCollections ? payload.collections : [];
  const importedCollectionIds = new Set();
  rawCollections.forEach((collection, index) => {
    const normalized = normalizeCollection(collection, index);
    if (importedCollectionIds.has(normalized.id)) {
      throw new Error(`备份中存在重复项目集合 ID：${normalized.id}`);
    }
    importedCollectionIds.add(normalized.id);
  });
  const collectionResult = importCollections(rawCollections, existingCollections, mode);
  const importedProjectResultIds = new Set(Object.values(projectResult.idMap));
  projectResult.projects = projectResult.projects.map((project) => {
    if (!importedProjectResultIds.has(project.id)) return project;
    return normalizeProject({
      ...project,
      collectionIds: (project.collectionIds ?? [])
        .map((id) => collectionResult.idMap[id])
        .filter(Boolean),
    });
  });

  const projectIdMap = { ...projectResult.idMap };
  if (mode === "merge") {
    existingProjects.forEach((project) => {
      if (!Object.hasOwn(projectIdMap, project.id)) {
        projectIdMap[project.id] = project.id;
      }
    });
  }

  if (
    hasEvaluations &&
    (payload.evaluationSchemaVersion !== EVALUATION_SCHEMA_VERSION ||
      !Array.isArray(payload.evaluations))
  ) {
    throw new Error("评测结果备份版本或结构不受支持。");
  }
  const rawEvaluations = hasEvaluations ? payload.evaluations : [];
  const evaluationResult = importEvaluationBackup(
    { schemaVersion: EVALUATION_SCHEMA_VERSION, evaluations: rawEvaluations },
    mode === "replace" ? [] : existingEvaluations,
    projectResult.projects,
    mode,
    projectIdMap,
  );

  if (
    hasResearchNotes &&
    (payload.researchNoteSchemaVersion !== RESEARCH_NOTE_SCHEMA_VERSION ||
      !Array.isArray(payload.researchNotes))
  ) {
    throw new Error("研究笔记备份版本或结构不受支持。");
  }

  const rawNotes = hasResearchNotes ? payload.researchNotes : [];
  const importedNotes = rawNotes.map(normalizeResearchNote);
  const importedNoteIds = new Set();
  importedNotes.forEach((note) => {
    if (importedNoteIds.has(note.id)) throw new Error(`备份中存在重复研究笔记 ID：${note.id}`);
    importedNoteIds.add(note.id);
    if (!projectIdMap[note.projectId]) {
      throw new Error(`研究笔记“${note.title}”关联的项目不存在。`);
    }
  });

  if (
    hasHistories &&
    (payload.researchNoteHistorySchemaVersion !== NOTE_HISTORY_SCHEMA_VERSION ||
      !Array.isArray(payload.researchNoteHistories))
  ) {
    throw new Error("研究笔记版本历史备份版本或结构不受支持。");
  }

  const importedHistories = hasHistories
    ? payload.researchNoteHistories.map(normalizeResearchNoteHistory)
    : [];
  if (
    hasEvents &&
    (payload.projectEventSchemaVersion !== PROJECT_EVENT_SCHEMA_VERSION ||
      !Array.isArray(payload.projectEvents))
  ) {
    throw new Error("项目变更时间线备份版本或结构不受支持。");
  }
  const importedEvents = hasEvents ? payload.projectEvents.map(normalizeProjectEvent) : [];
  if (
    hasTemplates &&
    (payload.templateSchemaVersion !== TEMPLATE_SCHEMA_VERSION || !Array.isArray(payload.templates))
  ) {
    throw new Error("自定义模板备份版本或结构不受支持。");
  }
  const importedTemplates = hasTemplates
    ? payload.templates.map((template, index) => normalizeCustomTemplate(template, index))
    : [];
  const importedEventIds = new Set();
  importedEvents.forEach((event) => {
    if (importedEventIds.has(event.id)) {
      throw new Error(`备份中存在重复项目变更事件 ID：${event.id}`);
    }
    importedEventIds.add(event.id);
    if (!projectIdMap[event.projectId]) {
      throw new Error(`项目变更事件“${event.summary}”关联的项目不存在。`);
    }
  });
  const importedTemplateIds = new Set();
  importedTemplates.forEach((template) => {
    if (importedTemplateIds.has(template.id)) {
      throw new Error(`备份中存在重复自定义模板 ID：${template.id}`);
    }
    importedTemplateIds.add(template.id);
  });
  const importedHistoryIds = new Set();
  importedHistories.forEach((snapshot) => {
    if (importedHistoryIds.has(snapshot.id)) {
      throw new Error(`备份中存在重复研究笔记历史 ID：${snapshot.id}`);
    }
    importedHistoryIds.add(snapshot.id);
    if (!importedNoteIds.has(snapshot.noteId)) {
      throw new Error(`研究笔记历史“${snapshot.title}”关联的笔记不存在。`);
    }
    const sourceNote = importedNotes.find((note) => note.id === snapshot.noteId);
    if (sourceNote?.projectId !== snapshot.projectId) {
      throw new Error(`研究笔记历史“${snapshot.title}”的项目关联不一致。`);
    }
  });

  const notes = mode === "replace" ? [] : [...existingNotes];
  const noteIdMap = {};
  let reassignedNoteIds = 0;
  importedNotes.forEach((note) => {
    const projectId = projectIdMap[note.projectId];
    if (notes.some((current) => current.id === note.id)) {
      const generated = createResearchNoteRecord(
        { projectId, title: note.title, body: note.body },
        notes,
        projectResult.projects,
      );
      notes.push(
        normalizeResearchNote({
          ...note,
          id: generated.id,
          projectId,
        }),
      );
      noteIdMap[note.id] = generated.id;
      reassignedNoteIds += 1;
    } else {
      notes.push(normalizeResearchNote({ ...note, projectId }));
      noteIdMap[note.id] = note.id;
    }
  });

  const histories = mode === "replace" ? [] : [...existingHistories];
  const historyIds = new Set(histories.map((item) => item.id));
  importedHistories.forEach((snapshot) => {
    const id = historyIds.has(snapshot.id) ? uniqueHistoryId(historyIds) : snapshot.id;
    historyIds.add(id);
    histories.push(
      normalizeResearchNoteHistory({
        ...snapshot,
        id,
        noteId: noteIdMap[snapshot.noteId],
        projectId: projectIdMap[snapshot.projectId],
      }),
    );
  });

  let events = mode === "replace" ? [] : [...existingEvents];
  const eventIds = new Set(events.map((item) => item.id));
  importedEvents.forEach((event) => {
    const id = eventIds.has(event.id) ? uniqueProjectEventId(eventIds) : event.id;
    eventIds.add(id);
    const mappedNoteId =
      event.subject?.kind === "note"
        ? (noteIdMap[event.subject.id] ?? event.subject.id)
        : event.subject?.id;
    const normalized = normalizeProjectEvent({
      ...event,
      id,
      projectId: projectIdMap[event.projectId],
      subject: event.subject
        ? {
            ...event.subject,
            id: mappedNoteId,
          }
        : null,
    });
    events = addProjectEvent(events, normalized);
  });

  return {
    ...projectResult,
    notes,
    histories: limitHistories(histories),
    events,
    templates: resolveImportedTemplateConflicts(importedTemplates, existingTemplates, mode),
    collections: collectionResult.collections,
    trash,
    evaluations: evaluationResult.evaluations,
    noteIdMap,
    importedNotesCount: importedNotes.length,
    importedEventsCount: importedEvents.length,
    importedTemplatesCount: importedTemplates.length,
    importedCollectionsCount: collectionResult.importedCount,
    importedEvaluationsCount: evaluationResult.importedCount,
    reassignedNoteIds,
    reassignedEvaluationIds: evaluationResult.reassignedIds,
  };
}
