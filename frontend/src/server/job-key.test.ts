import { expect, test } from "vitest";
import { jobKey, slugify } from "./job-key";

test("makes a lowercase ASCII key from company and title", () => {
  expect(jobKey("Acme Corp, LLC", "Senior Full-Stack Engineer (Remote)")).toBe(
    "acme-corp-llc_senior-full-stack-engineer-remote",
  );
});

test("gives the same job the same key however its name is written", () => {
  expect(jobKey("ACME corp", "Full Stack  Engineer")).toBe(jobKey("Acme Corp", "Full-Stack Engineer"));
});

test("removes characters that would break a key, such as slashes", () => {
  expect(jobKey("Deloitte", "Penetration Tester / Red Teamer")).toBe("deloitte_penetration-tester-red-teamer");
});

test("caps a long title with a hash of the whole title, so two long titles never collide", () => {
  const first = jobKey("Acme", `Cyber Intelligence Center Security Analyst ${"x".repeat(40)} one`);
  const second = jobKey("Acme", `Cyber Intelligence Center Security Analyst ${"x".repeat(40)} two`);

  expect(first.split("_")[1].length).toBeLessThanOrEqual(60 + 7);
  expect(first).not.toBe(second);
  expect(jobKey("Acme", `Cyber Intelligence Center Security Analyst ${"x".repeat(40)} one`)).toBe(first);
});

test("keeps non-Latin company names apart with a hash", () => {
  expect(jobKey("Сбер AI", "Engineer")).not.toBe(jobKey("Яндекс AI", "Engineer"));
});

test("keys a non-Latin title on the listing's numeric id", () => {
  expect(jobKey("Acme", "Программист 1С", "https://jobs.example/vacancy/12345678")).toBe("acme_1-12345678");
});

test("an unknown company stays unknown", () => {
  expect(jobKey("", "Engineer")).toBe("unknown-company_engineer");
});

test("slugify keeps Latin letters with accents and drops the rest", () => {
  expect(slugify("Zürich Café")).toBe("zurich-cafe");
  expect(slugify("Программист")).toBe("");
});
