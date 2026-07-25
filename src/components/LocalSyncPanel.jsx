import { useRef, useState } from "react";
import {
  ArrowsClockwise,
  FileText,
  FolderOpen,
  GitBranch,
  ShieldCheck,
  X,
} from "@phosphor-icons/react";
import { analyzeLocalDirectory, readLocalStatusFile } from "../data/localStatus.js";
import { useDialogFocus } from "../hooks/useDialogFocus.js";

function SyncPreview({ result }) {
  const technology = result.project.technology;
  const technologyLabels = technology
    ? [
        ...(technology.languages ?? []),
        ...(technology.frameworks ?? []),
        ...(technology.models ?? []),
        ...(technology.dataSources ?? []),
      ]
    : [];

  return (
    <section className="sync-preview" aria-labelledby="sync-preview-title">
      <div className="sync-preview-head">
        <div>
          <p className="eyebrow">READ-ONLY PREVIEW</p>
          <h3 id="sync-preview-title">读取结果</h3>
        </div>
        <strong>{result.filesRead.length} 个来源</strong>
      </div>
      <dl>
        <div>
          <dt>本地来源</dt>
          <dd>{result.sourceName}</dd>
        </div>
        <div>
          <dt>完成度</dt>
          <dd>
            {Number.isFinite(result.project.progress) ? `${result.project.progress}%` : "未发现"}
          </dd>
        </div>
        <div>
          <dt>任务</dt>
          <dd>{result.project.nextTasks?.length ?? 0} 项</dd>
        </div>
        <div>
          <dt>阻塞问题</dt>
          <dd>{result.project.blockers?.length ?? 0} 项</dd>
        </div>
        <div>
          <dt>技术信息</dt>
          <dd>{technologyLabels.length ? technologyLabels.join(" · ") : "未发现"}</dd>
        </div>
        <div>
          <dt>Git</dt>
          <dd>
            {result.git
              ? `${result.git.branch || "detached"} · ${result.git.commit || "未知提交"}`
              : "未读取"}
          </dd>
        </div>
      </dl>
      {result.notes.length > 0 && (
        <ul className="sync-notes">
          {result.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function LocalSyncPanel({ project, onClose, onApply }) {
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const fileRef = useRef(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useDialogFocus(panelRef, closeRef, onClose);

  const inspectFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      setResult(await readLocalStatusFile(file));
    } catch (inspectError) {
      setResult(null);
      setError(inspectError.message || "无法读取所选状态文件。");
    } finally {
      setBusy(false);
    }
  };

  const inspectDirectory = async () => {
    if (!window.showDirectoryPicker) {
      setError("当前浏览器不支持目录读取，请改用 JSON 或 Markdown 状态文件。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const directory = await window.showDirectoryPicker({ mode: "read" });
      setResult(await analyzeLocalDirectory(directory));
    } catch (inspectError) {
      if (inspectError?.name !== "AbortError") {
        setResult(null);
        setError(inspectError.message || "无法读取所选目录。");
      }
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    const response = onApply(result);
    if (!response.ok) setError(response.error);
  };

  return (
    <div className="scrim" onMouseDown={onClose} role="presentation">
      <section
        ref={panelRef}
        tabIndex="-1"
        className="create-panel sync-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-panel-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="create-head">
          <div>
            <p className="eyebrow">LOCAL STATUS SYNC</p>
            <h2 id="sync-panel-title">读取本地项目状态</h2>
            <p>为“{project.name}”读取本地状态，确认预览后才会更新项目。</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="关闭本地状态读取"
          >
            <X size={20} />
          </button>
        </div>

        <div className="local-safety">
          <ShieldCheck size={23} weight="duotone" />
          <p>所有读取都在当前浏览器内完成。不会上传文件、扫描未选择的位置，也不会保存目录权限。</p>
        </div>

        <div className="sync-source-grid">
          <button className="sync-source" type="button" onClick={inspectDirectory} disabled={busy}>
            <FolderOpen size={28} weight="duotone" />
            <strong>选择项目目录</strong>
            <span>读取 package.json、README、TODO 与 Git 分支/提交信息</span>
          </button>
          <button
            className="sync-source"
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            <FileText size={28} weight="duotone" />
            <strong>选择状态文件</strong>
            <span>支持 JSON、Markdown、package.json</span>
          </button>
          <input
            ref={fileRef}
            className="sr-only"
            type="file"
            accept=".json,.md,.markdown,application/json,text/markdown"
            onChange={inspectFile}
          />
        </div>

        {busy && (
          <p className="sync-loading" role="status">
            <ArrowsClockwise size={18} />
            正在只读分析本地内容…
          </p>
        )}
        {error && (
          <p className="form-submit-error" role="alert">
            {error}
          </p>
        )}
        {result && <SyncPreview result={result} />}

        {project.localSync && (
          <p className="previous-sync">
            <GitBranch size={17} />
            上次读取：{project.localSync.sourceName || "本地来源"} ·{" "}
            {project.localSync.syncedAt?.slice(0, 16).replace("T", " ") || "时间未知"}
          </p>
        )}

        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={apply}
            disabled={!result || busy}
          >
            <ArrowsClockwise size={18} weight="bold" />
            应用读取结果
          </button>
        </div>
      </section>
    </div>
  );
}
