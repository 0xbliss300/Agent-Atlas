import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import pkg from "../package.json";
import { App } from "./App.jsx";
import { ConfirmDialogProvider } from "./components/ConfirmDialog.jsx";
import { APP_VERSION } from "./version.js";

// TODO-063：验证版本号以 package.json 为单一来源，构建时注入并在页脚一致显示。

describe("TODO-063 版本号构建注入", () => {
  it("APP_VERSION 与 package.json 的 version 一致", () => {
    expect(APP_VERSION).toBe(pkg.version);
  });

  it("APP_VERSION 符合语义化版本形状", () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe("TODO-063 页脚版本号显示", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("页脚展示的 VERSION 与 package.json 一致", () => {
    render(
      <ConfirmDialogProvider>
        <App />
      </ConfirmDialogProvider>,
    );
    expect(screen.getByText(`LOCAL-FIRST · PRIVATE · VERSION ${APP_VERSION}`)).toBeInTheDocument();
    expect(APP_VERSION).toBe(pkg.version);
  });
});
