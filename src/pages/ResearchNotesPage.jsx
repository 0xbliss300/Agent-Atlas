import { ArrowRight, FolderOpen, NotePencil, Plus } from "@phosphor-icons/react";
import { getResearchNoteExcerpt } from "../data/researchNotes.js";

function NotesEmptyState({ projects, onAddProject, onNewNote, disabled }) {
  const hasProjects = projects.length > 0;

  return (
    <section className="empty-state notes-page-empty" aria-labelledby="notes-empty-title">
      <div className="empty-icon">
        <NotePencil size={34} weight="light" />
      </div>
      <p className="eyebrow">RESEARCH NOTES</p>
      <h2 id="notes-empty-title">{hasProjects ? "还没有 Markdown 研究笔记" : "还没有项目"}</h2>
      <p>
        {hasProjects
          ? "为具体项目创建第一篇笔记，用 Markdown 记录问题、实验过程和结论。"
          : "每篇研究笔记都需要归属项目，请先创建第一个项目。"}
      </p>
      <div className="empty-actions">
        <button
          className="primary-button"
          onClick={hasProjects ? onNewNote : onAddProject}
          disabled={disabled}
        >
          <Plus size={18} weight="bold" />
          {hasProjects ? "新建研究笔记" : "创建第一个项目"}
        </button>
      </div>
    </section>
  );
}

export function ResearchNotesPage({
  projects,
  researchNotes = [],
  activityNotes = [],
  onAddProject,
  onNewNote,
  navigate,
  storeError,
}) {
  const sourceCount = new Set(researchNotes.map((note) => note.projectId)).size;
  const latest = researchNotes[0];

  return (
    <main className="notes-page">
      {storeError && (
        <div className="store-error" role="alert">
          <strong>本地研究笔记读取失败</strong>
          <span>{storeError}</span>
        </div>
      )}

      <section className="notes-hero">
        <div>
          <p className="eyebrow">LOCAL-FIRST · MARKDOWN ARCHIVE</p>
          <h1>研究笔记</h1>
          <p>按项目撰写 Markdown 文档，沉淀问题、实验过程、关键决策与结论。</p>
          <div className="notes-hero-actions">
            <button
              className="primary-button"
              onClick={onNewNote}
              disabled={!projects.length || Boolean(storeError)}
            >
              <Plus size={18} weight="bold" />
              新建研究笔记
            </button>
            {!projects.length && <small>请先创建项目，再开始记录。</small>}
          </div>
        </div>
        <dl className="notes-summary" aria-label="研究笔记汇总">
          <div>
            <dt>研究文档</dt>
            <dd>{researchNotes.length}</dd>
          </div>
          <div>
            <dt>关联项目</dt>
            <dd>{sourceCount}</dd>
          </div>
          <div>
            <dt>最近更新</dt>
            <dd>{latest?.updated ?? "暂无"}</dd>
          </div>
        </dl>
      </section>

      {researchNotes.length ? (
        <section className="notes-index" aria-labelledby="notes-index-title">
          <div className="section-title notes-section-title">
            <h2 id="notes-index-title">Markdown 文档</h2>
            <span>{String(researchNotes.length).padStart(2, "0")} DOCUMENTS</span>
          </div>
          <div className="notes-list authored-notes-list">
            {researchNotes.map((note, index) => {
              const project = projects.find((item) => item.id === note.projectId);
              return (
                <article className="note-entry authored-note-entry" key={note.id}>
                  <span className="note-number">{String(index + 1).padStart(2, "0")}</span>
                  <div className="note-content">
                    <div className="note-meta">
                      <strong>{project?.name ?? "项目不存在"}</strong>
                      <small>创建于 {note.created}</small>
                      <time dateTime={note.updatedAt}>
                        更新于 {note.updated} {note.updatedTime}
                      </time>
                    </div>
                    <h3>{note.title}</h3>
                    <p>{getResearchNoteExcerpt(note.body)}</p>
                  </div>
                  <a
                    className="note-source-link"
                    href={`#/notes/${encodeURIComponent(note.id)}`}
                    onClick={(event) => {
                      event.preventDefault();
                      navigate(`/notes/${note.id}`);
                    }}
                    aria-label={`阅读研究笔记：${note.title}`}
                  >
                    阅读笔记
                    <ArrowRight size={18} />
                  </a>
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <NotesEmptyState
          projects={projects}
          onAddProject={onAddProject}
          onNewNote={onNewNote}
          disabled={Boolean(storeError)}
        />
      )}

      {activityNotes.length > 0 && (
        <section className="notes-index activity-notes-index" aria-labelledby="activity-title">
          <div className="section-title notes-section-title">
            <div>
              <p className="eyebrow">PROJECT CHANGELOG</p>
              <h2 id="activity-title">开发记录摘要</h2>
            </div>
            <span>{String(activityNotes.length).padStart(2, "0")} LOGS</span>
          </div>
          <p className="notes-section-copy">
            这里保留项目表单中的简短开发时间线；完整研究内容请写入上方 Markdown 文档。
          </p>
          <div className="notes-list activity-notes-list">
            {activityNotes.map((note, index) => (
              <article className="note-entry" key={note.id}>
                <span className="note-number">{String(index + 1).padStart(2, "0")}</span>
                <div className="note-content">
                  <div className="note-meta">
                    <span className={"activity-dot " + note.statusTone} />
                    <strong>{note.projectName}</strong>
                    <small>{note.statusLabel}</small>
                    <time dateTime={note.updatedAt}>
                      {note.updated} {note.updatedTime}
                    </time>
                  </div>
                  <p>{note.content}</p>
                </div>
                <a
                  className="note-source-link"
                  href={`#/project/${encodeURIComponent(note.projectId)}/notes`}
                  onClick={(event) => {
                    event.preventDefault();
                    navigate(`/project/${note.projectId}/notes`);
                  }}
                  aria-label={`查看“${note.projectName}”的开发记录：${note.content}`}
                >
                  <FolderOpen size={18} />
                  查看来源
                </a>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
