import { describe, expect, test } from "vitest";
import { buildReport, dropReason, type Job, monthlyPayUsd } from "./himalayas-yield-check";

function job(overrides: Partial<Job> = {}): Job {
  return {
    title: "Senior Full Stack Engineer",
    companyName: "Acme",
    guid: "https://himalayas.app/companies/acme/jobs/1",
    pubDate: 0,
    seniority: ["Senior"],
    parentCategories: ["Developer"],
    locationRestrictions: [],
    minSalary: null,
    maxSalary: null,
    salaryPeriod: null,
    currency: null,
    description: "",
    ...overrides,
  };
}

describe("monthlyPayUsd", () => {
  test("converts annual pay to a month", () => {
    expect(monthlyPayUsd(job({ maxSalary: 60_000, salaryPeriod: "annual", currency: "USD" }))).toBe(5_000);
  });

  test("converts hourly pay at 160 hours a month", () => {
    expect(monthlyPayUsd(job({ maxSalary: 20, salaryPeriod: "hourly", currency: "USD" }))).toBe(3_200);
  });

  test("is null when no pay is stated", () => {
    expect(monthlyPayUsd(job())).toBeNull();
  });

  test("is null for a currency without a known rate", () => {
    expect(monthlyPayUsd(job({ maxSalary: 900_000, salaryPeriod: "annual", currency: "INR" }))).toBeNull();
  });
});

describe("dropReason", () => {
  test("keeps a mid-level or senior software role with no stated pay", () => {
    expect(dropReason(job())).toBeNull();
  });

  test("keeps an AI engineer listed under Data Science", () => {
    expect(dropReason(job({ title: "AI Engineer", parentCategories: ["Data Science"] }))).toBeNull();
  });

  test("drops a role outside software", () => {
    expect(dropReason(job({ title: "Account Executive", parentCategories: ["Sales"] }))).toBe("not a software role");
  });

  test("drops entry-level roles", () => {
    expect(dropReason(job({ seniority: ["Entry-level"] }))).toBe("seniority out of range");
  });

  test("drops lead, staff and principal roles by title", () => {
    expect(dropReason(job({ title: "Staff Software Engineer" }))).toBe("seniority out of range");
  });

  test("keeps a role whose seniority is not stated", () => {
    expect(dropReason(job({ seniority: [] }))).toBeNull();
  });

  test("drops stated pay below the floor", () => {
    expect(dropReason(job({ maxSalary: 24_000, salaryPeriod: "annual", currency: "USD" }))).toBe("pay below floor");
  });

  test("drops a clearance requirement", () => {
    expect(dropReason(job({ description: "Active security clearance needed." }))).toBe(
      "clearance or citizenship required",
    );
  });

  test("drops a job based in India", () => {
    expect(dropReason(job({ description: "This role is based in India." }))).toBe("excluded country");
  });
});

describe("buildReport", () => {
  test("counts eligible jobs and the reason each other job was dropped", () => {
    const report = buildReport(
      [
        job(),
        job({ locationRestrictions: ["Pakistan"] }),
        job({ title: "Recruiter", parentCategories: ["Human Resources"] }),
      ],
      new Date("2026-10-15T01:30:00Z"),
    );

    expect(report).toMatchObject({
      date: "2026-10-15",
      newJobsOpenToPakistan: 3,
      worldwide: 2,
      listingPakistan: 1,
      dropped: { "not a software role": 1 },
      eligible: 2,
    });
  });
});
