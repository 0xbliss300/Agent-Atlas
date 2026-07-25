import { useState } from "react";
import { ArrowDown, ArrowUp, FolderPlus, PencilSimple, Trash } from "@phosphor-icons/react";
import { countProjectsInCollection } from "../data/organization.js";

export function CollectionManager({
  collections = [],
  projects = [],
  storeError = "",
  onCreate,
  onRename,
  onMove,
  onDelete,
}) {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [feedback, setFeedback] = useState("");

  const run = (action, successMessage) => {
    const result = action();
    if (result?.ok === false) {
      setFeedback(result.error || "集合操作失败。");
      return false;
    }
    setFeedback(successMessage);
    return true;
  };

  const create = () => {
    if (run(() => onCreate(name), `已创建集合“${name.trim()}”。`)) setName("");
  };

  return (
    <section className="collection-manager" aria-labelledby="collection-manager-title">
      <div>
        <h3 id="collection-manager-title">项目集合</h3>
        <p>一个项目可以加入多个集合；删除集合只会解除关联，不会删除项目或研究内容。</p>
      </div>
      {storeError && (
        <p className="settings-warning" role="alert">
          {storeError}
        </p>
      )}
      <div className="collection-create">
        <label>
          <span className="sr-only">新集合名称</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="新集合名称"
            maxLength="40"
            disabled={Boolean(storeError)}
          />
        </label>
        <button
          type="button"
          className="secondary-button"
          onClick={create}
          disabled={!name.trim() || Boolean(storeError)}
        >
          <FolderPlus size={17} />
          创建集合
        </button>
      </div>
      {!storeError && collections.length === 0 && (
        <p className="collection-empty">
          尚无自定义集合。创建后即可在项目表单、概览和工作台中使用。
        </p>
      )}
      {collections.length > 0 && (
        <div className="collection-list">
          {collections.map((collection, index) => {
            const projectCount = countProjectsInCollection(projects, collection.id);
            return (
              <div className="collection-row" key={collection.id}>
                {editingId === collection.id ? (
                  <input
                    aria-label={`重命名${collection.name}`}
                    value={renameValue}
                    maxLength="40"
                    onChange={(event) => setRenameValue(event.target.value)}
                  />
                ) : (
                  <span>
                    <strong>{collection.name}</strong>
                    <small>{projectCount} 个项目</small>
                  </span>
                )}
                <div>
                  {editingId === collection.id ? (
                    <>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => {
                          if (run(() => onRename(collection.id, renameValue), "集合已重命名。")) {
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
                        aria-label={`重命名${collection.name}`}
                        onClick={() => {
                          setEditingId(collection.id);
                          setRenameValue(collection.name);
                        }}
                      >
                        <PencilSimple size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`上移${collection.name}`}
                        disabled={index === 0}
                        onClick={() => run(() => onMove(collection.id, -1), "集合顺序已更新。")}
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`下移${collection.name}`}
                        disabled={index === collections.length - 1}
                        onClick={() => run(() => onMove(collection.id, 1), "集合顺序已更新。")}
                      >
                        <ArrowDown size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`删除${collection.name}`}
                        onClick={() => {
                          const message = projectCount
                            ? `集合“${collection.name}”包含 ${projectCount} 个项目。确定删除并解除这些关联吗？项目、研究笔记、任务和历史都不会被删除。`
                            : `确定删除空集合“${collection.name}”吗？`;
                          if (window.confirm(message)) {
                            run(
                              () => onDelete(collection.id),
                              "集合已删除，项目及研究内容未受影响。",
                            );
                          }
                        }}
                      >
                        <Trash size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="collection-feedback" role="status" aria-live="polite">
        {feedback}
      </p>
    </section>
  );
}
