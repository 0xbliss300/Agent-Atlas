import { fireEvent, render, screen, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Toast } from "./Toast.jsx";

describe("Toast 可见操作反馈", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("成功 Toast 以 role=status 出现，3 秒后进入退出状态", () => {
    render(<Toast message="已保存项目。" type="success" enabled onClose={vi.fn()} />);
    const toast = screen.getByRole("status");
    expect(toast).toHaveTextContent("已保存项目。");
    expect(toast.className).toContain("is-visible");

    act(() => vi.advanceTimersByTime(3000));
    expect(toast.className).toContain("is-hiding");
  });

  it("错误 Toast 以 role=alert 出现，不会自动消失，可手动关闭", () => {
    const onClose = vi.fn();
    render(<Toast message="保存失败。" type="error" enabled onClose={onClose} />);
    const toast = screen.getByRole("alert");
    expect(toast).toHaveTextContent("保存失败。");
    expect(toast.className).toContain("is-visible");

    act(() => vi.advanceTimersByTime(6000));
    expect(toast.className).toContain("is-visible");

    fireEvent.click(screen.getByRole("button", { name: "关闭通知" }));
    expect(toast.className).toContain("is-hiding");

    act(() => vi.advanceTimersByTime(300));
    expect(onClose).toHaveBeenCalled();
  });

  it("按 Esc 可提前关闭 Toast", () => {
    const onClose = vi.fn();
    render(<Toast message="提示信息。" type="success" enabled onClose={onClose} />);
    const toast = screen.getByRole("status");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(toast.className).toContain("is-hiding");

    act(() => vi.advanceTimersByTime(300));
    expect(onClose).toHaveBeenCalled();
  });

  it("启用状态下 Esc 才生效", () => {
    const onClose = vi.fn();
    render(<Toast message="提示信息。" type="success" enabled={false} onClose={onClose} />);
    const toast = screen.getByRole("status");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(toast.className).toContain("is-visible");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("连续操作通过不同 key 替换 Toast", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Toast message="操作一" type="success" enabled onClose={onClose} key={1} />,
    );
    expect(screen.getByText("操作一")).toBeInTheDocument();

    rerender(<Toast message="操作二失败" type="error" enabled onClose={onClose} key={2} />);
    expect(screen.queryByText("操作一")).not.toBeInTheDocument();
    const toast = screen.getByRole("alert");
    expect(toast).toHaveTextContent("操作二失败");
    expect(toast.className).toContain("is-visible");
  });
});
