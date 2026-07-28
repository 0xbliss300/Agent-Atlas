import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectDetailPage } from "./ProjectDetailPage.jsx";

const confirmMock = vi.hoisted(() => vi.fn(() => Promise.resolve(true)));
vi.mock("../components/ConfirmDialog.jsx", () => ({
  useConfirmDialog: () => confirmMock,
}));

beforeEach(() => {
  confirmMock.mockClear();
});

const project = {
  id: "project-1",
  slug: "project-1",
  name: "知识库 Agent",
  short: "整理本地研究资料",
  description: "本地优先的研究资料助手",
  status: "active",
  statusLabel: "开发中",
  statusTone: "active",
  progress: 60,
  progressValid: true,
  progressBasis: "完成度由用户手动维护。",
  milestone: "完成检索闭环",
  updated: "2026-07-25",
  updatedTime: "12:00",
  iconKey: "showcase",
  localPath: null,
  repositoryUrl: null,
  documentationPath: null,
  demoUrl: null,
  previewPath: null,
  features: [],
  roadmap: [],
  log: [],
  blockers: [],
  nextTasks: [],
  technology: {
    languages: [],
    frameworks: [],
    models: [],
    dataSources: [],
    runCommand: "",
  },
  collectionIds: [],
  localSync: null,
};

function renderPage(props = {}) {
  return render(
    <ProjectDetailPage
      project={project}
      researchNotes={[]}
      projectEvents={[]}
      eventStoreError={null}
      notesMode={false}
      navigate={() => {}}
      onEdit={() => {}}
      onDuplicate={() => {}}
      onDelete={() => {}}
      onExportProject={props.onExportProject ?? vi.fn()}
      onToggleTask={() => {}}
      onOpenSync={() => {}}
      onOpenCodexContext={() => {}}
      onNewResearchNote={() => {}}
      {...props}
    />,
  );
}

describe("ProjectDetailPage 单项目导出", () => {
  it("点击导出按钮弹出确认并调用 onExportProject", async () => {
    const onExportProject = vi.fn();
    confirmMock.mockResolvedValueOnce(true);
    renderPage({ onExportProject });

    fireEvent.click(screen.getByRole("button", { name: "导出" }));

    await waitFor(() => {
      expect(confirmMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "导出项目",
          message: expect.stringContaining("知识库 Agent"),
          detail: expect.stringContaining("研究笔记"),
        }),
      );
    });
    await waitFor(() => expect(onExportProject).toHaveBeenCalledOnce());
  });

  it("取消导出时不调用 onExportProject", async () => {
    const onExportProject = vi.fn();
    confirmMock.mockResolvedValueOnce(false);
    renderPage({ onExportProject });

    fireEvent.click(screen.getByRole("button", { name: "导出" }));

    await waitFor(() => expect(confirmMock).toHaveBeenCalledOnce());
    expect(onExportProject).not.toHaveBeenCalled();
  });
});
