import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OverviewPage } from "./OverviewPage.jsx";

const project1 = {
  id: "project-1",
  name: "知识库 Agent",
  status: "active",
  statusTone: "active",
};

const project2 = {
  id: "project-2",
  name: "研究助手",
  status: "planning",
  statusTone: "planning",
};

const baseProps = {
  projects: [project1, project2],
  visibleProjects: [project1, project2],
  summary: { total: 2, active: 1, done: 0 },
  recentProjects: [],
  showRecent: false,
  onAdd: () => {},
  onOpenSettings: () => {},
  navigate: () => {},
  storeError: null,
  query: "",
  statusFilter: "all",
  tagFilter: "all",
  collectionFilter: "all",
  tagOptions: [],
  collections: [],
  sortBy: "updated",
  onQueryChange: () => {},
  onStatusFilterChange: () => {},
  onTagFilterChange: () => {},
  onCollectionFilterChange: () => {},
  onSortChange: () => {},
  onTogglePin: () => {},
};

describe("TODO-060 最近访问栏", () => {
  it("没有访问记录时不渲染该区域", () => {
    const { container } = render(<OverviewPage {...baseProps} recentAccess={[]} />);
    expect(container.querySelector(".recent-access")).toBeNull();
  });

  it("渲染访问记录并按倒序展示项目名", () => {
    render(
      <OverviewPage
        {...baseProps}
        recentAccess={[
          { project: project1, accessedAt: "2026-07-28T10:00:00.000Z" },
          { project: project2, accessedAt: "2026-07-28T09:00:00.000Z" },
        ]}
      />,
    );
    const list = screen.getByRole("list", { name: "" });
    expect(list).toBeInTheDocument();
    const items = list.querySelectorAll("button");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("知识库 Agent");
    expect(items[1]).toHaveTextContent("研究助手");
  });

  it("点击条目调用 navigate 跳转到对应项目", () => {
    const navigate = vi.fn();
    render(
      <OverviewPage
        {...baseProps}
        navigate={navigate}
        recentAccess={[
          { project: project1, accessedAt: "2026-07-28T10:00:00.000Z" },
          { project: project2, accessedAt: "2026-07-28T09:00:00.000Z" },
        ]}
      />,
    );
    const item = document.querySelector('.recent-access-item[title="知识库 Agent"]');
    fireEvent.click(item);
    expect(navigate).toHaveBeenCalledWith("/project/project-1");
  });

  it("清空按钮触发 onClearRecentAccess 回调", () => {
    const onClearRecentAccess = vi.fn();
    render(
      <OverviewPage
        {...baseProps}
        onClearRecentAccess={onClearRecentAccess}
        recentAccess={[{ project: project1, accessedAt: "2026-07-28T10:00:00.000Z" }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "清空最近访问记录" }));
    expect(onClearRecentAccess).toHaveBeenCalledOnce();
  });

  it("section 具备 aria-labelledby 关联到标题", () => {
    render(
      <OverviewPage
        {...baseProps}
        recentAccess={[{ project: project1, accessedAt: "2026-07-28T10:00:00.000Z" }]}
      />,
    );
    const section = document.querySelector(".recent-access");
    expect(section).toHaveAttribute("aria-labelledby", "recent-access-title");
    expect(screen.getByText("最近访问")).toHaveAttribute("id", "recent-access-title");
  });

  it("仅展示 recentAccess 中包含的项目，不渲染全部项目", () => {
    render(
      <OverviewPage
        {...baseProps}
        recentAccess={[{ project: project2, accessedAt: "2026-07-28T10:00:00.000Z" }]}
      />,
    );
    const list = screen.getByRole("list");
    const items = list.querySelectorAll("button");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("研究助手");
  });
});
