import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AutoSyncControl } from "./AutoSyncControl.jsx";

describe("AutoSyncControl", () => {
  it("未监听时显示开启按钮", () => {
    const onStart = vi.fn();
    render(<AutoSyncControl isWatching={false} onStart={onStart} onStop={vi.fn()} />);
    expect(screen.getByRole("button", { name: /开启自动同步/ })).toBeInTheDocument();
    expect(screen.queryByText(/正在监听/)).not.toBeInTheDocument();
  });

  it("监听中显示停止按钮和状态文字", () => {
    const onStop = vi.fn();
    render(<AutoSyncControl isWatching={true} onStart={vi.fn()} onStop={onStop} />);
    expect(screen.getByText(/正在监听目录变更/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /停止自动同步/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /开启自动同步/ })).not.toBeInTheDocument();
  });

  it("点击开启按钮调用 onStart", () => {
    const onStart = vi.fn();
    render(<AutoSyncControl isWatching={false} onStart={onStart} onStop={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /开启自动同步/ }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("点击停止按钮调用 onStop", () => {
    const onStop = vi.fn();
    render(<AutoSyncControl isWatching={true} onStart={vi.fn()} onStop={onStop} />);
    fireEvent.click(screen.getByRole("button", { name: /停止自动同步/ }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("不支持时显示提示且不显示按钮", () => {
    render(
      <AutoSyncControl isWatching={false} supported={false} onStart={vi.fn()} onStop={vi.fn()} />,
    );
    expect(screen.getByText(/不支持目录监听/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("有错误时显示错误信息", () => {
    render(
      <AutoSyncControl
        isWatching={false}
        lastError="目录访问被拒绝"
        onStart={vi.fn()}
        onStop={vi.fn()}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("目录访问被拒绝");
  });
});
