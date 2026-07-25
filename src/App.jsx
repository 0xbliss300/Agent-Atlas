import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { GithubLogo } from "@phosphor-icons/react";
import { Header } from "./components/Header.jsx";
import { CodexContextPanel } from "./components/CodexContextPanel.jsx";
import { LocalSyncPanel } from "./components/LocalSyncPanel.jsx";
import { ProjectFormPanel } from "./components/ProjectFormPanel.jsx";
import { SettingsPanel } from "./components/SettingsPanel.jsx";
import { createAppBackup, importAppBackup } from "./data/backup.js";
import {
  applyProjectStatusSync,
  createProjectRecord,
  createResearchNotes,
  deleteProjectRecord,
  duplicateProjectRecord,
  findProjectById,
  loadProjectStore,
  saveProjectStore,
  setProjectPinned,
  sortProjectsByUpdatedAt,
  summarizeProjects,
  toggleProjectBlocker,
  toggleProjectTask,
  updateProjectRecord,
} from "./data/projects.js";
import {
  createResearchNoteRecord,
  deleteResearchNoteRecord,
  deleteResearchNotesForProject,
  findResearchNoteById,
  loadResearchNoteStore,
  saveResearchNoteStore,
  selectProjectResearchNotes,
  sortResearchNotes,
  updateResearchNoteRecord,
} from "./data/researchNotes.js";
import {
  addResearchNoteHistorySnapshot,
  deleteResearchNoteDraft,
  deleteResearchNoteDraftsForNote,
  deleteResearchNoteDraftsForProject,
  deleteResearchNoteHistoriesForNote,
  deleteResearchNoteHistoriesForProject,
  findResearchNoteDraft,
  getResearchNoteDraftKey,
  loadResearchNoteDraftStore,
  loadResearchNoteHistoryStore,
  saveResearchNoteDraftStore,
  saveResearchNoteHistoryStore,
  selectResearchNoteHistories,
  upsertResearchNoteDraft,
} from "./data/noteWorkspace.js";
import {
  addProjectEvent,
  createBlockerToggledEvent,
  createLocalStatusEvent,
  createProjectCreatedEvent,
  createProjectUpdatedEvent,
  createResearchNoteEvent,
  createTaskToggledEvent,
  deleteProjectEventsForProject,
  loadProjectEventStore,
  markResearchNoteSourceDeleted,
  saveProjectEventStore,
  selectProjectEvents,
} from "./data/projectEvents.js";
import {
  applyNoteTemplate,
  applyProjectTemplate,
  createCustomNoteTemplate,
  createCustomProjectTemplate,
  deleteCustomTemplate,
  duplicateCustomTemplate,
  getTemplatesByType,
  loadTemplateStore,
  moveCustomTemplate,
  renameCustomTemplate,
  saveTemplateStore,
  TEMPLATE_TYPES,
} from "./data/templates.js";
import { loadSettings, saveSettings, selectVisibleProjects } from "./data/settings.js";
import { getProjectTagOptions } from "./data/settings.js";
import {
  createCollection,
  deleteCollection,
  loadCollectionStore,
  moveCollection,
  renameCollection,
  saveCollectionStore,
  sortCollections,
} from "./data/organization.js";
import { useRoute } from "./hooks/useRoute.js";
import { NotFoundPage } from "./pages/NotFoundPage.jsx";
import { OverviewPage } from "./pages/OverviewPage.jsx";
import { ProjectDetailPage } from "./pages/ProjectDetailPage.jsx";
import { ResearchNotesPage } from "./pages/ResearchNotesPage.jsx";
import { UserGuidePage } from "./pages/UserGuidePage.jsx";
import { WorkbenchPage } from "./pages/WorkbenchPage.jsx";
import { getPageTitle, parseRoute } from "./routing.js";

const ResearchNotePage = lazy(() =>
  import("./pages/ResearchNotePage.jsx").then((module) => ({
    default: module.ResearchNotePage,
  })),
);

export function App() {
  const [path, navigate] = useRoute();
  const [storeState, setStoreState] = useState(() => loadProjectStore());
  const [noteStoreState, setNoteStoreState] = useState(() => loadResearchNoteStore());
  const [noteDraftState, setNoteDraftState] = useState(() => loadResearchNoteDraftStore());
  const [noteHistoryState, setNoteHistoryState] = useState(() => loadResearchNoteHistoryStore());
  const [projectEventState, setProjectEventState] = useState(() => loadProjectEventStore());
  const [templateState, setTemplateState] = useState(() => loadTemplateStore());
  const [collectionState, setCollectionState] = useState(() => loadCollectionStore());
  const [settingsState, setSettingsState] = useState(() => loadSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [formState, setFormState] = useState(null);
  const [syncProjectId, setSyncProjectId] = useState(null);
  const [contextProjectId, setContextProjectId] = useState(null);
  const [projectQuery, setProjectQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [collectionFilter, setCollectionFilter] = useState("all");
  const [notice, setNotice] = useState("");

  const projects = storeState.projects;
  const settings = settingsState.settings;
  const dataStoreError =
    storeState.error ||
    noteStoreState.error ||
    noteDraftState.error ||
    noteHistoryState.error ||
    projectEventState.error ||
    templateState.error ||
    collectionState.error;
  const collections = useMemo(
    () => sortCollections(collectionState.collections),
    [collectionState.collections],
  );
  const tagOptions = useMemo(() => getProjectTagOptions(projects), [projects]);
  const summary = useMemo(() => summarizeProjects(projects), [projects]);
  const settingsVisibleProjects = useMemo(
    () => selectVisibleProjects(projects, settings),
    [projects, settings],
  );
  const visibleProjects = useMemo(
    () =>
      selectVisibleProjects(projects, settings, {
        query: projectQuery,
        status: statusFilter,
        tag: tagFilter === "all" ? "" : tagFilter,
        collectionId: collectionFilter,
      }),
    [collectionFilter, projects, projectQuery, settings, statusFilter, tagFilter],
  );
  const recentProjects = useMemo(
    () => sortProjectsByUpdatedAt(settingsVisibleProjects),
    [settingsVisibleProjects],
  );
  const activityNotes = useMemo(() => createResearchNotes(projects), [projects]);
  const researchNotes = useMemo(
    () => sortResearchNotes(noteStoreState.notes),
    [noteStoreState.notes],
  );
  const projectTemplates = useMemo(
    () => getTemplatesByType(templateState.templates, TEMPLATE_TYPES.PROJECT),
    [templateState.templates],
  );
  const noteTemplates = useMemo(
    () => getTemplatesByType(templateState.templates, TEMPLATE_TYPES.NOTE),
    [templateState.templates],
  );
  const route = useMemo(() => parseRoute(path), [path]);
  const project = useMemo(
    () => (route.projectId ? findProjectById(projects, route.projectId) : null),
    [route.projectId, projects],
  );
  const researchNote = useMemo(
    () => (route.noteId ? findResearchNoteById(researchNotes, route.noteId) : null),
    [researchNotes, route.noteId],
  );
  const activeNoteDraftKey = getResearchNoteDraftKey(
    route.type === "note" ? researchNote?.id : "",
    route.type === "note-new" ? route.preferredProjectId : "",
  );
  const activeNoteDraft = findResearchNoteDraft(noteDraftState.drafts, activeNoteDraftKey);
  const activeNoteHistories = researchNote
    ? selectResearchNoteHistories(noteHistoryState.histories, researchNote.id)
    : [];
  const activeProjectEvents = project
    ? selectProjectEvents(projectEventState.events, project.id)
    : [];
  const notesNavActive =
    route.type === "notes" ||
    route.type === "note" ||
    route.type === "note-new" ||
    route.type === "project-notes";
  const activeNav = settingsOpen
    ? "settings"
    : route.type === "workbench"
      ? "workbench"
      : route.type === "guide"
        ? "guide"
        : notesNavActive
          ? "notes"
          : route.type === "overview"
            ? "overview"
            : null;
  const modalOpen =
    settingsOpen || Boolean(formState) || Boolean(syncProjectId) || Boolean(contextProjectId);

  useEffect(() => {
    document.title = getPageTitle(route, project, researchNote);
  }, [route, project, researchNote]);

  useEffect(() => {
    if (tagFilter !== "all" && !tagOptions.includes(tagFilter)) setTagFilter("all");
  }, [tagFilter, tagOptions]);

  useEffect(() => {
    if (
      collectionFilter !== "all" &&
      !collections.some((collection) => collection.id === collectionFilter)
    ) {
      setCollectionFilter("all");
    }
  }, [collectionFilter, collections]);

  const openCreate = () => {
    if (!storeState.error) {
      setFormState({ mode: "create", projectId: null });
    }
  };

  const persistProjects = (nextProjects) => {
    saveProjectStore(nextProjects);
    setStoreState({ projects: nextProjects, error: null });
  };

  const persistResearchNotes = (nextNotes) => {
    saveResearchNoteStore(nextNotes);
    setNoteStoreState({ notes: nextNotes, error: null });
  };

  const persistResearchNoteDrafts = (nextDrafts) => {
    saveResearchNoteDraftStore(nextDrafts);
    setNoteDraftState({ drafts: nextDrafts, error: null });
  };

  const persistResearchNoteHistories = (nextHistories) => {
    saveResearchNoteHistoryStore(nextHistories);
    setNoteHistoryState({ histories: nextHistories, error: null });
  };

  const persistProjectEvents = (nextEvents) => {
    saveProjectEventStore(nextEvents);
    setProjectEventState({ events: nextEvents, error: null });
  };

  const persistTemplates = (nextTemplates) => {
    const normalized = saveTemplateStore(nextTemplates);
    setTemplateState({ templates: normalized, error: null });
  };

  const persistCollections = (nextCollections) => {
    const normalized = saveCollectionStore(nextCollections);
    setCollectionState({ collections: normalized, error: null });
  };

  const collectionResult = (operation, successMessage) => {
    if (collectionState.error) return { ok: false, error: collectionState.error };
    try {
      const nextCollections = operation();
      persistCollections(nextCollections);
      setNotice(successMessage);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message || "项目集合操作失败。" };
    }
  };

  const addCollection = (name) =>
    collectionResult(
      () => [...collections, createCollection(name, collections)],
      "项目集合已创建。",
    );

  const editCollectionName = (collectionId, name) =>
    collectionResult(() => renameCollection(collectionId, name, collections), "项目集合已重命名。");

  const reorderCollection = (collectionId, direction) =>
    collectionResult(
      () => moveCollection(collectionId, direction, collections),
      "项目集合顺序已更新。",
    );

  const removeCollection = (collectionId) => {
    if (collectionState.error) return { ok: false, error: collectionState.error };
    try {
      const result = deleteCollection(collectionId, collections, projects);
      saveProjectStore(result.projects);
      const normalizedCollections = saveCollectionStore(result.collections);
      setStoreState({ projects: result.projects, error: null });
      setCollectionState({ collections: normalizedCollections, error: null });
      if (collectionFilter === collectionId) setCollectionFilter("all");
      setNotice("项目集合已删除，仅解除项目关联。");
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message || "项目集合删除失败。" };
    }
  };

  const templateResult = (operation, successMessage) => {
    if (templateState.error) return { ok: false, error: templateState.error };
    try {
      const nextTemplates = operation();
      if (nextTemplates) persistTemplates(nextTemplates);
      if (successMessage) setNotice(successMessage);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message || "模板操作失败。" };
    }
  };

  const handleProjectTemplate = (action, payload, currentDraft) => {
    if (action === "apply") {
      try {
        return { ok: true, draft: applyProjectTemplate(payload, currentDraft) };
      } catch (error) {
        return { ok: false, error: error.message };
      }
    }
    if (action === "create") {
      return templateResult(
        () => [
          ...templateState.templates,
          createCustomProjectTemplate(
            payload.name,
            payload.source,
            templateState.templates,
            payload.extraFields,
          ),
        ],
        "自定义项目模板已保存。",
      );
    }
    return { ok: false, error: "项目模板操作无效。" };
  };

  const handleNoteTemplate = (action, payload, currentDraft) => {
    if (action === "apply") {
      try {
        return { ok: true, draft: applyNoteTemplate(payload, currentDraft) };
      } catch (error) {
        return { ok: false, error: error.message };
      }
    }
    if (action === "create") {
      return templateResult(
        () => [
          ...templateState.templates,
          createCustomNoteTemplate(payload.name, payload.source, templateState.templates),
        ],
        "自定义研究笔记模板已保存。",
      );
    }
    return { ok: false, error: "研究笔记模板操作无效。" };
  };

  const renameTemplate = (templateId, name) =>
    templateResult(
      () => renameCustomTemplate(templateId, name, templateState.templates),
      "模板已重命名。",
    );

  const duplicateTemplate = (templateId) =>
    templateResult(
      () => duplicateCustomTemplate(templateId, templateState.templates),
      "模板副本已创建。",
    );

  const moveTemplate = (templateId, direction) =>
    templateResult(
      () => moveCustomTemplate(templateId, direction, templateState.templates),
      "模板顺序已更新。",
    );

  const removeTemplate = (templateId) =>
    templateResult(
      () => deleteCustomTemplate(templateId, templateState.templates),
      "模板已删除，已有项目和笔记未受影响。",
    );

  const recordProjectEvent = (event, baseEvents = projectEventState.events) => {
    if (!event) return "";
    if (projectEventState.error) return "变更时间线当前不可用";
    try {
      persistProjectEvents(addProjectEvent(baseEvents, event));
      return "";
    } catch {
      return "变更时间线保存失败";
    }
  };

  const saveResearchNoteDraft = (key, draft, noteId = "") => {
    if (noteDraftState.error) {
      return { ok: false, error: noteDraftState.error };
    }
    try {
      const nextDrafts = upsertResearchNoteDraft(
        key,
        draft,
        noteDraftState.drafts,
        new Date(),
        noteId,
      );
      persistResearchNoteDrafts(nextDrafts);
      const savedDraft = findResearchNoteDraft(nextDrafts, key);
      return { ok: true, updatedAt: savedDraft.updatedAt };
    } catch (error) {
      const message = error.message || "本地草稿保存失败，正式笔记未受影响。";
      setNoteDraftState((current) => ({ ...current, error: message }));
      return { ok: false, error: message };
    }
  };

  const removeResearchNoteDraft = (key) => {
    if (noteDraftState.error) {
      return { ok: false, error: noteDraftState.error };
    }
    try {
      persistResearchNoteDrafts(deleteResearchNoteDraft(noteDraftState.drafts, key));
      return { ok: true };
    } catch (error) {
      const message = error.message || "草稿删除失败。";
      setNoteDraftState((current) => ({ ...current, error: message }));
      return { ok: false, error: message };
    }
  };

  const updateSettings = (partial) => {
    try {
      const nextSettings = saveSettings({ ...settings, ...partial });
      setSettingsState({ settings: nextSettings, error: null });
      setNotice("显示设置已保存。");
    } catch (error) {
      setNotice(error.message || "显示设置保存失败。");
    }
  };

  const createProject = (draft, sourceMetadata = null) => {
    try {
      const created = createProjectRecord(draft, projects, sourceMetadata);
      persistProjects([...projects, created]);
      const timelineWarning = recordProjectEvent(createProjectCreatedEvent(created));
      setFormState(null);
      setNotice("已创建项目：" + created.name + (timelineWarning ? `；${timelineWarning}。` : ""));
      navigate("/project/" + created.id);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error.message || "项目保存失败，请重试。",
      };
    }
  };

  const editProject = (draft) => {
    try {
      const edited = updateProjectRecord(formState.projectId, draft, projects);
      persistProjects(projects.map((item) => (item.id === edited.id ? edited : item)));
      const previous = findProjectById(projects, edited.id);
      const timelineWarning = recordProjectEvent(createProjectUpdatedEvent(previous, edited));
      setFormState(null);
      setNotice("已保存项目：" + edited.name + (timelineWarning ? `；${timelineWarning}。` : ""));
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error.message || "项目保存失败，请重试。",
      };
    }
  };

  const duplicateProject = () => {
    try {
      const duplicate = duplicateProjectRecord(project.id, projects);
      persistProjects([...projects, duplicate]);
      const timelineWarning = recordProjectEvent(createProjectCreatedEvent(duplicate));
      setNotice(
        "已复制项目：" + duplicate.name + (timelineWarning ? `；${timelineWarning}。` : ""),
      );
      navigate("/project/" + duplicate.id);
    } catch (error) {
      setNotice(error.message || "复制项目失败。");
    }
  };

  const removeProject = () => {
    if (noteStoreState.error) {
      setNotice("研究笔记本地数据当前无法读取，请先在设置中恢复或清除损坏数据。");
      return;
    }
    const relatedNotes = researchNotes.filter((note) => note.projectId === project.id);
    const relatedMessage = relatedNotes.length
      ? `并同时删除关联的 ${relatedNotes.length} 篇研究笔记`
      : "";
    if (
      !window.confirm(
        "确定删除项目“" + project.name + "”" + relatedMessage + "吗？此操作无法撤销。",
      )
    ) {
      return;
    }

    try {
      persistProjects(deleteProjectRecord(project.id, projects));
      persistResearchNotes(deleteResearchNotesForProject(project.id, researchNotes));
      const cleanupWarnings = [];
      if (!noteDraftState.error) {
        try {
          persistResearchNoteDrafts(
            deleteResearchNoteDraftsForProject(noteDraftState.drafts, project.id),
          );
        } catch {
          cleanupWarnings.push("草稿清理失败");
        }
      }
      if (!noteHistoryState.error) {
        try {
          persistResearchNoteHistories(
            deleteResearchNoteHistoriesForProject(noteHistoryState.histories, project.id),
          );
        } catch {
          cleanupWarnings.push("版本历史清理失败");
        }
      }
      if (!projectEventState.error) {
        try {
          persistProjectEvents(deleteProjectEventsForProject(projectEventState.events, project.id));
        } catch {
          cleanupWarnings.push("变更时间线清理失败");
        }
      } else {
        cleanupWarnings.push("变更时间线当前不可用");
      }
      setNotice(
        "已删除项目：" +
          project.name +
          (cleanupWarnings.length ? `；${cleanupWarnings.join("、")}。` : ""),
      );
      navigate("/");
    } catch (error) {
      setNotice(error.message || "删除项目失败。");
    }
  };

  const exportProjects = () => {
    const blob = new Blob(
      [
        createAppBackup(
          projects,
          researchNotes,
          noteHistoryState.histories,
          projectEventState.events,
          templateState.templates,
          collections,
        ),
      ],
      {
        type: "application/json;charset=utf-8",
      },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "agent-projects-" + new Date().toISOString().slice(0, 10) + ".json";
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice(
      "已导出 " +
        projects.length +
        " 个项目、" +
        researchNotes.length +
        " 篇研究笔记和 " +
        noteHistoryState.histories.length +
        " 个历史版本和 " +
        projectEventState.events.length +
        " 条变更事件和 " +
        templateState.templates.length +
        " 个自定义模板和 " +
        collections.length +
        " 个项目集合。",
    );
  };

  const importProjects = async (raw, mode) => {
    try {
      const result = importAppBackup(
        raw,
        projects,
        researchNotes,
        mode,
        noteHistoryState.histories,
        projectEventState.events,
        templateState.templates,
        collections,
      );
      persistProjects(result.projects);
      persistResearchNotes(result.notes);
      persistResearchNoteHistories(result.histories);
      persistProjectEvents(result.events);
      persistTemplates(result.templates);
      persistCollections(result.collections);
      setNotice(
        "已导入 " +
          result.importedCount +
          " 个项目和 " +
          result.importedNotesCount +
          " 篇研究笔记和 " +
          result.importedEventsCount +
          " 条变更事件和 " +
          result.importedTemplatesCount +
          " 个自定义模板和 " +
          result.importedCollectionsCount +
          " 个项目集合" +
          (result.reassignedIds ? "，" + result.reassignedIds + " 个冲突 ID 已重新生成" : "") +
          "。",
      );
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error.message || "导入失败，现有数据未更改。",
      };
    }
  };

  const resetProjects = () => {
    const resetMessage = dataStoreError
      ? "确定清除当前损坏的本地项目、研究笔记或模板数据吗？此操作无法撤销。"
      : `确定清空全部 ${projects.length} 个项目、${researchNotes.length} 篇研究笔记、${templateState.templates.length} 个自定义模板和 ${collections.length} 个项目集合吗？此操作无法撤销。`;
    if (!window.confirm(resetMessage)) return;

    try {
      persistProjects([]);
      persistResearchNotes([]);
      persistResearchNoteDrafts([]);
      persistResearchNoteHistories([]);
      persistProjectEvents([]);
      persistTemplates([]);
      persistCollections([]);
      setSettingsOpen(false);
      setNotice("已清空全部项目、研究笔记、自定义模板和项目集合。");
      navigate("/");
    } catch (error) {
      setNotice(error.message || "清空项目失败。");
    }
  };

  const updateProjectTask = (projectId, taskId) => {
    try {
      const currentProject = findProjectById(projects, projectId);
      const currentTask = currentProject?.nextTasks.find((task) => task.id === taskId);
      const nextProjects = toggleProjectTask(projectId, taskId, projects);
      const nextProject = findProjectById(nextProjects, projectId);
      persistProjects(nextProjects);
      const timelineWarning = recordProjectEvent(
        createTaskToggledEvent(currentProject, nextProject, taskId),
      );
      const message = currentTask?.done ? "任务已恢复为待办。" : "任务已标记完成。";
      const completeMessage = message + (timelineWarning ? ` ${timelineWarning}。` : "");
      setNotice(completeMessage);
      return { ok: true, message: completeMessage };
    } catch (error) {
      const message = error.message || "任务状态更新失败。";
      setNotice(message);
      return { ok: false, error: message };
    }
  };

  const toggleProjectPin = (projectId, pinned) => {
    try {
      persistProjects(setProjectPinned(projectId, pinned, projects));
      setNotice(pinned ? "项目已置顶。" : "项目已取消置顶。");
      return { ok: true };
    } catch (error) {
      const message = error.message || "项目置顶状态更新失败。";
      setNotice(message);
      return { ok: false, error: message };
    }
  };

  const resolveProjectBlocker = (projectId, blockerId) => {
    try {
      const currentProject = findProjectById(projects, projectId);
      const nextProjects = toggleProjectBlocker(projectId, blockerId, projects);
      const nextProject = findProjectById(nextProjects, projectId);
      persistProjects(nextProjects);
      const timelineWarning = recordProjectEvent(
        createBlockerToggledEvent(currentProject, nextProject, blockerId),
      );
      const message = "阻塞项已标记解决。" + (timelineWarning ? ` ${timelineWarning}。` : "");
      setNotice(message);
      return { ok: true, message };
    } catch (error) {
      const message = error.message || "阻塞项更新失败。";
      setNotice(message);
      return { ok: false, error: message };
    }
  };

  const syncProjectStatus = (syncResult) => {
    try {
      const previous = findProjectById(projects, syncProjectId);
      const nextProjects = applyProjectStatusSync(syncProjectId, syncResult, projects);
      const nextProject = findProjectById(nextProjects, syncProjectId);
      persistProjects(nextProjects);
      const timelineWarning = recordProjectEvent(
        createLocalStatusEvent(previous, nextProject, syncResult),
      );
      setSyncProjectId(null);
      setNotice(
        "已从本地来源更新项目状态，未上传任何文件。" +
          (timelineWarning ? ` ${timelineWarning}。` : ""),
      );
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message || "本地状态同步失败。" };
    }
  };

  const saveResearchNote = (draft) => {
    if (noteStoreState.error) {
      return {
        ok: false,
        error: "本地研究笔记数据当前无法读取，请先从设置中恢复备份或清除损坏数据。",
      };
    }
    try {
      const saved =
        route.type === "note" && researchNote
          ? updateResearchNoteRecord(researchNote.id, draft, researchNotes, projects)
          : createResearchNoteRecord(draft, researchNotes, projects);
      const nextNotes =
        route.type === "note" && researchNote
          ? researchNotes.map((note) => (note.id === saved.id ? saved : note))
          : [...researchNotes, saved];
      persistResearchNotes(nextNotes);
      const warnings = [];
      const timelineWarning = recordProjectEvent(
        createResearchNoteEvent(
          saved,
          route.type === "note" ? "updated" : "created",
          new Date(),
          researchNote,
        ),
      );
      if (timelineWarning) warnings.push(timelineWarning);
      if (!noteHistoryState.error) {
        try {
          persistResearchNoteHistories(
            addResearchNoteHistorySnapshot(saved, noteHistoryState.histories),
          );
        } catch {
          warnings.push("版本历史保存失败");
        }
      } else {
        warnings.push("版本历史当前不可用");
      }
      if (!noteDraftState.error) {
        try {
          persistResearchNoteDrafts(
            deleteResearchNoteDraft(noteDraftState.drafts, activeNoteDraftKey),
          );
        } catch {
          warnings.push("过期草稿清理失败");
        }
      }
      setNotice(
        (route.type === "note" ? "已保存研究笔记：" : "已创建研究笔记：") +
          saved.title +
          (warnings.length ? `；${warnings.join("、")}。` : ""),
      );
      navigate("/notes/" + saved.id);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        fields: error.fields,
        error: error.message || "研究笔记保存失败。",
      };
    }
  };

  const removeResearchNote = () => {
    if (!researchNote) return;
    if (!window.confirm(`确定删除研究笔记“${researchNote.title}”吗？此操作无法撤销。`)) {
      return;
    }
    try {
      persistResearchNotes(deleteResearchNoteRecord(researchNote.id, researchNotes));
      const warnings = [];
      const markedEvents = markResearchNoteSourceDeleted(projectEventState.events, researchNote.id);
      const timelineWarning = recordProjectEvent(
        createResearchNoteEvent(researchNote, "deleted"),
        markedEvents,
      );
      if (timelineWarning) warnings.push(timelineWarning);
      if (!noteDraftState.error) {
        try {
          persistResearchNoteDrafts(
            deleteResearchNoteDraftsForNote(noteDraftState.drafts, researchNote.id),
          );
        } catch {
          warnings.push("草稿清理失败");
        }
      }
      if (!noteHistoryState.error) {
        try {
          persistResearchNoteHistories(
            deleteResearchNoteHistoriesForNote(noteHistoryState.histories, researchNote.id),
          );
        } catch {
          warnings.push("版本历史清理失败");
        }
      }
      setNotice(
        "已删除研究笔记：" +
          researchNote.title +
          (warnings.length ? `；${warnings.join("、")}。` : ""),
      );
      navigate("/notes");
    } catch (error) {
      setNotice(error.message || "删除研究笔记失败。");
    }
  };

  const editingProject =
    formState?.mode === "edit" ? findProjectById(projects, formState.projectId) : null;
  const syncingProject = syncProjectId ? findProjectById(projects, syncProjectId) : null;
  const contextProject = contextProjectId ? findProjectById(projects, contextProjectId) : null;

  let page;
  if (route.type === "overview") {
    page = (
      <OverviewPage
        projects={projects}
        visibleProjects={visibleProjects}
        summary={summary}
        recentProjects={recentProjects}
        showRecent={settings.showRecent}
        onAdd={openCreate}
        onOpenSettings={() => setSettingsOpen(true)}
        navigate={navigate}
        storeError={storeState.error}
        query={projectQuery}
        statusFilter={statusFilter}
        tagFilter={tagFilter}
        collectionFilter={collectionFilter}
        tagOptions={tagOptions}
        collections={collections}
        sortBy={settings.sortBy}
        onQueryChange={setProjectQuery}
        onStatusFilterChange={setStatusFilter}
        onTagFilterChange={setTagFilter}
        onCollectionFilterChange={setCollectionFilter}
        onSortChange={(sortBy) => updateSettings({ sortBy })}
        onTogglePin={toggleProjectPin}
      />
    );
  } else if (route.type === "workbench") {
    page = (
      <WorkbenchPage
        projects={projects}
        researchNotes={researchNotes}
        navigate={navigate}
        onAddProject={openCreate}
        onToggleTask={updateProjectTask}
        onResolveBlocker={resolveProjectBlocker}
        storeError={storeState.error || noteStoreState.error}
        collections={collections}
      />
    );
  } else if (route.type === "guide") {
    page = <UserGuidePage navigate={navigate} />;
  } else if (route.type === "notes") {
    page = (
      <ResearchNotesPage
        projects={projects}
        researchNotes={researchNotes}
        activityNotes={activityNotes}
        onAddProject={openCreate}
        onNewNote={() => navigate("/notes/new")}
        navigate={navigate}
        storeError={storeState.error || noteStoreState.error}
      />
    );
  } else if (route.type === "note-new") {
    if (
      !route.preferredProjectId ||
      projects.some((item) => item.id === route.preferredProjectId)
    ) {
      page = (
        <ResearchNotePage
          note={null}
          projects={projects}
          preferredProjectId={route.preferredProjectId}
          onSave={saveResearchNote}
          onDelete={() => {}}
          navigate={navigate}
          storeError={noteStoreState.error}
          draftKey={activeNoteDraftKey}
          savedDraft={activeNoteDraft}
          draftStoreError={noteDraftState.error}
          histories={[]}
          historyStoreError={noteHistoryState.error}
          onSaveDraft={saveResearchNoteDraft}
          onDeleteDraft={removeResearchNoteDraft}
          templates={noteTemplates}
          templateStoreError={templateState.error}
          onCreateTemplate={handleNoteTemplate}
          onRenameTemplate={renameTemplate}
          onDuplicateTemplate={duplicateTemplate}
          onMoveTemplate={moveTemplate}
          onDeleteTemplate={removeTemplate}
        />
      );
    } else {
      page = <NotFoundPage projectMissing navigate={navigate} />;
    }
  } else if (route.type === "note" && researchNote) {
    page = (
      <ResearchNotePage
        note={researchNote}
        projects={projects}
        onSave={saveResearchNote}
        onDelete={removeResearchNote}
        navigate={navigate}
        storeError={noteStoreState.error}
        draftKey={activeNoteDraftKey}
        savedDraft={activeNoteDraft}
        draftStoreError={noteDraftState.error}
        histories={activeNoteHistories}
        historyStoreError={noteHistoryState.error}
        onSaveDraft={saveResearchNoteDraft}
        onDeleteDraft={removeResearchNoteDraft}
        templates={noteTemplates}
        templateStoreError={templateState.error}
        onCreateTemplate={handleNoteTemplate}
        onRenameTemplate={renameTemplate}
        onDuplicateTemplate={duplicateTemplate}
        onMoveTemplate={moveTemplate}
        onDeleteTemplate={removeTemplate}
      />
    );
  } else if ((route.type === "project" || route.type === "project-notes") && project) {
    page = (
      <ProjectDetailPage
        project={project}
        researchNotes={selectProjectResearchNotes(researchNotes, project.id)}
        projectEvents={activeProjectEvents}
        eventStoreError={projectEventState.error}
        notesMode={route.type === "project-notes"}
        navigate={navigate}
        onEdit={() => setFormState({ mode: "edit", projectId: project.id })}
        onDuplicate={duplicateProject}
        onDelete={removeProject}
        onToggleTask={(taskId) => updateProjectTask(project.id, taskId)}
        onOpenSync={() => setSyncProjectId(project.id)}
        onOpenCodexContext={() => setContextProjectId(project.id)}
        onNewResearchNote={() => navigate(`/notes/new/project/${project.id}`)}
      />
    );
  } else {
    page = (
      <NotFoundPage
        projectMissing={route.type === "project" || route.type === "project-notes"}
        noteMissing={route.type === "note"}
        navigate={navigate}
      />
    );
  }

  return (
    <div className={"app-shell density-" + settings.density}>
      <div
        className="page-content"
        inert={modalOpen ? true : undefined}
        aria-hidden={modalOpen ? "true" : undefined}
      >
        <Header
          navigate={navigate}
          activeNav={activeNav}
          settingsOpen={settingsOpen}
          onSettings={() => setSettingsOpen(true)}
          onAdd={openCreate}
          addDisabled={Boolean(storeState.error)}
        />
        <Suspense
          fallback={
            <main className="route-loading" aria-live="polite">
              <p className="eyebrow">LOADING LOCAL VIEW</p>
              <strong>正在载入本地页面…</strong>
            </main>
          }
        >
          {page}
        </Suspense>
        <footer className="site-footer">
          <div className="footer-meta">
            <span>LOCAL-FIRST · PRIVATE · VERSION 1.0.0</span>
            <span>DATA STORED LOCALLY</span>
          </div>
          <a
            className="github-link"
            href="https://github.com/0xbliss300/Agent-Atlas.git"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="在 GitHub 查看 0xbliss300 的 Agent Atlas 开源仓库"
          >
            <GithubLogo size={21} weight="fill" aria-hidden="true" />
            <span>
              <strong>OPEN SOURCE ON GITHUB</strong>
              <small>0xbliss300/Agent-Atlas</small>
            </span>
          </a>
        </footer>
      </div>

      <p className="sr-only" aria-live="polite">
        {notice}
      </p>

      {settingsOpen && (
        <SettingsPanel
          close={() => setSettingsOpen(false)}
          projects={projects}
          researchNotes={researchNotes}
          projectEvents={projectEventState.events}
          templates={templateState.templates}
          collections={collections}
          collectionStoreError={collectionState.error}
          storeError={dataStoreError}
          settings={settings}
          settingsError={settingsState.error}
          onSettingsChange={updateSettings}
          onExport={exportProjects}
          onImport={importProjects}
          onReset={resetProjects}
          onCreateCollection={addCollection}
          onRenameCollection={editCollectionName}
          onMoveCollection={reorderCollection}
          onDeleteCollection={removeCollection}
        />
      )}

      {formState && (
        <ProjectFormPanel
          project={editingProject}
          existingProjects={projects}
          templates={projectTemplates}
          collections={collections}
          templateStoreError={templateState.error}
          onCreateTemplate={handleProjectTemplate}
          onRenameTemplate={renameTemplate}
          onDuplicateTemplate={duplicateTemplate}
          onMoveTemplate={moveTemplate}
          onDeleteTemplate={removeTemplate}
          onClose={() => setFormState(null)}
          onSave={formState.mode === "edit" ? editProject : createProject}
        />
      )}

      {syncingProject && (
        <LocalSyncPanel
          project={syncingProject}
          onClose={() => setSyncProjectId(null)}
          onApply={syncProjectStatus}
        />
      )}

      {contextProject && (
        <CodexContextPanel
          project={contextProject}
          researchNotes={selectProjectResearchNotes(researchNotes, contextProject.id)}
          onClose={() => setContextProjectId(null)}
        />
      )}
    </div>
  );
}
