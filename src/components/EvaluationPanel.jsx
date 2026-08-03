import { useMemo, useRef, useState } from "react";
import { Exam, Plus, Trash, UploadSimple } from "@phosphor-icons/react";
import { useConfirmDialog } from "./ConfirmDialog.jsx";
import {
  EMPTY_EVALUATION_DRAFT,
  createEvaluationInputDate,
  groupEvaluationsByMetric,
} from "../data/evaluations.js";

// TODO-065：评测结果追踪面板。
// - 趋势图按指标分组绘制独立折线（SVG，无外部图表库依赖）。
// - 结果列表按时间倒序展示，支持删除。
// - 手动录入与从 JSON 文件导入两种入口。
// 样式仅复用既有设计系统类（detail-block/block-heading/form-grid/...），
// 趋势图与列表行的布局使用内联样式，避免改动已定稿的 styles.css。
export function EvaluationPanel({
  evaluations = [],
  storeError = null,
  onAdd,
  onDelete,
  onImport,
}) {
  const [draft, setDraft] = useState(() => ({
    ...EMPTY_EVALUATION_DRAFT,
    evaluatedAt: createEvaluationInputDate(),
  }));
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const fileInputRef = useRef(null);
  const confirm = useConfirmDialog();

  const sorted = useMemo(
    () => [...evaluations].sort((a, b) => b.evaluatedTimestamp - a.evaluatedTimestamp),
    [evaluations],
  );
  const metricGroups = useMemo(() => groupEvaluationsByMetric(evaluations), [evaluations]);

  const update = (event) => {
    const { name, value } = event.target;
    setDraft((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmitError(null);
    if (!onAdd) return;
    const result = onAdd(draft);
    if (!result.ok) {
      const fieldErrors = result.error?.fields ?? {};
      if (Object.keys(fieldErrors).length) {
        setErrors(fieldErrors);
      } else {
        setSubmitError(result.error?.message || "记录评测失败。");
      }
      return;
    }
    setErrors({});
    setDraft({ ...EMPTY_EVALUATION_DRAFT, evaluatedAt: createEvaluationInputDate() });
  };

  const handleDelete = async (evaluationId, label) => {
    if (!onDelete) return;
    const ok = await confirm({
      title: "删除评测结果",
      message: `确定删除评测“${label}”吗？`,
      detail: "此操作无法撤销。",
      confirmText: "删除",
      danger: true,
    });
    if (!ok) return;
    const result = onDelete(evaluationId);
    if (!result.ok) setSubmitError(result.error || "删除评测失败。");
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !onImport) return;
    setSubmitError(null);
    try {
      const text = await file.text();
      const result = onImport(text);
      if (!result.ok) setSubmitError(result.error || "导入评测失败。");
    } catch (error) {
      setSubmitError(error.message || "读取评测文件失败。");
    }
  };

  return (
    <section className="detail-block" aria-labelledby="evaluation-title">
      <div className="block-heading">
        <div>
          <p className="eyebrow">EVALUATION TRACKING</p>
          <h2 id="evaluation-title">评测结果追踪</h2>
        </div>
        <Exam size={24} />
      </div>
      <p className="timeline-explanation">
        记录每次评测的指标、数值与时间，按时间序列查看 Agent 效果随迭代的变化趋势。
      </p>

      {storeError ? (
        <p className="timeline-error" role="alert">
          {storeError}
        </p>
      ) : null}

      {metricGroups.length ? (
        <EvaluationTrendChart groups={metricGroups} />
      ) : (
        <div className="timeline-empty">
          <Exam size={28} aria-hidden="true" />
          <h3>尚无评测结果</h3>
          <p>录入第一条评测结果后，指标趋势会出现在这里。</p>
        </div>
      )}

      <details className="advanced-fields">
        <summary>录入评测结果</summary>
        <form className="form-grid advanced-grid" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>
              指标名 <b>*</b>
            </span>
            <input
              name="metric"
              value={draft.metric}
              onChange={update}
              placeholder="准确率 / 延迟 / 成本"
              aria-invalid={Boolean(errors.metric)}
            />
            {errors.metric ? <small>{errors.metric}</small> : null}
          </label>
          <label className="form-field">
            <span>
              数值 <b>*</b>
            </span>
            <input
              name="value"
              value={draft.value}
              onChange={update}
              placeholder="92.3 / 1.2s / ~$0.012/次"
              aria-invalid={Boolean(errors.value)}
            />
            {errors.value ? <small>{errors.value}</small> : null}
          </label>
          <label className="form-field">
            <span>评测日期</span>
            <input type="date" name="evaluatedAt" value={draft.evaluatedAt} onChange={update} />
          </label>
          <label className="form-field">
            <span>备注</span>
            <input
              name="note"
              value={draft.note}
              onChange={update}
              placeholder="评测集、运行环境等补充说明"
            />
          </label>
          {submitError ? (
            <p className="timeline-error" role="alert">
              {submitError}
            </p>
          ) : null}
          <div className="form-actions">
            <button type="submit" className="primary-button">
              <Plus size={18} />
              记录评测
            </button>
            <button type="button" className="secondary-button" onClick={handleImportClick}>
              <UploadSimple size={18} />从 JSON 导入
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImportFile}
              hidden
            />
          </div>
        </form>
      </details>

      {sorted.length ? (
        <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {sorted.map((item) => (
            <li
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 0",
                borderBottom: "1px solid var(--line-soft)",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: "10px",
                    flexWrap: "wrap",
                  }}
                >
                  <strong>{item.metric}</strong>
                  <code>{item.value}</code>
                  <time dateTime={item.evaluatedAt} style={{ color: "var(--muted)" }}>
                    {item.evaluated}
                  </time>
                </div>
                {item.note ? <p style={{ margin: 0, color: "var(--muted)" }}>{item.note}</p> : null}
              </div>
              <button
                type="button"
                className="icon-button"
                style={{ color: "var(--red, #b03a1f)" }}
                onClick={() => handleDelete(item.id, `${item.metric}：${item.value}`)}
                aria-label={`删除评测 ${item.metric}`}
              >
                <Trash size={16} />
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

// 纯 SVG 折线趋势图：每个指标一条折线，横轴为评测时间，纵轴为该指标数值范围。
// 仅依赖坐标计算，不引入外部图表库。无法解析数值的点被跳过但记录仍保留。
function EvaluationTrendChart({ groups }) {
  const width = 560;
  const height = 200;
  const padding = { top: 16, right: 16, bottom: 32, left: 44 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const palette = ["#1f5fbf", "#b04a1f", "#3f8f5f", "#7a3f9f", "#b08a1f"];

  const series = groups
    .map((group, index) => {
      const points = group.items
        .filter((item) => item.numericValue !== null)
        .map((item) => ({
          x: item.evaluatedTimestamp,
          y: item.numericValue,
          label: item.value,
          date: item.evaluated,
        }));
      if (!points.length) return null;
      const values = points.map((point) => point.y);
      const min = Math.min(...values);
      const max = Math.max(...values);
      return {
        metric: group.metric,
        color: palette[index % palette.length],
        points,
        min,
        max,
      };
    })
    .filter(Boolean);

  if (!series.length) return null;

  const allX = series.flatMap((item) => item.points.map((point) => point.x));
  const xMin = Math.min(...allX);
  const xMax = Math.max(...allX);
  const xRange = xMax - xMin || 1;

  const scaleY = (item, y) => {
    const range = item.max - item.min || 1;
    return padding.top + plotHeight - ((y - item.min) / range) * plotHeight;
  };
  const scaleX = (x) => padding.left + ((x - xMin) / xRange) * plotWidth;

  return (
    <div role="img" aria-label="评测指标趋势图" style={{ marginBottom: "16px" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", maxWidth: `${width}px`, height: "auto" }}
      >
        <line
          x1={padding.left}
          y1={padding.top + plotHeight}
          x2={padding.left + plotWidth}
          y2={padding.top + plotHeight}
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.4"
        />
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + plotHeight}
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.4"
        />
        {series.map((item) => {
          const path = item.points
            .map(
              (point, index) =>
                `${index === 0 ? "M" : "L"} ${scaleX(point.x)} ${scaleY(item, point.y)}`,
            )
            .join(" ");
          return (
            <g key={item.metric}>
              <path
                d={path}
                fill="none"
                stroke={item.color}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {item.points.map((point, index) => (
                <circle
                  key={index}
                  cx={scaleX(point.x)}
                  cy={scaleY(item, point.y)}
                  r="3"
                  fill={item.color}
                >
                  <title>{`${item.metric}：${point.label}（${point.date}）`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      <ul
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          listStyle: "none",
          margin: "8px 0 0",
          padding: 0,
          fontSize: "13px",
        }}
      >
        {series.map((item) => (
          <li key={item.metric} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                display: "inline-block",
                width: "12px",
                height: "12px",
                background: item.color,
              }}
            />
            {item.metric}
          </li>
        ))}
      </ul>
    </div>
  );
}
