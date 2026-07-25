import { useMemo, useRef, useState } from "react";
import {
  CheckSquare,
  Copy,
  DownloadSimple,
  FileCode,
  ShieldWarning,
  Square,
  X,
} from "@phosphor-icons/react";
import { createCodexContext, selectDefaultContextNoteIds } from "../data/codexContext.js";
import { useDialogFocus } from "../hooks/useDialogFocus.js";
import { writeClipboardText } from "../utils/clipboard.js";

export function CodexContextPanel({ project, researchNotes = [], onClose }) {
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const [selectedNoteIds, setSelectedNoteIds] = useState(() =>
    selectDefaultContextNoteIds(researchNotes),
  );
  const [generatedAt] = useState(() => new Date());
  const [outputStatus, setOutputStatus] = useState("");
  useDialogFocus(panelRef, closeRef, onClose);

  const selectedNotes = useMemo(
    () => researchNotes.filter((note) => selectedNoteIds.includes(note.id)),
    [researchNotes, selectedNoteIds],
  );
  const context = useMemo(
    () => createCodexContext(project, selectedNotes, generatedAt),
    [generatedAt, project, selectedNotes],
  );
  const allSelected = researchNotes.length > 0 && selectedNoteIds.length === researchNotes.length;

  const toggleNote = (noteId) => {
    setOutputStatus("");
    setSelectedNoteIds((current) =>
      current.includes(noteId)
        ? current.filter((currentId) => currentId !== noteId)
        : [...current, noteId],
    );
  };

  const toggleAll = () => {
    setOutputStatus("");
    setSelectedNoteIds(allSelected ? [] : researchNotes.map((note) => note.id));
  };

  const copyMarkdown = async () => {
    try {
      await writeClipboardText(context.markdown);
      setOutputStatus("Markdown 已复制到剪贴板。");
    } catch {
      setOutputStatus("复制失败，请检查浏览器的剪贴板权限后重试。");
    }
  };

  const downloadMarkdown = () => {
    try {
      const blob = new Blob([context.markdown], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = context.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setOutputStatus(`已下载 ${context.filename}`);
    } catch {
      setOutputStatus("下载失败，请重试或改用复制 Markdown。");
    }
  };

  return (
    <div className="scrim" onMouseDown={onClose} role="presentation">
      <section
        ref={panelRef}
        tabIndex="-1"
        className="create-panel codex-context-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="codex-context-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="create-head">
          <div>
            <p className="eyebrow">LOCAL CODEX HANDOFF</p>
            <h2 id="codex-context-title">生成 Codex 上下文</h2>
            <p>整理“{project.name}”的当前开发状态，并在本地预览后主动复制或下载。</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="关闭 Codex 上下文"
          >
            <X size={20} />
          </button>
        </div>

        <div className="context-privacy-warning">
          <ShieldWarning size={24} weight="duotone" />
          <p>
            上下文可能包含本地路径、仓库地址和私人研究内容。所有内容只在当前浏览器中生成，不会自动发送给
            Codex、OpenAI 或其他服务。
          </p>
        </div>

        <section className="context-note-picker" aria-labelledby="context-notes-title">
          <div className="context-section-heading">
            <div>
              <p className="eyebrow">RESEARCH SCOPE</p>
              <h3 id="context-notes-title">选择研究笔记</h3>
            </div>
            {researchNotes.length > 0 && (
              <button type="button" className="text-button" onClick={toggleAll}>
                {allSelected ? <CheckSquare size={17} /> : <Square size={17} />}
                {allSelected ? "全部取消" : "选择全部"}
              </button>
            )}
          </div>
          <p className="context-picker-help">
            默认包含最近更新的 3 篇；减少选择可控制交接上下文长度。
          </p>
          {researchNotes.length ? (
            <div className="context-note-list">
              {researchNotes.map((note) => (
                <label key={note.id}>
                  <input
                    type="checkbox"
                    checked={selectedNoteIds.includes(note.id)}
                    onChange={() => toggleNote(note.id)}
                  />
                  <span>
                    <strong>{note.title}</strong>
                    <small>
                      更新于 {note.updated} {note.updatedTime}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="inline-empty">该项目尚无研究笔记，仍可生成完整的项目状态上下文。</p>
          )}
        </section>

        <section className="context-preview" aria-labelledby="context-preview-title">
          <div className="context-section-heading">
            <div>
              <p className="eyebrow">MARKDOWN PREVIEW</p>
              <h3 id="context-preview-title">本地预览</h3>
            </div>
            <FileCode size={24} />
          </div>
          <dl className="context-stats">
            <div>
              <dt>字符数</dt>
              <dd>{context.characterCount.toLocaleString()}</dd>
            </div>
            <div>
              <dt>笔记</dt>
              <dd>{context.noteCount} 篇</dd>
            </div>
            <div>
              <dt>生成时间</dt>
              <dd>
                {generatedAt.toLocaleString("zh-CN", {
                  hour12: false,
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </dd>
            </div>
          </dl>
          {context.isLong && (
            <p className="context-length-warning" role="alert">
              当前内容较长。核心状态、阻塞项和任务均已完整保留；建议减少研究笔记选择后再交给新会话。
            </p>
          )}
          <pre className="context-markdown" aria-label="Codex 上下文 Markdown 预览">
            {context.markdown}
          </pre>
        </section>

        <p className="context-output-status" aria-live="polite">
          {outputStatus || `建议文件名：${context.filename}`}
        </p>
        <div className="form-actions context-actions">
          <button type="button" className="secondary-button" onClick={copyMarkdown}>
            <Copy size={18} />
            复制 Markdown
          </button>
          <button type="button" className="primary-button" onClick={downloadMarkdown}>
            <DownloadSimple size={18} />
            下载 .md
          </button>
        </div>
      </section>
    </div>
  );
}
