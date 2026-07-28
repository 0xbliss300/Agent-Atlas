import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Copy, FloppyDisk, PencilSimple, Trash } from "@phosphor-icons/react";
import { useConfirmDialog } from "./ConfirmDialog.jsx";

const PROJECT_EXTRA_OPTIONS = [
  {
    key: "statusProgress",
    label: "状态与完成度",
    hint: "会复用当前状态和进度数值。",
  },
  { key: "milestone", label: "当前里程碑", hint: "会复用当前里程碑文字。" },
  { key: "log", label: "人工开发记录", hint: "可能包含只适用于当前项目的历史。" },
  { key: "localPath", label: "本地目录文字", hint: "可能暴露设备目录；默认不保存。" },
  {
    key: "resources",
    label: "仓库、文档与演示地址",
    hint: "可能包含私有资源；默认不保存。",
  },
];

export function TemplateWorkspace({
  type,
  templates = [],
  canApply = true,
  onApply,
  onCreate,
  onRename,
  onDuplicate,
  onMove,
  onDelete,
  storeError = "",
}) {
  const [selectedId, setSelectedId] = useState(() => templates[0]?.id ?? "");
  const [saveOpen, setSaveOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [extraFields, setExtraFields] = useState({});
  const [editingId, setEditingId] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [feedback, setFeedback] = useState("");
  const confirmDialog = useConfirmDialog();
  const customTemplates = useMemo(
    () => templates.filter((template) => !template.builtin),
    [templates],
  );
  const selected = templates.find((template) => template.id === selectedId) ?? templates[0];
  const typeLabel = type === "project" ? "项目" : "研究笔记";

  const run = (callback, successMessage) => {
    const result = callback?.();
    if (result?.ok === false) {
      setFeedback(result.error || "模板操作失败。");
      return false;
    }
    setFeedback(successMessage);
    return true;
  };

  const create = () => {
    if (run(() => onCreate?.(templateName, extraFields), `已保存自定义${typeLabel}模板。`)) {
      setTemplateName("");
      setExtraFields({});
      setSaveOpen(false);
    }
  };

  return (
    <section className="template-workspace" aria-labelledby={`${type}-template-title`}>
      <div className="template-workspace-head">
        <div>
          <p className="eyebrow">LOCAL TEMPLATES</p>
          <h3 id={`${type}-template-title`}>{typeLabel}模板</h3>
          <p>模板只填充当前草稿；确认保存前不会创建任何内容。</p>
        </div>
        <button
          type="button"
          className="secondary-button compact-button"
          onClick={() => {
            setSaveOpen((current) => !current);
            setFeedback("");
          }}
          disabled={Boolean(storeError)}
        >
          <FloppyDisk size={16} />
          保存当前结构
        </button>
      </div>

      {storeError && (
        <p className="form-submit-error" role="alert">
          {storeError}
        </p>
      )}

      {canApply && (
        <div className="template-picker">
          <label className="form-field">
            <span>选择起始模板</span>
            <select
              value={selected?.id ?? ""}
              onChange={(event) => {
                setSelectedId(event.target.value);
                setFeedback("");
              }}
            >
              <optgroup label="内置模板">
                {templates
                  .filter((template) => template.builtin)
                  .map((template) => (
                    <option value={template.id} key={template.id}>
                      {template.name}
                    </option>
                  ))}
              </optgroup>
              {customTemplates.length > 0 && (
                <optgroup label="自定义模板">
                  {customTemplates.map((template) => (
                    <option value={template.id} key={template.id}>
                      {template.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <small>{selected?.description}</small>
          </label>
          <button
            type="button"
            className="primary-button compact-button"
            onClick={() =>
              run(() => onApply?.(selected), `已套用“${selected?.name}”，请检查并编辑后再保存。`)
            }
            disabled={!selected}
          >
            套用{selected?.builtin ? "默认" : ""}模板
          </button>
        </div>
      )}

      {saveOpen && (
        <div className="template-save-panel">
          <label className="form-field">
            <span>自定义模板名称</span>
            <input
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              placeholder={`例如：我的${typeLabel}结构`}
            />
          </label>
          {type === "project" && (
            <fieldset>
              <legend>额外复用字段（默认全部排除）</legend>
              <p>
                简介结构、图标、功能、路线图、任务、阻塞项和技术字段会默认保存。项目
                ID、更新时间、研究笔记、版本历史和系统事件始终排除。
              </p>
              <div className="template-extra-grid">
                {PROJECT_EXTRA_OPTIONS.map((option) => (
                  <label key={option.key}>
                    <input
                      type="checkbox"
                      checked={Boolean(extraFields[option.key])}
                      onChange={(event) =>
                        setExtraFields((current) => ({
                          ...current,
                          [option.key]: event.target.checked,
                        }))
                      }
                    />
                    <span>
                      <strong>{option.label}</strong>
                      <small>{option.hint}</small>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {type === "note" && (
            <p>仅保存当前标题和 Markdown 大纲；所属项目、正式笔记 ID、草稿及版本历史不会保存。</p>
          )}
          <div className="template-save-actions">
            <button type="button" className="secondary-button" onClick={() => setSaveOpen(false)}>
              取消
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={create}
              disabled={!templateName.trim()}
            >
              保存为模板
            </button>
          </div>
        </div>
      )}

      {customTemplates.length > 0 && (
        <details className="template-manager">
          <summary>管理自定义模板（{customTemplates.length}）</summary>
          <div className="template-manager-list">
            {customTemplates.map((template, index) => (
              <div className="template-manager-row" key={template.id}>
                {editingId === template.id ? (
                  <input
                    aria-label={`重命名${template.name}`}
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                  />
                ) : (
                  <span>
                    <strong>{template.name}</strong>
                    <small>{template.description}</small>
                  </span>
                )}
                <div>
                  {editingId === template.id ? (
                    <>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => {
                          if (run(() => onRename?.(template.id, renameValue), "模板已重命名。")) {
                            setEditingId("");
                          }
                        }}
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setEditingId("")}
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`重命名${template.name}`}
                        onClick={() => {
                          setEditingId(template.id);
                          setRenameValue(template.name);
                        }}
                      >
                        <PencilSimple size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`复制${template.name}`}
                        onClick={() => run(() => onDuplicate?.(template.id), "模板副本已创建。")}
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`上移${template.name}`}
                        disabled={index === 0}
                        onClick={() => run(() => onMove?.(template.id, -1), "模板顺序已更新。")}
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`下移${template.name}`}
                        disabled={index === customTemplates.length - 1}
                        onClick={() => run(() => onMove?.(template.id, 1), "模板顺序已更新。")}
                      >
                        <ArrowDown size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`删除${template.name}`}
                        onClick={async () => {
                          const ok = await confirmDialog({
                            title: "删除模板",
                            message: `确定删除模板“${template.name}”吗？已创建的${typeLabel}不会受影响。`,
                            confirmText: "删除",
                            danger: true,
                          });
                          if (ok) {
                            run(() => onDelete?.(template.id), "模板已删除，已有内容未受影响。");
                          }
                        }}
                      >
                        <Trash size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      <p className="sr-only" role="status" aria-live="polite">
        {feedback}
      </p>
      {feedback && <p className="template-feedback">{feedback}</p>}
    </section>
  );
}
