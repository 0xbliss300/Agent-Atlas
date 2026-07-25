import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarkdownRenderer } from "../components/MarkdownRenderer.jsx";
import { NOTE_AUTOSAVE_DELAY, ResearchNotePage } from "./ResearchNotePage.jsx";

const project = { id: "project-1", name: "知识库 Agent" };

afterEach(() => {
  vi.useRealTimers();
});

describe("ResearchNotePage", () => {
  it("新建时实时渲染 Markdown 并提交项目关联", () => {
    const onSave = vi.fn(() => ({ ok: true }));
    render(
      <ResearchNotePage
        note={null}
        projects={[project]}
        preferredProjectId="project-1"
        onSave={onSave}
        onDelete={() => {}}
        navigate={() => {}}
        storeError={null}
      />,
    );
    fireEvent.change(screen.getByLabelText(/笔记标题/), {
      target: { value: "索引实验" },
    });
    fireEvent.change(screen.getByLabelText(/MARKDOWN/), {
      target: { value: "## 结论\n\n- [x] 已完成" },
    });
    expect(screen.getByRole("heading", { name: "结论" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "保存研究笔记" }));
    expect(onSave).toHaveBeenCalledWith({
      projectId: "project-1",
      title: "索引实验",
      body: "## 结论\n\n- [x] 已完成",
    });
  });

  it("阅读态可进入编辑并删除", () => {
    const onDelete = vi.fn();
    render(
      <ResearchNotePage
        note={{
          id: "note-1",
          projectId: "project-1",
          title: "实验记录",
          body: "**结论**",
          created: "2026-07-24",
          updated: "2026-07-25",
          updatedTime: "12:00",
        }}
        projects={[project]}
        onSave={() => ({ ok: true })}
        onDelete={onDelete}
        navigate={() => {}}
        storeError={null}
      />,
    );
    expect(screen.getByText("结论")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    expect(onDelete).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    expect(screen.getByDisplayValue("实验记录")).toBeInTheDocument();
  });

  it("Markdown 不执行原始 HTML 或危险链接并安全标记外部链接", () => {
    const { container } = render(
      <MarkdownRenderer>
        {
          "<script>alert(1)</script>\n[危险](javascript:alert(1))\n[外部](https://example.com)\n![追踪](https://example.com/x.png)"
        }
      </MarkdownRenderer>,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText("危险").closest("a")).toBeNull();
    const external = screen.getByRole("link", { name: "外部" });
    expect(external).toHaveAttribute("target", "_blank");
    expect(external).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("[远程图片已禁用]")).toBeInTheDocument();
  });

  it("使用可控计时器防抖保存草稿并显示保存状态", () => {
    vi.useFakeTimers();
    const onSaveDraft = vi.fn(() => ({
      ok: true,
      updatedAt: "2026-07-25T12:30:00+08:00",
    }));
    render(
      <ResearchNotePage
        note={null}
        projects={[project]}
        preferredProjectId="project-1"
        onSave={() => ({ ok: true })}
        onDelete={() => {}}
        navigate={() => {}}
        storeError={null}
        draftKey="new:project-1"
        onSaveDraft={onSaveDraft}
      />,
    );
    fireEvent.change(screen.getByLabelText(/笔记标题/), {
      target: { value: "自动草稿" },
    });
    expect(screen.getByText("正在保存草稿…")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(NOTE_AUTOSAVE_DELAY - 1));
    expect(onSaveDraft).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onSaveDraft).toHaveBeenCalledWith(
      "new:project-1",
      expect.objectContaining({ title: "自动草稿" }),
      "",
    );
    expect(screen.getByText(/草稿已保存/)).toBeInTheDocument();
  });

  it("刷新进入时提示较新的草稿并支持差异、恢复与放弃", () => {
    const onDeleteDraft = vi.fn(() => ({ ok: true }));
    const note = {
      id: "note-1",
      projectId: "project-1",
      title: "正式标题",
      body: "正式正文",
      created: "2026-07-24",
      updated: "2026-07-25",
      updatedTime: "10:00",
      updatedAt: "2026-07-25T10:00:00+08:00",
      updatedTimestamp: Date.parse("2026-07-25T10:00:00+08:00"),
    };
    const savedDraft = {
      key: "note:note-1",
      noteId: "note-1",
      projectId: "project-1",
      title: "草稿标题",
      body: "正式正文\n新增结论",
      updatedAt: "2026-07-25T11:00:00+08:00",
      updatedTimestamp: Date.parse("2026-07-25T11:00:00+08:00"),
    };
    const { rerender } = render(
      <ResearchNotePage
        note={note}
        projects={[project]}
        onSave={() => ({ ok: true })}
        onDelete={() => {}}
        navigate={() => {}}
        storeError={null}
        draftKey="note:note-1"
        savedDraft={savedDraft}
        onDeleteDraft={onDeleteDraft}
      />,
    );
    expect(screen.getByRole("heading", { name: "发现更新的本地草稿" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看差异" }));
    expect(screen.getByLabelText("笔记差异预览")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "恢复草稿" }));
    expect(screen.getByDisplayValue("草稿标题")).toBeInTheDocument();

    rerender(
      <ResearchNotePage
        note={{ ...note, id: "note-2" }}
        projects={[project]}
        onSave={() => ({ ok: true })}
        onDelete={() => {}}
        navigate={() => {}}
        storeError={null}
        draftKey="note:note-2"
        savedDraft={{ ...savedDraft, key: "note:note-2", noteId: "note-2" }}
        onDeleteDraft={onDeleteDraft}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "放弃草稿" }));
    expect(onDeleteDraft).toHaveBeenCalledWith("note:note-2");
    expect(screen.queryByRole("heading", { name: "发现更新的本地草稿" })).not.toBeInTheDocument();
  });

  it("历史版本可预览差异并恢复到编辑态，正式保存前不覆盖", () => {
    const onSave = vi.fn(() => ({ ok: true }));
    const note = {
      id: "note-1",
      projectId: "project-1",
      title: "当前版本",
      body: "当前正文",
      created: "2026-07-24",
      updated: "2026-07-25",
      updatedTime: "12:00",
      updatedAt: "2026-07-25T12:00:00+08:00",
    };
    const history = {
      id: "version-1",
      noteId: "note-1",
      projectId: "project-1",
      title: "历史版本",
      body: "历史正文",
      createdAt: "2026-07-24T12:00:00+08:00",
      excerpt: "历史正文",
    };
    render(
      <ResearchNotePage
        note={note}
        projects={[project]}
        onSave={onSave}
        onDelete={() => {}}
        navigate={() => {}}
        storeError={null}
        draftKey="note:note-1"
        histories={[history]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "版本历史 (1)" }));
    fireEvent.click(screen.getByRole("button", { name: "预览差异" }));
    expect(screen.getByText("与当前内容的差异")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "恢复此版本" }));
    expect(screen.getByDisplayValue("历史版本")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));
    expect(onSave).toHaveBeenCalledWith({
      projectId: "project-1",
      title: "历史版本",
      body: "历史正文",
    });
  });

  it("草稿存储失败时显示失败状态，页面仍允许正式保存", () => {
    vi.useFakeTimers();
    const onSave = vi.fn(() => ({ ok: true }));
    render(
      <ResearchNotePage
        note={null}
        projects={[project]}
        preferredProjectId="project-1"
        onSave={onSave}
        onDelete={() => {}}
        navigate={() => {}}
        storeError={null}
        draftKey="new:project-1"
        onSaveDraft={() => ({ ok: false, error: "本地空间不足" })}
      />,
    );
    fireEvent.change(screen.getByLabelText(/笔记标题/), {
      target: { value: "仍可正式保存" },
    });
    act(() => vi.advanceTimersByTime(NOTE_AUTOSAVE_DELAY));
    expect(screen.getByText(/保存失败 · 本地空间不足/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/MARKDOWN/), {
      target: { value: "正式正文" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存研究笔记" }));
    expect(onSave).toHaveBeenCalledOnce();
  });
});
