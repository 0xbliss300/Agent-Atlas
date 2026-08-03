import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { E2eSyncSettings } from "./E2eSyncSettings.jsx";

const defaultProps = {
  enabled: false,
  syncConfig: {
    baseUrl: "https://dav.example.com",
    basePath: "/agent-atlas/",
    username: "user",
    filePath: "/sync.enc.json",
  },
  lastSyncedAt: "",
  busy: false,
  error: "",
  onToggleEnabled: vi.fn(),
  onSaveConfig: vi.fn(),
  onPush: vi.fn(),
  onPull: vi.fn(),
};

describe("E2eSyncSettings", () => {
  it("未启用时只显示开关与说明", () => {
    render(<E2eSyncSettings {...defaultProps} />);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.queryByRole("button", { name: /推送到远端/ })).not.toBeInTheDocument();
  });

  it("启用后显示配置表单与推送/拉取按钮", () => {
    render(<E2eSyncSettings {...defaultProps} enabled={true} />);
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.getByRole("button", { name: /推送到远端/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /从远端拉取/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /保存同步配置/ })).toBeInTheDocument();
  });

  it("切换开关调用 onToggleEnabled", () => {
    const onToggleEnabled = vi.fn();
    render(<E2eSyncSettings {...defaultProps} onToggleEnabled={onToggleEnabled} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onToggleEnabled).toHaveBeenCalledWith(true);
  });

  it("点击保存配置调用 onSaveConfig", () => {
    const onSaveConfig = vi.fn();
    render(<E2eSyncSettings {...defaultProps} enabled={true} onSaveConfig={onSaveConfig} />);
    fireEvent.click(screen.getByRole("button", { name: /保存同步配置/ }));
    expect(onSaveConfig).toHaveBeenCalledTimes(1);
    expect(onSaveConfig.mock.calls[0][0]).toHaveProperty("baseUrl");
  });

  it("输入口令后点击推送调用 onPush", () => {
    const onPush = vi.fn();
    render(<E2eSyncSettings {...defaultProps} enabled={true} onPush={onPush} />);
    const passwordInput = screen.getByPlaceholderText("输入口令以加密/解密");
    fireEvent.change(passwordInput, { target: { value: "my-password" } });
    fireEvent.click(screen.getByRole("button", { name: /推送到远端/ }));
    expect(onPush).toHaveBeenCalledWith("my-password");
  });

  it("无口令时推送按钮禁用", () => {
    render(<E2eSyncSettings {...defaultProps} enabled={true} />);
    expect(screen.getByRole("button", { name: /推送到远端/ })).toBeDisabled();
  });

  it("busy 时显示同步状态", () => {
    render(<E2eSyncSettings {...defaultProps} enabled={true} busy={true} />);
    expect(screen.getByRole("status")).toHaveTextContent(/正在同步/);
  });

  it("有错误时显示错误信息", () => {
    render(<E2eSyncSettings {...defaultProps} enabled={true} error="连接超时" />);
    expect(screen.getByRole("alert")).toHaveTextContent("连接超时");
  });

  it("有上次同步时间时显示", () => {
    render(
      <E2eSyncSettings {...defaultProps} enabled={true} lastSyncedAt="2026-08-03T10:00:00.000Z" />,
    );
    expect(screen.getByText(/上次同步/)).toBeInTheDocument();
  });
});
