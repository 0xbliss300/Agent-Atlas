import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GitRepositoryImport } from "./GitRepositoryImport.jsx";

function mockResponse(status, body) {
  return {
    status,
    headers: { get: () => null },
    async text() {
      return typeof body === "string" ? body : JSON.stringify(body);
    },
  };
}

function successFetchImpl() {
  return async (url) => {
    if (url.endsWith("/repos/owner/demo")) {
      return mockResponse(200, {
        description: "demo agent",
        language: "TypeScript",
        default_branch: "main",
        license: { spdx_id: "MIT" },
      });
    }
    if (url.endsWith("/repos/owner/demo/readme")) {
      return mockResponse(200, "# Demo Agent\n\nA demo project.");
    }
    if (url.endsWith("/repos/owner/demo/contents/package.json")) {
      return mockResponse(200, JSON.stringify({ dependencies: { react: "19.0.0" } }));
    }
    if (url.endsWith("/repos/owner/demo/commits?per_page=1")) {
      return mockResponse(200, [
        { sha: "abcdef123456", commit: { author: { date: "2026-07-01T00:00:00Z" } } },
      ]);
    }
    return mockResponse(404, "");
  };
}

describe("GitRepositoryImport", () => {
  it("输入 URL 并点击拉取后调用 onImported 并清空输入", async () => {
    const onImported = vi.fn();
    render(
      <GitRepositoryImport
        existingProjects={[]}
        onImported={onImported}
        fetchImpl={successFetchImpl()}
      />,
    );

    const input = screen.getByLabelText("仓库 URL");
    const button = screen.getByRole("button", { name: /拉取仓库元数据/ });

    expect(button).toBeDisabled();
    fireEvent.change(input, { target: { value: "https://github.com/owner/demo" } });
    expect(button).not.toBeDisabled();

    fireEvent.click(button);
    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));

    const imported = onImported.mock.calls[0][0];
    expect(imported.draft.name).toBe("Demo Agent");
    expect(imported.draft.repositoryUrl).toBe("https://github.com/owner/demo");
    expect(imported.sourceMetadata.branch).toBe("main");
    expect(input).toHaveValue("");
  });

  it("按 Enter 键触发拉取而不是提交外层表单", async () => {
    const onImported = vi.fn();
    render(
      <GitRepositoryImport
        existingProjects={[]}
        onImported={onImported}
        fetchImpl={successFetchImpl()}
      />,
    );

    const input = screen.getByLabelText("仓库 URL");
    fireEvent.change(input, { target: { value: "https://github.com/owner/demo" } });
    fireEvent.keyDown(input, { key: "Enter", preventDefault: () => {} });

    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));
  });

  it("私有仓库或不存在仓库时显示错误且不覆盖已有草稿", async () => {
    const onImported = vi.fn();
    const fetchImpl = async () => mockResponse(404, "");
    render(
      <GitRepositoryImport existingProjects={[]} onImported={onImported} fetchImpl={fetchImpl} />,
    );

    fireEvent.change(screen.getByLabelText("仓库 URL"), {
      target: { value: "https://github.com/owner/private" },
    });
    fireEvent.click(screen.getByRole("button", { name: /拉取仓库元数据/ }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/未找到仓库 owner\/private/),
    );
    expect(onImported).not.toHaveBeenCalled();
  });

  it("非 github 主机显示解析错误", async () => {
    const onImported = vi.fn();
    render(
      <GitRepositoryImport
        existingProjects={[]}
        onImported={onImported}
        fetchImpl={async () => {}}
      />,
    );

    fireEvent.change(screen.getByLabelText("仓库 URL"), {
      target: { value: "https://gitlab.com/owner/repo" },
    });
    fireEvent.click(screen.getByRole("button", { name: /拉取仓库元数据/ }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/仅支持 github\.com/));
    expect(onImported).not.toHaveBeenCalled();
  });

  it("拉取过程中显示加载状态", async () => {
    const fetchImpl = async (url) => {
      await new Promise((resolve) => globalThis.setTimeout(resolve, 30));
      if (url.endsWith("/repos/owner/demo")) {
        return mockResponse(200, { description: "demo", default_branch: "main" });
      }
      return mockResponse(404, "");
    };
    render(
      <GitRepositoryImport existingProjects={[]} onImported={vi.fn()} fetchImpl={fetchImpl} />,
    );

    fireEvent.change(screen.getByLabelText("仓库 URL"), {
      target: { value: "https://github.com/owner/demo" },
    });
    fireEvent.click(screen.getByRole("button", { name: /拉取仓库元数据/ }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/正在只读拉取 GitHub 仓库元数据/),
    );
    expect(screen.getByRole("button", { name: /拉取仓库元数据/ })).toBeDisabled();

    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("空 URL 时点击按钮提示输入且不发起请求", () => {
    const onImported = vi.fn();
    const fetchImpl = vi.fn();
    render(
      <GitRepositoryImport existingProjects={[]} onImported={onImported} fetchImpl={fetchImpl} />,
    );

    // 按钮在 URL 为空时禁用，无法点击
    expect(screen.getByRole("button", { name: /拉取仓库元数据/ })).toBeDisabled();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(onImported).not.toHaveBeenCalled();
  });
});
