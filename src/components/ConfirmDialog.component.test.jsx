import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog, ConfirmDialogProvider, useConfirmDialog } from "./ConfirmDialog.jsx";
import { useDialogFocus } from "../hooks/useDialogFocus.js";
import { useRef } from "react";

const baseProps = {
  title: "确认操作",
  message: "确定要继续吗？",
  detail: "此操作无法撤销。",
  confirmText: "确认",
  cancelText: "取消",
  danger: false,
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

function resetMocks() {
  baseProps.onConfirm.mockClear();
  baseProps.onCancel.mockClear();
}

// 一个使用 useDialogFocus 的宿主面板，用于堆叠测试。
function HostDialog({ onClose }) {
  const ref = useRef(null);
  useDialogFocus(ref, null, onClose);
  return (
    <div className="scrim">
      <section ref={ref} tabIndex="-1" role="dialog" aria-modal="true" aria-labelledby="host-title">
        <h2 id="host-title">宿主面板</h2>
        <button type="button">host-button</button>
      </section>
    </div>
  );
}

describe("ConfirmDialog", () => {
  it("渲染 alertdialog 并暴露正确的 aria 属性", () => {
    resetMocks();
    render(<ConfirmDialog {...baseProps} />);
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog.getAttribute("aria-labelledby")).toBe("confirm-title");
    expect(dialog.getAttribute("aria-describedby")).toBe("confirm-message");
    expect(screen.getByText("确认操作")).toBeInTheDocument();
    expect(screen.getByText("确定要继续吗？")).toBeInTheDocument();
  });

  it("不传 detail 时不渲染 .confirm-detail", () => {
    resetMocks();
    render(<ConfirmDialog {...baseProps} detail={undefined} />);
    expect(screen.queryByText("此操作无法撤销。")).not.toBeInTheDocument();
  });

  it("使用自定义按钮文案", () => {
    resetMocks();
    render(<ConfirmDialog {...baseProps} confirmText="删除" cancelText="不了" />);
    expect(screen.getByRole("button", { name: "删除" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "不了" })).toBeInTheDocument();
  });

  it("点击确认按钮调用 onConfirm", () => {
    resetMocks();
    render(<ConfirmDialog {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "确认" }));
    expect(baseProps.onConfirm).toHaveBeenCalledTimes(1);
    expect(baseProps.onCancel).not.toHaveBeenCalled();
  });

  it("点击取消按钮调用 onCancel", () => {
    resetMocks();
    render(<ConfirmDialog {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
    expect(baseProps.onConfirm).not.toHaveBeenCalled();
  });

  it("mouseDown 落在 scrim 上时调用 onCancel", () => {
    resetMocks();
    const { container } = render(<ConfirmDialog {...baseProps} />);
    const scrim = container.querySelector(".confirm-scrim");
    fireEvent.mouseDown(scrim);
    expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it("mouseDown 落在 panel 内部时不调用 onCancel", () => {
    resetMocks();
    const { container } = render(<ConfirmDialog {...baseProps} />);
    const panel = container.querySelector(".confirm-dialog");
    fireEvent.mouseDown(panel);
    expect(baseProps.onCancel).not.toHaveBeenCalled();
  });

  it("按 Esc 调用 onCancel", () => {
    resetMocks();
    render(<ConfirmDialog {...baseProps} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it("Tab 在最后一个按钮上时把焦点送回第一个；Shift+Tab 在第一个上时跳到最后一个", () => {
    resetMocks();
    const { container } = render(<ConfirmDialog {...baseProps} />);
    const buttons = container.querySelectorAll("button");
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    // 模拟焦点在最后一个按钮上，按 Tab → 应回到第一个
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    // 模拟焦点在第一个按钮上，按 Shift+Tab → 应回到最后一个
    first.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("danger 变体使用 danger-button 样式", () => {
    resetMocks();
    render(<ConfirmDialog {...baseProps} danger={true} confirmText="删除" />);
    const confirmBtn = screen.getByRole("button", { name: "删除" });
    expect(confirmBtn.className).toContain("danger-button");
    expect(confirmBtn.className).not.toContain("primary-button");
  });

  it("非 danger 变体使用 primary-button 样式", () => {
    resetMocks();
    render(<ConfirmDialog {...baseProps} danger={false} confirmText="确认" />);
    const confirmBtn = screen.getByRole("button", { name: "确认" });
    expect(confirmBtn.className).toContain("primary-button");
  });

  it("danger 时初始焦点落在 Cancel 按钮（防误触）", async () => {
    resetMocks();
    render(<ConfirmDialog {...baseProps} danger={true} confirmText="删除" cancelText="取消" />);
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "取消" }));
    });
  });

  it("非 danger 时初始焦点落在 Confirm 按钮", async () => {
    resetMocks();
    render(<ConfirmDialog {...baseProps} danger={false} confirmText="确认" cancelText="取消" />);
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "确认" }));
    });
  });
});

describe("ConfirmDialogProvider", () => {
  function TestConsumer({ onResult }) {
    const confirm = useConfirmDialog();
    return (
      <button
        type="button"
        onClick={async () => {
          const ok = await confirm({
            title: "删除项目",
            message: "确定删除吗？",
            confirmText: "删除",
            cancelText: "取消",
            danger: true,
          });
          onResult(ok);
        }}
      >
        触发确认
      </button>
    );
  }

  it("调用 confirm() 后弹出对话框；点击确认解析为 true", async () => {
    const onResult = vi.fn();
    render(
      <ConfirmDialogProvider>
        <TestConsumer onResult={onResult} />
      </ConfirmDialogProvider>,
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "触发确认" }));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    await waitFor(() => {
      expect(onResult).toHaveBeenCalledWith(true);
    });
  });

  it("点击取消解析为 false", async () => {
    const onResult = vi.fn();
    render(
      <ConfirmDialogProvider>
        <TestConsumer onResult={onResult} />
      </ConfirmDialogProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "触发确认" }));
    await screen.findByRole("alertdialog");
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    await waitFor(() => {
      expect(onResult).toHaveBeenCalledWith(false);
    });
  });

  it("对话框已打开时再次调用 confirm() 立即返回 false 且不替换当前对话框", async () => {
    const onResultFirst = vi.fn();
    const onResultSecond = vi.fn();
    let secondConfirmTrigger = null;

    function DoubleConsumer() {
      const confirm = useConfirmDialog();
      return (
        <>
          <button
            type="button"
            onClick={async () => {
              const ok = await confirm({
                title: "第一个",
                message: "m1",
                confirmText: "确认1",
                cancelText: "取消1",
              });
              onResultFirst(ok);
            }}
          >
            触发一
          </button>
          <button
            type="button"
            ref={(el) => {
              secondConfirmTrigger = el;
            }}
            onClick={async () => {
              const ok = await confirm({ title: "第二个", message: "m2" });
              onResultSecond(ok);
            }}
          >
            触发二
          </button>
        </>
      );
    }

    render(
      <ConfirmDialogProvider>
        <DoubleConsumer />
      </ConfirmDialogProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "触发一" }));
    await screen.findByRole("alertdialog");
    expect(screen.getByText("m1")).toBeInTheDocument();

    // 第二次调用：应立即返回 false，且对话框内容不变
    fireEvent.click(secondConfirmTrigger);
    await waitFor(() => {
      expect(onResultSecond).toHaveBeenCalledWith(false);
    });
    expect(screen.getByText("m1")).toBeInTheDocument();
    expect(screen.queryByText("m2")).not.toBeInTheDocument();
  });
});

describe("ConfirmDialog 与 useDialogFocus 堆叠", () => {
  it("ConfirmDialog 在宿主面板之上时，按 Esc 只关闭 ConfirmDialog，不触发宿主关闭", () => {
    const hostClose = vi.fn();
    const confirmCancel = vi.fn();
    render(
      <>
        <HostDialog onClose={hostClose} />
        <ConfirmDialog
          title="确认"
          message="m"
          confirmText="确认"
          cancelText="取消"
          onConfirm={vi.fn()}
          onCancel={confirmCancel}
        />
      </>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(confirmCancel).toHaveBeenCalledTimes(1);
    expect(hostClose).not.toHaveBeenCalled();
  });

  it("ConfirmDialog 关闭（卸载）后，宿主面板重新成为栈顶并响应 Esc", async () => {
    const hostClose = vi.fn();
    const confirmCancel = vi.fn();
    const { rerender } = render(
      <>
        <HostDialog onClose={hostClose} />
        <ConfirmDialog
          title="确认"
          message="m"
          confirmText="确认"
          cancelText="取消"
          onConfirm={vi.fn()}
          onCancel={confirmCancel}
        />
      </>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(confirmCancel).toHaveBeenCalledTimes(1);
    // 卸载 ConfirmDialog，模拟 Provider 关闭对话框
    rerender(<HostDialog onClose={hostClose} />);
    // 此时栈中只剩 HostDialog
    fireEvent.keyDown(document, { key: "Escape" });
    expect(hostClose).toHaveBeenCalledTimes(1);
  });
});
