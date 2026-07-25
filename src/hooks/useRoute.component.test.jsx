import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useRoute } from "./useRoute.js";

function RouteHarness() {
  const [path] = useRoute();
  return <output aria-label="当前路由">{path}</output>;
}

afterEach(() => {
  window.history.replaceState({}, "", "/#/");
});

describe("useRoute", () => {
  it("刷新读取 workbench Hash，并响应浏览器历史变化", () => {
    window.history.replaceState({}, "", "/#/workbench");
    render(<RouteHarness />);
    expect(screen.getByLabelText("当前路由")).toHaveTextContent("/workbench");

    window.history.pushState({}, "", "/#/notes");
    fireEvent.popState(window);
    expect(screen.getByLabelText("当前路由")).toHaveTextContent("/notes");

    window.history.back();
    window.history.pushState({}, "", "/#/workbench");
    fireEvent.popState(window);
    expect(screen.getByLabelText("当前路由")).toHaveTextContent("/workbench");
  });
});
