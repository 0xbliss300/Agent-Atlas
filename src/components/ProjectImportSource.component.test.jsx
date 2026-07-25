import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectImportSource } from "./ProjectImportSource.jsx";

function notFound() {
  const error = new Error("missing");
  error.name = "NotFoundError";
  return error;
}

function fileHandle(name, content) {
  return {
    async getFile() {
      return {
        name,
        size: content.length,
        lastModified: 1_750_000_000_000,
        async text() {
          return content;
        },
      };
    },
  };
}

function directoryHandle(name, entries) {
  return {
    name,
    async getFileHandle(key) {
      if (!entries[key]) throw notFound();
      return entries[key];
    },
    async getDirectoryHandle() {
      throw notFound();
    },
  };
}

afterEach(() => {
  delete window.showDirectoryPicker;
});

describe("ProjectImportSource", () => {
  it("只读目录后返回可编辑草稿，不直接创建项目", async () => {
    const onImported = vi.fn();
    window.showDirectoryPicker = vi.fn().mockResolvedValue(
      directoryHandle("local-agent", {
        "README.md": fileHandle("README.md", "# Local Agent\n\n用于本地开发。"),
        "package.json": fileHandle(
          "package.json",
          JSON.stringify({ scripts: { dev: "vite" }, dependencies: { react: "19.0.0" } }),
        ),
      }),
    );
    render(<ProjectImportSource existingProjects={[]} onImported={onImported} />);

    fireEvent.click(screen.getByRole("button", { name: /选择项目目录/ }));
    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));

    const imported = onImported.mock.calls[0][0];
    expect(imported.draft.name).toBe("Local Agent");
    expect(imported.draft.localPath).toBe("");
    expect(imported.sourceMetadata.filesRead).toEqual(
      expect.arrayContaining(["README.md", "package.json"]),
    );
  });

  it("取消目录授权不会覆盖当前表单或显示错误", async () => {
    const error = new Error("cancelled");
    error.name = "AbortError";
    window.showDirectoryPicker = vi.fn().mockRejectedValue(error);
    const onImported = vi.fn();
    render(<ProjectImportSource existingProjects={[]} onImported={onImported} />);

    fireEvent.click(screen.getByRole("button", { name: /选择项目目录/ }));
    await waitFor(() => expect(window.showDirectoryPicker).toHaveBeenCalled());
    expect(onImported).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
