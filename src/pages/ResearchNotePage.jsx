import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowCounterClockwise,
  ArrowLeft,
  ClockCounterClockwise,
  Eye,
  FloppyDisk,
  GitDiff,
  NotePencil,
  PencilSimple,
  Trash,
  X,
} from "@phosphor-icons/react";
import { MarkdownRenderer } from "../components/MarkdownRenderer.jsx";
import { TemplateWorkspace } from "../components/TemplateWorkspace.jsx";
import { useConfirmDialog } from "../components/ConfirmDialog.jsx";
import { createNoteDraftDiff } from "../data/noteWorkspace.js";
import { EMPTY_RESEARCH_NOTE_DRAFT } from "../data/researchNotes.js";

export const NOTE_AUTOSAVE_DELAY = 700;

function noteToDraft(note, preferredProjectId) {
  if (note) {
    return {
      projectId: note.projectId,
      title: note.title,
      body: note.body,
    };
  }
  return {
    ...EMPTY_RESEARCH_NOTE_DRAFT,
    projectId: preferredProjectId ?? "",
    body: "# 研究主题\n\n记录问题、假设、实验过程与结论。",
  };
}

function draftsEqual(left, right) {
  return (
    left.projectId === right.projectId && left.title === right.title && left.body === right.body
  );
}

function formatLocalTime(value) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "时间未知";
  return new Date(timestamp).toLocaleString("zh-CN", {
    hour12: false,
    dateStyle: "short",
    timeStyle: "short",
  });
}

function NoteDiff({ base, candidate }) {
  const diff = useMemo(() => createNoteDraftDiff(base, candidate), [base, candidate]);
  const changedBody = diff.body.filter((line) => line.type !== "same").slice(0, 240);
  return (
    <div className="note-diff" aria-label="笔记差异预览">
      {diff.fields.length > 0 && (
        <dl className="note-field-diff">
          {diff.fields.map((field) => (
            <div key={field.key}>
              <dt>{field.label}</dt>
              <dd>
                <del>{field.before || "未填写"}</del>
                <ins>{field.after || "未填写"}</ins>
              </dd>
            </div>
          ))}
        </dl>
      )}
      {changedBody.length ? (
        <pre className="note-line-diff">
          {changedBody.map((line, index) => (
            <span className={line.type} key={`${line.type}-${line.line}-${index}`}>
              <b>{line.type === "added" ? "+" : "−"}</b>
              <code>{line.type === "added" ? line.after : line.before || " "}</code>
            </span>
          ))}
          {diff.body.filter((line) => line.type !== "same").length > changedBody.length && (
            <small>差异较长，仅预览前 {changedBody.length} 行；恢复操作仍会保留完整正文。</small>
          )}
        </pre>
      ) : (
        <p className="inline-empty">
          {diff.changed ? "正文没有变化。" : "该版本与当前内容没有差异。"}
        </p>
      )}
    </div>
  );
}

function DraftRecovery({ savedDraft, formalDraft, diffOpen, onToggleDiff, onRestore, onDiscard }) {
  return (
    <section className="draft-recovery" aria-labelledby="draft-recovery-title">
      <div>
        <p className="eyebrow">LOCAL DRAFT FOUND</p>
        <h2 id="draft-recovery-title">发现更新的本地草稿</h2>
        <p>保存于 {formatLocalTime(savedDraft.updatedAt)}，尚未覆盖正式笔记。</p>
      </div>
      <div className="draft-recovery-actions">
        <button type="button" className="primary-button" onClick={onRestore}>
          <ArrowCounterClockwise size={17} />
          恢复草稿
        </button>
        <button type="button" className="secondary-button" onClick={onToggleDiff}>
          <GitDiff size={17} />
          {diffOpen ? "收起差异" : "查看差异"}
        </button>
        <button type="button" className="secondary-button" onClick={onDiscard}>
          <X size={17} />
          放弃草稿
        </button>
      </div>
      {diffOpen && <NoteDiff base={formalDraft} candidate={savedDraft} />}
    </section>
  );
}

function NoteHistoryPanel({
  histories,
  currentDraft,
  selectedHistoryId,
  onPreview,
  onRestore,
  onClose,
  storeError,
}) {
  const selected = histories.find((history) => history.id === selectedHistoryId);
  return (
    <section className="note-history-panel" aria-labelledby="note-history-title">
      <div className="context-section-heading">
        <div>
          <p className="eyebrow">LOCAL VERSION HISTORY</p>
          <h2 id="note-history-title">版本历史</h2>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="关闭版本历史">
          <X size={19} />
        </button>
      </div>
      <p className="history-retention">每篇笔记仅保留最近 10 个正式保存版本，最新版本排在最前。</p>
      {storeError && (
        <p className="form-submit-error" role="alert">
          {storeError}
        </p>
      )}
      {!storeError && histories.length === 0 && (
        <p className="inline-empty">尚无正式保存版本；首次保存后会在这里建立快照。</p>
      )}
      {!storeError && histories.length > 0 && (
        <div className="note-history-layout">
          <div className="note-history-list">
            {histories.map((history, index) => (
              <article
                className={selectedHistoryId === history.id ? "selected" : ""}
                key={history.id}
              >
                <div>
                  <small>版本 {histories.length - index}</small>
                  <time>{formatLocalTime(history.createdAt)}</time>
                </div>
                <h3>{history.title}</h3>
                <p>{history.excerpt}</p>
                <div>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => onPreview(history.id)}
                  >
                    <GitDiff size={16} />
                    预览差异
                  </button>
                  <button type="button" className="text-button" onClick={() => onRestore(history)}>
                    <ArrowCounterClockwise size={16} />
                    恢复此版本
                  </button>
                </div>
              </article>
            ))}
          </div>
          <div className="history-diff-preview">
            {selected ? (
              <>
                <strong>与当前内容的差异</strong>
                <NoteDiff
                  base={currentDraft}
                  candidate={{
                    projectId: selected.projectId,
                    title: selected.title,
                    body: selected.body,
                  }}
                />
              </>
            ) : (
              <p className="inline-empty">选择“预览差异”查看历史版本与当前内容的区别。</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export function ResearchNotePage({
  note,
  projects,
  preferredProjectId,
  onSave,
  onDelete,
  navigate,
  storeError,
  draftKey = "",
  savedDraft = null,
  draftStoreError = null,
  histories = [],
  historyStoreError = null,
  onSaveDraft = () => ({ ok: true, updatedAt: new Date().toISOString() }),
  onDeleteDraft = () => ({ ok: true }),
  templates = [],
  templateStoreError = "",
  onCreateTemplate,
  onRenameTemplate,
  onDuplicateTemplate,
  onMoveTemplate,
  onDeleteTemplate,
}) {
  const isNew = !note;
  const initialDraft = useMemo(
    () => noteToDraft(note, preferredProjectId),
    [note, preferredProjectId],
  );
  const [draft, setDraft] = useState(initialDraft);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [editing, setEditing] = useState(isNew);
  const [mobileMode, setMobileMode] = useState("edit");
  const [draftStatus, setDraftStatus] = useState({
    state: draftStoreError ? "failed" : "idle",
    updatedAt: null,
    error: draftStoreError ?? "",
  });
  const [recoveryDismissed, setRecoveryDismissed] = useState(false);
  const [recoveryDiffOpen, setRecoveryDiffOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);
  const saveDraftRef = useRef(onSaveDraft);
  const deleteDraftRef = useRef(onDeleteDraft);
  const changedDraftKeysRef = useRef(new Set());
  const confirmDialog = useConfirmDialog();
  saveDraftRef.current = onSaveDraft;
  deleteDraftRef.current = onDeleteDraft;

  useEffect(() => {
    setDraft(initialDraft);
    setErrors({});
    setSubmitError("");
    setEditing(isNew);
    setMobileMode(isNew ? "edit" : "preview");
    setRecoveryDismissed(false);
    setRecoveryDiffOpen(false);
    setHistoryOpen(false);
    setSelectedHistoryId(null);
    setDraftStatus({
      state: draftStoreError ? "failed" : "idle",
      updatedAt: null,
      error: draftStoreError ?? "",
    });
  }, [initialDraft, isNew]);

  useEffect(() => {
    if (!draftStoreError) return;
    setDraftStatus({ state: "failed", updatedAt: null, error: draftStoreError });
  }, [draftStoreError]);

  const project = projects.find((item) => item.id === (note?.projectId ?? draft.projectId));
  const dirty = !draftsEqual(draft, initialDraft);
  const parsedFormalTimestamp = Date.parse(note?.updatedAt || note?.updated || "");
  const formalTimestamp = Number.isFinite(note?.updatedTimestamp)
    ? note.updatedTimestamp
    : Number.isFinite(parsedFormalTimestamp)
      ? parsedFormalTimestamp
      : 0;
  const recoveryAvailable =
    Boolean(savedDraft) &&
    !recoveryDismissed &&
    !changedDraftKeysRef.current.has(draftKey) &&
    !draftsEqual(savedDraft, initialDraft) &&
    (isNew || savedDraft.updatedTimestamp > formalTimestamp);

  useEffect(() => {
    if (!editing || !dirty || draftStoreError || !draftKey) return undefined;
    const timer = window.setTimeout(() => {
      const result = saveDraftRef.current(draftKey, draft, note?.id ?? "");
      if (result.ok) {
        setDraftStatus({ state: "saved", updatedAt: result.updatedAt, error: "" });
      } else {
        setDraftStatus({
          state: "failed",
          updatedAt: null,
          error: result.error || "草稿保存失败。",
        });
      }
    }, NOTE_AUTOSAVE_DELAY);
    return () => window.clearTimeout(timer);
  }, [draft, draftKey, draftStoreError, dirty, editing, note?.id]);

  useEffect(() => {
    if (!editing || !dirty || !draftKey) return undefined;
    const flushBeforeUnload = () => {
      saveDraftRef.current(draftKey, draft, note?.id ?? "");
    };
    window.addEventListener("beforeunload", flushBeforeUnload);
    return () => window.removeEventListener("beforeunload", flushBeforeUnload);
  }, [draft, draftKey, dirty, editing, note?.id]);

  const change = (field, value) => {
    changedDraftKeysRef.current.add(draftKey);
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError("");
    setDraftStatus({
      state: draftStoreError ? "failed" : "saving",
      updatedAt: null,
      error: draftStoreError ?? "",
    });
  };

  const submit = (event) => {
    event.preventDefault();
    const result = onSave(draft);
    if (result.ok) return;
    setErrors(result.fields ?? {});
    setSubmitError(result.error ?? "研究笔记保存失败。");
  };

  const leave = async () => {
    if (dirty && editing) {
      const result = saveDraftRef.current(draftKey, draft, note?.id ?? "");
      if (!result.ok) {
        const ok = await confirmDialog({
          title: "放弃未保存的草稿",
          message: "本地草稿保存失败，当前修改可能丢失。仍然离开吗？",
          confirmText: "仍然离开",
          danger: true,
        });
        if (!ok) return;
      }
    }
    navigate("/notes");
  };

  const restoreDraft = () => {
    changedDraftKeysRef.current.add(draftKey);
    setDraft({
      projectId: savedDraft.projectId,
      title: savedDraft.title,
      body: savedDraft.body,
    });
    setEditing(true);
    setRecoveryDismissed(true);
    setRecoveryDiffOpen(false);
    setDraftStatus({ state: "saved", updatedAt: savedDraft.updatedAt, error: "" });
  };

  const discardDraft = () => {
    changedDraftKeysRef.current.add(draftKey);
    const result = deleteDraftRef.current(draftKey);
    if (result.ok) {
      setRecoveryDismissed(true);
      setRecoveryDiffOpen(false);
      setDraftStatus({ state: "idle", updatedAt: null, error: "" });
    } else {
      setDraftStatus({
        state: "failed",
        updatedAt: null,
        error: result.error || "草稿删除失败。",
      });
    }
  };

  const restoreHistory = (history) => {
    changedDraftKeysRef.current.add(draftKey);
    setDraft({
      projectId: history.projectId,
      title: history.title,
      body: history.body,
    });
    setEditing(true);
    setMobileMode("edit");
    setHistoryOpen(false);
    setSelectedHistoryId(null);
    setRecoveryDismissed(true);
    setSubmitError("");
    setDraftStatus({
      state: draftStoreError ? "failed" : "saving",
      updatedAt: null,
      error: draftStoreError ?? "",
    });
  };

  if (!projects.length) {
    return (
      <main className="not-found-page">
        <section className="empty-state">
          <p className="eyebrow">RESEARCH NOTE</p>
          <h1>请先创建项目</h1>
          <p>每篇研究笔记都需要归属一个项目，创建项目后才能开始记录。</p>
          <button className="primary-button" onClick={() => navigate("/")}>
            <ArrowLeft size={18} />
            返回项目概览
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="research-note-page">
      {storeError && (
        <div className="store-error" role="alert">
          <strong>本地研究笔记读取失败</strong>
          <span>{storeError}</span>
        </div>
      )}

      <div className="detail-toolbar note-detail-toolbar">
        <button className="back-link" onClick={leave}>
          <ArrowLeft size={18} />
          返回研究笔记
        </button>
        {!isNew && (
          <div className="manage-actions" aria-label="研究笔记管理">
            <button
              className="secondary-button"
              onClick={() => {
                setHistoryOpen((current) => !current);
                setSelectedHistoryId(null);
              }}
            >
              <ClockCounterClockwise size={17} />
              版本历史 ({histories.length})
            </button>
            {!editing && (
              <>
                <button className="secondary-button" onClick={() => setEditing(true)}>
                  <PencilSimple size={17} />
                  编辑
                </button>
                <button className="danger-button" onClick={onDelete}>
                  <Trash size={17} />
                  删除
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {recoveryAvailable && (
        <DraftRecovery
          savedDraft={savedDraft}
          formalDraft={initialDraft}
          diffOpen={recoveryDiffOpen}
          onToggleDiff={() => setRecoveryDiffOpen((current) => !current)}
          onRestore={restoreDraft}
          onDiscard={discardDraft}
        />
      )}

      {historyOpen && (
        <NoteHistoryPanel
          histories={histories}
          currentDraft={editing ? draft : initialDraft}
          selectedHistoryId={selectedHistoryId}
          onPreview={setSelectedHistoryId}
          onRestore={restoreHistory}
          onClose={() => {
            setHistoryOpen(false);
            setSelectedHistoryId(null);
          }}
          storeError={historyStoreError}
        />
      )}

      {!isNew && !editing ? (
        <article className="note-reader">
          <header className="note-reader-head">
            <div>
              <p className="eyebrow">RESEARCH NOTE · {project?.name ?? "项目不存在"}</p>
              <h1>{note.title}</h1>
              <p>
                创建于 {note.created} · 更新于 {note.updated} {note.updatedTime}
              </p>
            </div>
            <NotePencil size={38} weight="light" />
          </header>
          <MarkdownRenderer>{note.body}</MarkdownRenderer>
        </article>
      ) : (
        <form className="note-editor" onSubmit={submit}>
          <header className="note-editor-head">
            <div>
              <p className="eyebrow">{isNew ? "NEW RESEARCH NOTE" : "EDIT RESEARCH NOTE"}</p>
              <h1>{isNew ? "新建研究笔记" : "编辑研究笔记"}</h1>
              <p>Markdown 和自动草稿只保存在当前浏览器，不会发送到外部服务。</p>
              <p
                className={`note-autosave-status is-${draftStatus.state}`}
                role="status"
                aria-live="polite"
              >
                {draftStatus.state === "saving" && "正在保存草稿…"}
                {draftStatus.state === "saved" &&
                  `草稿已保存 · ${formatLocalTime(draftStatus.updatedAt)}`}
                {draftStatus.state === "failed" &&
                  `保存失败 · ${draftStatus.error || "请检查本地存储空间。"}`}
                {draftStatus.state === "idle" && "修改后将自动保存本地草稿"}
              </p>
            </div>
            <div className="note-mobile-tabs" aria-label="移动端编辑模式">
              <button
                type="button"
                className={mobileMode === "edit" ? "active" : ""}
                onClick={() => setMobileMode("edit")}
              >
                <PencilSimple size={16} />
                编辑
              </button>
              <button
                type="button"
                className={mobileMode === "preview" ? "active" : ""}
                onClick={() => setMobileMode("preview")}
              >
                <Eye size={16} />
                预览
              </button>
            </div>
          </header>

          <TemplateWorkspace
            type="note"
            templates={templates}
            canApply={isNew}
            onApply={(template) => {
              const result = onCreateTemplate?.("apply", template, draft);
              if (result?.ok === false) return result;
              changedDraftKeysRef.current.add(draftKey);
              setDraft(result?.draft ?? draft);
              setErrors({});
              setSubmitError("");
              setDraftStatus({
                state: draftStoreError ? "failed" : "saving",
                updatedAt: null,
                error: draftStoreError ?? "",
              });
              return { ok: true };
            }}
            onCreate={(name) =>
              onCreateTemplate?.("create", {
                name,
                source: draft,
              })
            }
            onRename={onRenameTemplate}
            onDuplicate={onDuplicateTemplate}
            onMove={onMoveTemplate}
            onDelete={onDeleteTemplate}
            storeError={templateStoreError}
          />

          <div className="note-fields">
            <label className={"form-field " + (errors.projectId ? "has-error" : "")}>
              <span>
                所属项目 <b>*</b>
              </span>
              <select
                value={draft.projectId}
                onChange={(event) => change("projectId", event.target.value)}
                aria-describedby={errors.projectId ? "note-project-error" : undefined}
              >
                <option value="">请选择项目</option>
                {projects.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              {errors.projectId && (
                <small className="field-error" id="note-project-error">
                  {errors.projectId}
                </small>
              )}
            </label>
            <label className={"form-field " + (errors.title ? "has-error" : "")}>
              <span>
                笔记标题 <b>*</b>
              </span>
              <input
                value={draft.title}
                onChange={(event) => change("title", event.target.value)}
                placeholder="例如：本地检索架构调研"
                aria-describedby={errors.title ? "note-title-error" : undefined}
              />
              {errors.title && (
                <small className="field-error" id="note-title-error">
                  {errors.title}
                </small>
              )}
            </label>
          </div>

          <div className="note-editor-grid" data-mobile-mode={mobileMode}>
            <label
              className={"markdown-editor-pane " + (errors.body ? "has-error" : "")}
              htmlFor="note-markdown"
            >
              <span>
                MARKDOWN <b>*</b>
              </span>
              <textarea
                id="note-markdown"
                value={draft.body}
                onChange={(event) => change("body", event.target.value)}
                spellCheck="false"
                aria-describedby={errors.body ? "note-body-error" : "note-markdown-help"}
              />
              <small id="note-markdown-help">支持 GFM 表格、任务列表、代码块与安全链接。</small>
              {errors.body && (
                <small className="field-error" id="note-body-error">
                  {errors.body}
                </small>
              )}
            </label>
            <section className="markdown-preview-pane" aria-label="Markdown 实时预览">
              <span>PREVIEW</span>
              <MarkdownRenderer>{draft.body || "暂无可预览内容。"}</MarkdownRenderer>
            </section>
          </div>

          {submitError && (
            <p className="form-submit-error" role="alert">
              {submitError}
            </p>
          )}
          <div className="form-actions note-editor-actions">
            <button type="button" className="secondary-button" onClick={leave}>
              取消
            </button>
            <button type="submit" className="primary-button" disabled={Boolean(storeError)}>
              <FloppyDisk size={18} />
              {isNew ? "保存研究笔记" : "保存修改"}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
