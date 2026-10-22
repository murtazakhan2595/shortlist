import { render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { HeaderNav, TabBar } from "./app-nav";

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

function renderNav(path: string) {
  pathname = path;
  render(
    <>
      <HeaderNav />
      <TabBar />
    </>,
  );
  return {
    header: screen.getByRole("navigation", { name: "Main" }),
    tabBar: screen.getByRole("navigation", { name: "Sections" }),
  };
}

function linkNames(nav: HTMLElement): string[] {
  return within(nav)
    .getAllByRole("link")
    .map((link) => link.textContent ?? "");
}

test("every page is reachable from the header, and the daily ones from the tab bar", () => {
  const { header, tabBar } = renderNav("/forms");

  expect(linkNames(header)).toEqual(["Home", "Jobs", "Capture", "Forms", "Profile", "Settings"]);
  expect(linkNames(tabBar)).toEqual(["Home", "Jobs", "Capture", "Forms"]);
  expect(within(tabBar).getByRole("link", { name: "Capture" })).toHaveAttribute("href", "/capture");
});

test("marks the current section in both places", () => {
  const { header, tabBar } = renderNav("/forms");

  for (const nav of [header, tabBar]) {
    expect(within(nav).getByRole("link", { name: "Forms" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  }
});

test.each([
  { path: "/", current: "Home" },
  { path: "/forms/0f8fad5b-d9cb-469f-a165-70867728950e", current: "Forms" },
  { path: "/captures/0f8fad5b-d9cb-469f-a165-70867728950e", current: "Capture" },
  { path: "/settings", current: "Settings" },
])("on $path the current section is $current", ({ path, current }) => {
  const { header } = renderNav(path);

  const marked = within(header)
    .getAllByRole("link")
    .filter((link) => link.getAttribute("aria-current") === "page");
  expect(marked.map((link) => link.textContent)).toEqual([current]);
});
