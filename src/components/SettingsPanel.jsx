import { useRef, useState } from "react";
import { ArrowRight, DownloadSimple, Trash, UploadSimple } from "@phosphor-icons/react";
import { useDialogFocus } from "../hooks/useDialogFocus.js";
import { CollectionManager } from "./CollectionManager.jsx";

export function SettingsPanel({
  close,
  projects,
  researchNotes = [],
  projectEvents = [],
  templates = [],
  collections = [],
  collectionStoreError = "",
  storeError,
  settings,
  settingsError,
  onSettingsChange,
  onExport,
  onImport,
  onReset,
  onCreateCollection,
  onRenameCollection,
  onMoveCollection,
  onDeleteCollection,
}) {
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const fileRef = useRef(null);
  const [importMode, setImportMode] = useState("merge");
  const [importError, setImportError] = useState("");
  useDialogFocus(panelRef, closeRef, close);

  const chooseImport = () => fileRef.current?.click();

  const readImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      setImportError("");
      const result = await onImport(await file.text(), importMode);
      if (!result.ok) setImportError(result.error);
    } catch {
      setImportError("无法读取所选文件。");
    }
  };

  return (
    <div className="scrim" onMouseDown={close} role="presentation">
      <section
        ref={panelRef}
        tabIndex="-1"
        className="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="settings-head">
          <div>
            <p className="eyebrow">LOCAL SETTINGS</p>
            <h2 id="settings-title">本地展示设置</h2>
          </div>
          <button ref={closeRef} className="icon-button" onClick={close} aria-label="关闭设置">
            <ArrowRight size={20} />
          </button>
        </div>
        <div className="setting-row">
          <span>数据来源</span>
          <strong>浏览器本地存储</strong>
        </div>
        <div className="setting-row">
          <span>当前项目</span>
          <strong>{projects.length} 个</strong>
        </div>
        <div className="setting-row">
          <span>研究笔记</span>
          <strong>{researchNotes.length} 篇</strong>
        </div>
        <div className="setting-row">
          <span>变更事件</span>
          <strong>{projectEvents.length} 条</strong>
        </div>
        <div className="setting-row">
          <span>自定义模板</span>
          <strong>{templates.length} 个</strong>
        </div>
        <div className="setting-row">
          <span>项目集合</span>
          <strong>{collections.length} 个</strong>
        </div>
        <div className="setting-row">
          <span>网络发布</span>
          <strong className="safe">已关闭</strong>
        </div>
        <p className="settings-note">项目数据只保存在当前浏览器中，不会上传或发送到外部服务。</p>

        <section className="display-settings" aria-labelledby="display-settings-title">
          <h3 id="display-settings-title">显示偏好</h3>
          {settingsError && (
            <p className="settings-warning" role="status">
              {settingsError}
            </p>
          )}
          <label className="toggle-setting">
            <span>显示已完成项目</span>
            <input
              type="checkbox"
              checked={settings.showCompleted}
              onChange={(event) => onSettingsChange({ showCompleted: event.target.checked })}
            />
          </label>
          <label className="toggle-setting">
            <span>显示最近更新</span>
            <input
              type="checkbox"
              checked={settings.showRecent}
              onChange={(event) => onSettingsChange({ showRecent: event.target.checked })}
            />
          </label>
          <label className="select-setting">
            <span>默认排序</span>
            <select
              value={settings.sortBy}
              onChange={(event) => onSettingsChange({ sortBy: event.target.value })}
            >
              <option value="updated">最近更新</option>
              <option value="progress">完成度</option>
              <option value="status">项目状态</option>
            </select>
          </label>
          <label className="select-setting">
            <span>显示密度</span>
            <select
              value={settings.density}
              onChange={(event) => onSettingsChange({ density: event.target.value })}
            >
              <option value="standard">标准</option>
              <option value="compact">紧凑</option>
            </select>
          </label>
        </section>

        <CollectionManager
          collections={collections}
          projects={projects}
          storeError={collectionStoreError}
          onCreate={onCreateCollection}
          onRename={onRenameCollection}
          onMove={onMoveCollection}
          onDelete={onDeleteCollection}
        />

        <section className="data-tools" aria-labelledby="data-tools-title">
          <h3 id="data-tools-title">备份与恢复</h3>
          <p>
            导出带版本号的 JSON
            备份，或恢复项目、研究笔记、正式版本历史、变更时间线与自定义模板；临时草稿不进入备份。每个项目仅保留最近
            200 条自动事件。
          </p>
          <button
            className="secondary-button tool-button"
            onClick={onExport}
            disabled={
              !projects.length && !researchNotes.length && !templates.length && !collections.length
            }
          >
            <DownloadSimple size={18} />
            导出项目、笔记、历史、时间线与模板
          </button>
          <label className="import-mode">
            导入方式
            <select value={importMode} onChange={(event) => setImportMode(event.target.value)}>
              <option value="merge">合并：冲突项目生成新 ID</option>
              <option value="replace">替换：用备份覆盖当前项目</option>
            </select>
          </label>
          <input
            ref={fileRef}
            className="sr-only"
            type="file"
            accept="application/json,.json"
            onChange={readImport}
          />
          <button className="secondary-button tool-button" onClick={chooseImport}>
            <UploadSimple size={18} />
            选择 JSON 备份
          </button>
          {importError && (
            <p className="form-submit-error" role="alert">
              {importError}
            </p>
          )}
          <button
            className="danger-button tool-button"
            onClick={onReset}
            disabled={
              !projects.length &&
              !researchNotes.length &&
              !templates.length &&
              !collections.length &&
              !storeError
            }
          >
            <Trash size={18} />
            {storeError ? "清除损坏的本地数据" : "清空全部本地内容"}
          </button>
        </section>
      </section>
    </div>
  );
}
