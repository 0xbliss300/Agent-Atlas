import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrashPage } from "./TrashPage.jsx";

const confirmMock = vi.hoisted(() => vi.fn(() => Promise.resolve(true)));
vi.mock("../components/ConfirmDialog.jsx", () => ({
  useConfirmDialog: () => confirmMock,
}));

beforeEach(() => {
  confirmMock.mockClear();
});

const projectEntry = {
  id: "trash-1",
  kind: "project",
  deletedAt: "2026-07-27T10:00:00.000+08:00",
  expiresAt: "2026-08-03T10:00:00.000+08:00",
  project: {
    id: "project-1",
    name: "测试项目",
    slug: "test-project",
    status: "active",
    statusLabel: "开发中",
    progress: 50,
    updatedAt: "2026-07-27T10:00:00.000+08:00",
  },
  notes: [],
  histories: [],
  events: [],
  drafts: [],
};

const noteEntry = {
  id: "trash-2",
  kind: "research-note",
  deletedAt: "2026-07-27T11:00:00.000+08:00",
  expiresAt: "2026-08-03T11:00:00.000+08:00",
  note: {
    id: "note-1",
    projectId: "project-1",
    title: "测试笔记",
    body: "# 测试正文",
    createdAt: "2026-07-27T11:00:00.000+08:00",
    updatedAt: "2026-07-27T11:00:00.000+08:00",
  },
  histories: [{ id: "history-1", noteId: "note-1", body: "旧版本" }],
  events: [],
  drafts: [],
};

function renderPage(props = {}) {
  return render(
    <TrashPage
      entries={[]}
      storeError={null}
      navigate={() => {}}
      onRestore={props.onRestore ?? vi.fn()}
      onDelete={props.onDelete ?? vi.fn()}
      onClear={props.onClear ?? vi.fn()}
      {...props}
    />,
  );
}

describe("TrashPage", () => {
  it("空回收站显示空状态并隐藏清空按钮", () => {
    renderPage();
    expect(screen.getByText("回收站为空")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回项目总览" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "清空回收站" })).not.toBeInTheDocument();
  });

  it("展示项目与研究笔记条目及关联元数据", () => {
    renderPage({ entries: [projectEntry, noteEntry] });
    expect(screen.getByText("测试项目")).toBeInTheDocument();
    expect(screen.getByText("测试笔记")).toBeInTheDocument();
    expect(screen.getByText("项目")).toBeInTheDocument();
    expect(screen.getByText("研究笔记")).toBeInTheDocument();
    expect(screen.getByText("0 篇笔记 · 0 条事件")).toBeInTheDocument();
    expect(screen.getByText("1 个历史版本")).toBeInTheDocument();
  });

  it("非空回收站显示清空按钮", () => {
    renderPage({ entries: [projectEntry] });
    expect(screen.getByRole("button", { name: "清空回收站" })).toBeInTheDocument();
  });

  it("恢复条目弹出确认并调用 onRestore", async () => {
    const onRestore = vi.fn();
    confirmMock.mockResolvedValueOnce(true);
    renderPage({ entries: [projectEntry], onRestore });

    fireEvent.click(screen.getAllByRole("button", { name: "恢复" })[0]);

    await waitFor(() => {
      expect(confirmMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "恢复条目",
          message: expect.stringContaining("测试项目"),
          confirmText: "恢复",
        }),
      );
    });
    await waitFor(() => expect(onRestore).toHaveBeenCalledWith(projectEntry));
  });

  it("取消恢复时不调用 onRestore", async () => {
    const onRestore = vi.fn();
    confirmMock.mockResolvedValueOnce(false);
    renderPage({ entries: [projectEntry], onRestore });

    fireEvent.click(screen.getAllByRole("button", { name: "恢复" })[0]);

    await waitFor(() => expect(confirmMock).toHaveBeenCalledOnce());
    expect(onRestore).not.toHaveBeenCalled();
  });

  it("彻底删除条目弹出危险确认并调用 onDelete", async () => {
    const onDelete = vi.fn();
    confirmMock.mockResolvedValueOnce(true);
    renderPage({ entries: [noteEntry], onDelete });

    fireEvent.click(screen.getAllByRole("button", { name: "彻底删除" })[0]);

    await waitFor(() => {
      expect(confirmMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "彻底删除",
          message: expect.stringContaining("测试笔记"),
          danger: true,
          confirmText: "彻底删除",
        }),
      );
    });
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(noteEntry));
  });

  it("点击清空回收站直接调用 onClear", async () => {
    const onClear = vi.fn();
    renderPage({ entries: [projectEntry, noteEntry], onClear });

    fireEvent.click(screen.getByRole("button", { name: "清空回收站" }));

    await waitFor(() => expect(onClear).toHaveBeenCalledOnce());
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it("显示回收站存储错误提示", () => {
    renderPage({ entries: [], storeError: "回收站损坏" });
    expect(screen.getByText("回收站损坏")).toBeInTheDocument();
  });
});
