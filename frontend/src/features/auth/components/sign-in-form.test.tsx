import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { fail } from "@/lib/result";
import { signIn } from "../actions";
import { SignInForm } from "./sign-in-form";

vi.mock("../actions", () => ({ signIn: vi.fn() }));

async function submit(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

test("sends the email and password to the sign-in action", async () => {
  vi.mocked(signIn).mockResolvedValue(null);
  render(<SignInForm />);

  await submit("owner@example.test", "secret");

  const formData = vi.mocked(signIn).mock.calls[0][1];
  expect(formData.get("email")).toBe("owner@example.test");
  expect(formData.get("password")).toBe("secret");
});

test("shows why sign-in failed and keeps the email", async () => {
  vi.mocked(signIn).mockResolvedValue(fail("unauthorized", "Wrong email or password"));
  render(<SignInForm />);

  await submit("owner@example.test", "wrong");

  expect(await screen.findByRole("alert")).toHaveTextContent("Wrong email or password");
  expect(screen.getByLabelText("Email")).toHaveValue("owner@example.test");
  expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
});
