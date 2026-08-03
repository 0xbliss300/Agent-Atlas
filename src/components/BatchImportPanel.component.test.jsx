import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BatchImportPanel } from "./BatchImportPanel.jsx";

function mockFile(name, text) {
  return {
    name,
    size: text.length,
    lastModified: 1_720_000_000_000,
    async text() {
      return text;
    },
  };
}

function mockParentHandle(children) {
  return {
    kind: "directory",
    async *values() {
      for (const child of children) {
        yield child;
      }
    },
  };
}

function mockSubdirectory(name, files) {
  const entries = new Map(files.map((file) => [file.name, file]));
  return {
    name,
    kind: "directory",
    async getFileHandle(key) {
      const entry = entries.get(key);
      if (!entry) {
        const error = new Error("missing");
        error.name = "NotFoundError";
        throw error;
      }
      return {
        name: key,
        async getFile() {
          return entry;
        },
      };
    },
    async getDirectoryHandle() {
      const error = new Error("missing");
      error.name = "NotFoundError";
      throw error;
    },
  };
}

describe("BatchImportPanel", () => {
  it("默认显示入口阶段，包含三种来源按钮", () => {
    render(<BatchImportPanel existingProjects={[]} onClose={vi.fn()} onSaveBatch={vi.fn()} />);
    expect(screen.getByRole("button", { name: /选择父目录批量扫描/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /上传 CSV 批量文件/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /上传 JSON 批量文件/ })).toBeInTheDocument();
  });

  it("上传 CSV 后进入审查阶段并显示草稿列表", async () => {
    const csv = [
      "name,short,status,progress,milestone",
      "Agent A,简介 A,active,30,起步",
      "Agent B,简介 B,planning,0,起步",
    ].join("\n");
    render(<BatchImportPanel existingProjects={[]} onClose={vi.fn()} onSaveBatch={vi.fn()} />);
    const csvInput = document.querySelector('input[accept=".csv,text/csv"]');
    fireEvent.change(csvInput, { target: { files: [mockFile("demo.csv", csv)] } });

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /已生成 2 个草稿/ })).toBeInTheDocument(),
    );
    expect(screen.getByText("Agent A")).toBeInTheDocument();
    expect(screen.getByText("Agent B")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /批量创建/ })).not.toBeDisabled();
  });

  it("勾选与取消勾选草稿，批量创建按钮随之启用/禁用", async () => {
    const csv = [
      "name,short,status,progress,milestone",
      "Agent A,简介 A,active,30,起步",
      "Agent B,简介 B,planning,0,起步",
    ].join("\n");
    render(<BatchImportPanel existingProjects={[]} onClose={vi.fn()} onSaveBatch={vi.fn()} />);
    const csvInput = document.querySelector('input[accept=".csv,text/csv"]');
    fireEvent.change(csvInput, { target: { files: [mockFile("demo.csv", csv)] } });

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /已生成 2 个草稿/ })).toBeInTheDocument(),
    );

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0]).toBeChecked();

    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0]).not.toBeChecked();
    expect(screen.getByRole("button", { name: /批量创建/ })).not.toBeDisabled();

    fireEvent.click(checkboxes[1]);
    expect(screen.getByRole("button", { name: /批量创建/ })).toBeDisabled();
  });

  it("点击批量创建调用 onSaveBatch 并显示结果阶段", async () => {
    const csv = ["name,short,status,progress,milestone", "Agent A,简介 A,active,30,起步"].join(
      "\n",
    );
    const onSaveBatch = vi.fn().mockReturnValue({
      created: [{ id: "p1", name: "Agent A" }],
      failed: [],
    });
    render(<BatchImportPanel existingProjects={[]} onClose={vi.fn()} onSaveBatch={onSaveBatch} />);
    const csvInput = document.querySelector('input[accept=".csv,text/csv"]');
    fireEvent.change(csvInput, { target: { files: [mockFile("demo.csv", csv)] } });

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /已生成 1 个草稿/ })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /批量创建/ }));

    await waitFor(() => expect(onSaveBatch).toHaveBeenCalledTimes(1));
    expect(onSaveBatch.mock.calls[0][1]).toHaveLength(1);
    expect(screen.getByRole("heading", { name: /成功创建 1 个项目/ })).toBeInTheDocument();
  });

  it("同名项目显示警告与重命名建议，应用建议后警告消失", async () => {
    const csv = ["name,short,status,progress,milestone", "Existing,简介,active,30,起步"].join("\n");
    render(
      <BatchImportPanel
        existingProjects={[{ name: "Existing" }]}
        onClose={vi.fn()}
        onSaveBatch={vi.fn()}
      />,
    );
    const csvInput = document.querySelector('input[accept=".csv,text/csv"]');
    fireEvent.change(csvInput, { target: { files: [mockFile("demo.csv", csv)] } });

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /已生成 1 个草稿/ })).toBeInTheDocument(),
    );

    expect(screen.getByText(/已有同名项目/)).toBeInTheDocument();
    expect(screen.getByText(/Existing \(1\)/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /应用建议/ }));
    expect(screen.queryByText(/已有同名项目/)).not.toBeInTheDocument();
  });

  it("扫描父目录后进入审查阶段并显示子目录草稿", async () => {
    const readmeA = {
      name: "README.md",
      async text() {
        return "# Agent A\n\n第一个。";
      },
    };
    const readmeB = {
      name: "README.md",
      async text() {
        return "# Agent B\n\n第二个。";
      },
    };
    const pickDirectory = vi
      .fn()
      .mockResolvedValue(
        mockParentHandle([
          mockSubdirectory("agent-a", [readmeA]),
          mockSubdirectory("agent-b", [readmeB]),
        ]),
      );
    render(
      <BatchImportPanel
        existingProjects={[]}
        onClose={vi.fn()}
        onSaveBatch={vi.fn()}
        pickDirectory={pickDirectory}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /选择父目录批量扫描/ }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /已生成 2 个草稿/ })).toBeInTheDocument(),
    );
    expect(pickDirectory).toHaveBeenCalledWith({ mode: "read" });
    expect(screen.getByText("Agent A")).toBeInTheDocument();
    expect(screen.getByText("Agent B")).toBeInTheDocument();
  });

  it("部分创建失败时在结果阶段显示失败列表", async () => {
    const csv = [
      "name,short,status,progress,milestone",
      "Valid,有效,active,30,起步",
      ",无名称,active,30,起步",
    ].join("\n");
    const onSaveBatch = vi.fn().mockReturnValue({
      created: [{ id: "p1", name: "Valid" }],
      failed: [{ key: "csv-1", sourceName: "demo.csv", message: "请输入项目名称。" }],
    });
    render(<BatchImportPanel existingProjects={[]} onClose={vi.fn()} onSaveBatch={onSaveBatch} />);
    const csvInput = document.querySelector('input[accept=".csv,text/csv"]');
    fireEvent.change(csvInput, { target: { files: [mockFile("demo.csv", csv)] } });

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /已生成 2 个草稿/ })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /批量创建/ }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /成功创建 1 个项目/ })).toBeInTheDocument(),
    );
    expect(screen.getByText(/请输入项目名称/)).toBeInTheDocument();
  });
});
