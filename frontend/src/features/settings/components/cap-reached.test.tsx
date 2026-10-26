import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { CapReached } from "./cap-reached";

test("says the nightly run is paused, with what was spent, once the cap is reached", () => {
  render(<CapReached cap={{ spentUsd: 50.12, capUsd: 50, reached: true }} />);

  expect(screen.getByRole("status")).toHaveTextContent("The nightly run is paused");
  expect(screen.getByText(/\$50\.12 spent of \$50\.00/)).toBeInTheDocument();
  expect(screen.getByText(/Captures and forms still work/)).toBeInTheDocument();
});

test("shows nothing under the cap", () => {
  const { container } = render(<CapReached cap={{ spentUsd: 12, capUsd: 50, reached: false }} />);

  expect(container).toBeEmptyDOMElement();
});
