import { expect, test } from "vitest";
import { jobKey, slugify } from "./job-key";

test("makes a lowercase ASCII key from company and title", () => {
  expect(jobKey("Acme Corp, LLC", "Senior Full-Stack Engineer (Remote)")).toBe("acme-corp-llc_senior-full-stack-engineer-remote");
});

test("gives the same job the same key however its name is written", () => {
  expect(jobKey("ACME corp", "Full Stack  Engineer")).toBe(jobKey("Acme Corp", "Full-Stack Engineer"));
});

test("keys a capture on its contact email and role", () => {
  expect(jobKey("careers@acme.example", "Full Stack Developer")).toBe("careers-acme-example_full-stack-developer");
});

test("caps a long title with a hash of the whole title, so two long titles never collide", () => {
  const long = (ending: string) => `Cyber Intelligence Center Security Analyst ${"x".repeat(40)} ${ending}`;

  expect(jobKey("Acme", long("one"))).not.toBe(jobKey("Acme", long("two")));
  expect(jobKey("Acme", long("one"))).toBe(jobKey("Acme", long("one")));
  expect(jobKey("Acme", long("one")).split("_")[1].length).toBeLessThanOrEqual(67);
});

test("names that are missing still give a key", () => {
  expect(jobKey("", "")).toBe("unknown_untitled");
});

test("slugify keeps Latin letters with accents and drops other characters", () => {
  expect(slugify("Zürich Café / Remote")).toBe("zurich-cafe-remote");
});
