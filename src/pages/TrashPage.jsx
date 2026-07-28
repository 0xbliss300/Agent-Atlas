import {
  ArrowCounterClockwise,
  FolderOpen,
  NotePencil,
  ProjectorScreen,
  Trash,
  Warning,
} from "@phosphor-icons/react";
import { useConfirmDialog } from "../components/ConfirmDialog.jsx";

function formatRemainingDays(expiresAt) {
  const expires = Date.parse(expiresAt);
  const remaining = Math.max(0, expires - Date.now());
  const days = Math.ceil(remaining / (1000 * 60 * 60 * 24));
  return `${days} 天后过期`;
}

function TrashItem({ entry, onRestore, onDelete }) {
  const confirmDialog = useConfirmDialog();
  const isProject = entry.kind === "project";
  const title = isProject ? entry.project.name : entry.note.title;
  const meta = isProject
    ? `${entry.notes.length} 篇笔记 · ${entry.events.length} 条事件`
    : `${entry.histories.length} 个历史版本`;

  const handleRestore = async () => {
    const ok = await confirmDialog({
      title: "恢复条目",
      message: `确定恢复“${title}”吗？`,
      detail: "恢复后会还原该条目及其关联的研究笔记、版本历史与变更事件。",
      confirmText: "恢复",
    });
    if (!ok) return;
    onRestore(entry);
  };

  const handleDelete = async () => {
    const ok = await confirmDialog({
      title: "彻底删除",
      message: `确定彻底删除“${title}”吗？`,
      detail: "此操作无法撤销，关联内容将一并永久删除。",
      confirmText: "彻底删除",
      danger: true,
    });
    if (!ok) return;
    onDelete(entry);
  };

  return (
    <article className="trash-item">
      <div className="trash-item-icon" aria-hidden="true">
        {isProject ? <ProjectorScreen size={20} /> : <NotePencil size={20} />}
      </div>
      <div className="trash-item-body">
        <div className="trash-item-meta">
          <span>{isProject ? "项目" : "研究笔记"}</span>
          <span>{meta}</span>
        </div>
        <h3>{title}</h3>
        <p>
          删除于 {entry.deletedAt.slice(0, 10)} {entry.deletedAt.slice(11, 16)} ·{" "}
          {formatRemainingDays(entry.expiresAt)}
        </p>
        <div className="trash-item-actions">
          <button type="button" className="secondary-button" onClick={handleRestore}>
            <ArrowCounterClockwise size={17} />
            恢复
          </button>
          <button type="button" className="danger-button" onClick={handleDelete}>
            <Trash size={17} />
            彻底删除
          </button>
        </div>
      </div>
    </article>
  );
}

export function TrashPage({ entries, storeError, navigate, onRestore, onDelete, onClear }) {
  const handleClear = async () => {
    await onClear();
  };

  return (
    <main className="trash-page">
      <section className="trash-hero" aria-labelledby="trash-title">
        <div>
          <p className="eyebrow">LOCAL TRASH · SOFT DELETE</p>
          <h1 id="trash-title">回收站</h1>
          <p className="trash-intro">
            已删除的项目和研究笔记会在这里保留 7 天（最多 30
            条），期间可以一键恢复关联内容；到期后会自动清理。
          </p>
        </div>
        {entries.length > 0 ? (
          <button type="button" className="danger-button" onClick={handleClear}>
            <Trash size={18} />
            清空回收站
          </button>
        ) : null}
      </section>

      {storeError ? (
        <div className="store-error" role="alert">
          <Warning size={20} weight="fill" />
          <span>{storeError}</span>
        </div>
      ) : null}

      <section className="trash-list" aria-labelledby="trash-list-title">
        <div className="trash-section-heading">
          <div>
            <p className="eyebrow">DELETED ITEMS</p>
            <h2 id="trash-list-title">待恢复条目</h2>
          </div>
          <p>共 {entries.length} 条</p>
        </div>

        {entries.length ? (
          <div className="trash-items">
            {entries.map((entry) => (
              <TrashItem key={entry.id} entry={entry} onRestore={onRestore} onDelete={onDelete} />
            ))}
          </div>
        ) : (
          <div className="trash-empty">
            <FolderOpen size={32} aria-hidden="true" />
            <h3>回收站为空</h3>
            <p>删除的项目和研究笔记会在这里暂存 7 天，随时可以恢复。</p>
            <button type="button" className="secondary-button" onClick={() => navigate("/")}>
              返回项目总览
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
