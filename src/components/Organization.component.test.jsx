import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OverviewPage } from "../pages/OverviewPage.jsx";
import { CollectionManager } from "./CollectionManager.jsx";

// TODO-059: CollectionManager 通过 useConfirmDialog 替换 window.confirm，
// 测试侧用 hoisted mock 模拟“用户确认”。
const confirmMock = vi.hoisted(() => vi.fn(() => Promise.resolve(true)));
vi.mock("./ConfirmDialog.jsx", () => ({
  useConfirmDialog: () => confirmMock,
}));

const project = {
  id: "project-1",
  name: "组织项目",
  short: "支持标签和集合",
  description: "组织项目",
  status: "active",
  statusLabel: "开发中",
  statusTone: "active",
  progress: 40,
  progressValid: true,
  milestone: "完成组织能力",
  updated: "2026-07-25",
  updatedTime: "10:00",
  updatedAt: "2026-07-25T10:00:00+08:00",
  updatedTimestamp: Date.parse("2026-07-25T10:00:00+08:00"),
  iconKey: "showcase",
  tags: ["Agent"],
  pinned: false,
  collectionIds: ["collection-1"],
  log: ["完成组织能力"],
  technology: { languages: [], frameworks: [], models: [], dataSources: [] },
};

describe("项目组织界面", () => {
  it("概览标签与集合筛选可用键盘控件操作并播报结果", () => {
    const onTagFilterChange = vi.fn();
    const onCollectionFilterChange = vi.fn();
    const onQueryChange = vi.fn();
    const onStatusFilterChange = vi.fn();
    render(
      <OverviewPage
        projects={[project, { ...project, id: "project-2", name: "其他项目" }]}
        visibleProjects={[project]}
        summary={{ total: 2, active: 2, done: 0 }}
        recentProjects={[project]}
        showRecent={false}
        onAdd={() => {}}
        onOpenSettings={() => {}}
        navigate={() => {}}
        query=""
        statusFilter="all"
        tagFilter="Agent"
        collectionFilter="collection-1"
        tagOptions={["Agent", "研究"]}
        collections={[{ id: "collection-1", name: "当前重点" }]}
        onQueryChange={onQueryChange}
        onStatusFilterChange={onStatusFilterChange}
        onTagFilterChange={onTagFilterChange}
        onCollectionFilterChange={onCollectionFilterChange}
        onSortChange={() => {}}
        sortBy="updated"
        onTogglePin={() => {}}
      />,
    );
    expect(screen.getByText("显示 1 / 2 个项目")).toHaveAttribute("aria-live", "polite");
    const tagSelect = screen.getByRole("combobox", { name: /标签/ });
    tagSelect.focus();
    expect(tagSelect).toHaveFocus();
    fireEvent.change(tagSelect, { target: { value: "研究" } });
    expect(onTagFilterChange).toHaveBeenCalledWith("研究");
    fireEvent.change(screen.getByRole("combobox", { name: /集合/ }), {
      target: { value: "all" },
    });
    expect(onCollectionFilterChange).toHaveBeenCalledWith("all");
    fireEvent.click(screen.getByRole("button", { name: "清除筛选" }));
    expect(onQueryChange).toHaveBeenCalledWith("");
    expect(onStatusFilterChange).toHaveBeenCalledWith("all");
  });

  it("删除包含项目的集合先说明影响且只调用解除关联操作", async () => {
    const onDelete = vi.fn(() => ({ ok: true }));
    confirmMock.mockClear();
    render(
      <CollectionManager
        collections={[{ id: "collection-1", name: "当前重点", order: 0 }]}
        projects={[project]}
        onCreate={() => ({ ok: true })}
        onRename={() => ({ ok: true })}
        onMove={() => ({ ok: true })}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByText("1 个项目")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "删除当前重点" }));
    expect(confirmMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringMatching(/项目、研究笔记、任务和历史都不会被删除/),
      }),
    );
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("collection-1"));
    expect(screen.getByRole("status")).toHaveTextContent("项目及研究内容未受影响");
  });
});
