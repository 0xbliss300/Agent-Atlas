import {
  ArrowRight,
  CheckCircle,
  ClockCounterClockwise,
  Exam,
  FolderOpen,
  NotePencil,
  SlidersHorizontal,
  WarningCircle,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { selectProjectEvents } from "../data/projectEvents.js";

const TYPE_OPTIONS = [
  ["all", "全部类型"],
  ["project", "项目创建"],
  ["status", "状态与进度"],
  ["task", "任务"],
  ["blocker", "阻塞项"],
  ["local", "本地读取"],
  ["note", "研究笔记"],
  ["eval", "评测结果"],
];

const TYPE_META = {
  project: { label: "项目", Icon: FolderOpen },
  status: { label: "状态", Icon: SlidersHorizontal },
  task: { label: "任务", Icon: CheckCircle },
  blocker: { label: "阻塞", Icon: WarningCircle },
  local: { label: "本地读取", Icon: ClockCounterClockwise },
  note: { label: "研究笔记", Icon: NotePencil },
  eval: { label: "评测", Icon: Exam },
};

export function ProjectTimeline({
  projectId,
  events = [],
  storeError = null,
  navigate = () => {},
}) {
  const [type, setType] = useState("all");
  const filteredEvents = useMemo(
    () => selectProjectEvents(events, projectId, type),
    [events, projectId, type],
  );

  return (
    <section className="detail-block timeline-block" aria-labelledby="timeline-title">
      <div className="block-heading timeline-heading">
        <div>
          <p className="eyebrow">SYSTEM TIMELINE</p>
          <h2 id="timeline-title">自动变更时间线</h2>
        </div>
        <label className="timeline-filter">
          <span>事件类型</span>
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            aria-label="筛选变更事件类型"
          >
            {TYPE_OPTIONS.map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="timeline-explanation">
        <p>
          这里是系统自动记录的关键操作；下方“开发记录”仍是人工撰写的项目摘要。每个项目最多保留最近
          200 条事件。
        </p>
        <span aria-live="polite">当前显示 {filteredEvents.length} 条</span>
      </div>
      {storeError ? (
        <p className="timeline-error" role="alert">
          {storeError}
        </p>
      ) : filteredEvents.length ? (
        <ol className="project-timeline">
          {filteredEvents.map((event) => {
            const meta = TYPE_META[event.type];
            const Icon = meta.Icon;
            const noteAvailable = event.subject?.kind === "note" && !event.subject.sourceDeleted;
            return (
              <li key={event.id} className={`timeline-event timeline-event-${event.type}`}>
                <div className="timeline-marker" aria-hidden="true">
                  <Icon size={18} weight={event.type === "blocker" ? "fill" : "regular"} />
                </div>
                <article>
                  <div className="timeline-event-meta">
                    <span>{event.source === "auto" ? `自动${meta.label}` : meta.label}</span>
                    <time dateTime={event.occurredAt}>
                      {event.occurred} {event.occurredTime}
                    </time>
                  </div>
                  <h3>{event.summary}</h3>
                  {event.changes.length ? (
                    <dl className="timeline-changes">
                      {event.changes.map((item) => (
                        <div key={item.field}>
                          <dt>{item.label}</dt>
                          <dd>
                            <span>{item.before}</span>
                            <ArrowRight size={13} aria-hidden="true" />
                            <strong>{item.after}</strong>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  {event.subject?.kind === "note" ? (
                    noteAvailable ? (
                      <a
                        className="timeline-source"
                        href={`#/notes/${encodeURIComponent(event.subject.id)}`}
                        onClick={(clickEvent) => {
                          clickEvent.preventDefault();
                          navigate(`/notes/${event.subject.id}`);
                        }}
                      >
                        打开来源笔记
                        <ArrowRight size={14} aria-hidden="true" />
                      </a>
                    ) : (
                      <span className="timeline-source-deleted">来源笔记已删除</span>
                    )
                  ) : null}
                </article>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="timeline-empty">
          <ClockCounterClockwise size={28} aria-hidden="true" />
          <h3>{type === "all" ? "尚无自动变更事件" : "当前类型暂无事件"}</h3>
          <p>
            {type === "all"
              ? "编辑项目、勾选任务、解决阻塞或保存研究笔记后，关键变化会出现在这里。"
              : "切换到“全部类型”查看其他关键操作。"}
          </p>
          {type !== "all" ? (
            <button type="button" className="secondary-button" onClick={() => setType("all")}>
              查看全部类型
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
