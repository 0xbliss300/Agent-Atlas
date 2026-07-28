import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts.js";

function Harness({ enabled = true, handlers }) {
  useKeyboardShortcuts({ enabled, ...handlers });
  return <input data-testid="editable" />;
}

function keyDown(key, target = document) {
  fireEvent.keyDown(target, { key });
}

describe("useKeyboardShortcuts 全局快捷键", () => {
  it("/ 触发聚焦搜索", () => {
    const onFocusSearch = vi.fn();
    render(<Harness handlers={{ onFocusSearch }} />);
    keyDown("/");
    expect(onFocusSearch).toHaveBeenCalledOnce();
  });

  it("n 触发新建项目", () => {
    const onNewProject = vi.fn();
    render(<Harness handlers={{ onNewProject }} />);
    keyDown("n");
    expect(onNewProject).toHaveBeenCalledOnce();
  });

  it("g w 跳转到开发工作台", () => {
    const navigate = vi.fn();
    render(<Harness handlers={{ navigate }} />);
    keyDown("g");
    keyDown("w");
    expect(navigate).toHaveBeenCalledWith("/workbench");
  });

  it("g n 跳转到研究笔记", () => {
    const navigate = vi.fn();
    render(<Harness handlers={{ navigate }} />);
    keyDown("g");
    keyDown("n");
    expect(navigate).toHaveBeenCalledWith("/notes");
  });

  it("在可编辑控件内屏蔽单键快捷键", () => {
    const onFocusSearch = vi.fn();
    render(<Harness handlers={{ onFocusSearch }} />);
    const input = document.querySelector('[data-testid="editable"]');
    keyDown("/", input);
    expect(onFocusSearch).not.toHaveBeenCalled();
  });

  it("? 触发打开帮助", () => {
    const onOpenHelp = vi.fn();
    render(<Harness handlers={{ onOpenHelp }} />);
    keyDown("?");
    expect(onOpenHelp).toHaveBeenCalledOnce();
  });

  it("enableShortcuts 关闭时不触发任何快捷键", () => {
    const onFocusSearch = vi.fn();
    const onNewProject = vi.fn();
    render(<Harness enabled={false} handlers={{ onFocusSearch, onNewProject }} />);
    keyDown("/");
    keyDown("n");
    expect(onFocusSearch).not.toHaveBeenCalled();
    expect(onNewProject).not.toHaveBeenCalled();
  });
});
