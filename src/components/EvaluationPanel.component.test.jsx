import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialogProvider } from "./ConfirmDialog.jsx";
import { EvaluationPanel } from "./EvaluationPanel.jsx";
import { createEvaluationRecord, normalizeEvaluation } from "../data/evaluations.js";

function evaluation(overrides = {}) {
  const base = createEvaluationRecord(
    { projectId: "p1", metric: "准确率", value: "92.3%", evaluatedAt: "2026-08-01" },
    [],
    [{ id: "p1" }],
  );
  return normalizeEvaluation({ ...base, ...overrides });
}

function renderPanel(props = {}) {
  const handlers = {
    onAdd: vi.fn(() => ({ ok: true })),
    onDelete: vi.fn(() => ({ ok: true })),
    onImport: vi.fn(() => ({ ok: true })),
    ...props,
  };
  const result = render(
    <ConfirmDialogProvider>
      <EvaluationPanel evaluations={props.evaluations ?? []} {...handlers} />
    </ConfirmDialogProvider>,
  );
  return { ...result, handlers };
}

describe("EvaluationPanel", () => {
  it("无评测结果时展示空状态提示", () => {
    renderPanel();
    expect(screen.getByText("尚无评测结果")).toBeInTheDocument();
  });

  it("按时间倒序展示评测结果列表", () => {
    const early = evaluation({
      id: "e1",
      evaluatedAt: "2026-08-01T00:00:00+08:00",
      evaluated: "2026-08-01",
    });
    const later = evaluation({
      id: "e2",
      metric: "延迟",
      value: "1.2s",
      evaluatedAt: "2026-08-10T00:00:00+08:00",
      evaluated: "2026-08-10",
    });
    renderPanel({ evaluations: [early, later] });
    const deleteButtons = screen.getAllByRole("button", { name: /^删除评测/ });
    expect(deleteButtons.map((btn) => btn.getAttribute("aria-label"))).toEqual([
      "删除评测 延迟",
      "删除评测 准确率",
    ]);
  });

  it("存在可解析数值的评测时渲染趋势图", () => {
    renderPanel({
      evaluations: [evaluation({ id: "e1", value: "90%" }), evaluation({ id: "e2", value: "93%" })],
    });
    expect(screen.getByRole("img", { name: "评测指标趋势图" })).toBeInTheDocument();
  });

  it("录入表单调用 onAdd 并带表单字段", () => {
    const { handlers } = renderPanel();
    fireEvent.click(screen.getByText("录入评测结果"));
    fireEvent.change(screen.getByPlaceholderText("准确率 / 延迟 / 成本"), {
      target: { value: "准确率" },
    });
    fireEvent.change(screen.getByPlaceholderText("92.3 / 1.2s / ~$0.012/次"), {
      target: { value: "94%" },
    });
    fireEvent.click(screen.getByRole("button", { name: /记录评测/ }));
    expect(handlers.onAdd).toHaveBeenCalledTimes(1);
    const draft = handlers.onAdd.mock.calls[0][0];
    expect(draft.metric).toBe("准确率");
    expect(draft.value).toBe("94%");
  });

  it("删除按钮触发确认对话框，确认后调用 onDelete", async () => {
    const target = evaluation({ id: "e1", metric: "准确率", value: "92.3%" });
    const { handlers } = renderPanel({ evaluations: [target] });
    fireEvent.click(screen.getByRole("button", { name: "删除评测 准确率" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    await waitFor(() => {
      expect(handlers.onDelete).toHaveBeenCalledWith("e1");
    });
  });
});
