import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { AutoRefresh } from "./auto-refresh";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

let hidden = false;

beforeEach(() => {
  vi.useFakeTimers();
  refresh.mockClear();
  hidden = false;
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function setHidden(value: boolean) {
  hidden = value;
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

test("refreshes every two seconds while the page is visible", () => {
  render(<AutoRefresh />);

  vi.advanceTimersByTime(6_000);

  expect(refresh).toHaveBeenCalledTimes(3);
});

test("pauses while the app is in the background, and refreshes at once on return", () => {
  render(<AutoRefresh />);

  setHidden(true);
  vi.advanceTimersByTime(10_000);
  expect(refresh).not.toHaveBeenCalled();

  setHidden(false);
  expect(refresh).toHaveBeenCalledTimes(1);
});

test("gives up after three minutes, and starts again when the owner comes back", () => {
  render(<AutoRefresh />);

  vi.advanceTimersByTime(4 * 60_000);
  refresh.mockClear();
  vi.advanceTimersByTime(10_000);
  expect(refresh).not.toHaveBeenCalled();

  setHidden(true);
  setHidden(false);
  vi.advanceTimersByTime(4_000);
  expect(refresh).toHaveBeenCalledTimes(3);
});
