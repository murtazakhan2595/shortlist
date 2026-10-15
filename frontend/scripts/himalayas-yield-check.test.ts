import { describe, expect, test } from "vitest";
import { buildReport, dropReason, type FilterSettings, type Job, monthlyPayUsd } from "./himalayas-yield-check";

const settings: FilterSettings = { payFloorUsdMonth: 2_500, excludedCountries: ["India"] };

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
  test("keeps a senior software role with no stated pay", () => {
    expect(dropReason(job(), settings)).toBeNull();
  });

  test("keeps technical roles whatever their title or category", () => {
    expect(dropReason(job({ title: "Software Development Manager", seniority: [] }), settings)).toBeNull();
    expect(dropReason(job({ title: "Research Scientist", parentCategories: ["Data Science"] }), settings)).toBeNull();
    expect(dropReason(job({ title: "Claims Specialist", parentCategories: [] }), settings)).toBeNull();
  });

  test("drops a role in a non-technical category", () => {
    expect(dropReason(job({ title: "Account Executive", parentCategories: ["Sales"] }), settings)).toBe(
      "not a technical role",
    );
  });

  test("keeps a technical title in a non-technical category", () => {
    expect(dropReason(job({ title: "DevOps Engineer", parentCategories: ["Operations"] }), settings)).toBeNull();
  });

  test("keeps entry-level and unlabelled roles", () => {
    expect(dropReason(job({ seniority: ["Entry-level"] }), settings)).toBeNull();
    expect(dropReason(job({ seniority: [] }), settings)).toBeNull();
  });

  test("drops roles labelled only above the range", () => {
    expect(dropReason(job({ seniority: ["Director"] }), settings)).toBe("seniority above range");
  });

  test("drops lead, staff and principal roles by title (Q2)", () => {
    expect(dropReason(job({ title: "Staff Software Engineer" }), settings)).toBe("seniority above range");
  });

  test("drops stated pay below the floor from settings", () => {
    const annual = (maxSalary: number) => job({ maxSalary, salaryPeriod: "annual", currency: "USD" });

    expect(dropReason(annual(24_000), settings)).toBe("pay below floor");
    expect(dropReason(annual(24_000), { ...settings, payFloorUsdMonth: 1_500 })).toBeNull();
  });

  test("drops a clearance requirement", () => {
    expect(dropReason(job({ description: "Active security clearance needed." }), settings)).toBe(
      "clearance or citizenship required",
    );
  });

  test("drops a job only for candidates in an excluded country", () => {
    expect(dropReason(job({ locationRestrictions: ["India"] }), settings)).toBe("excluded country");
    expect(dropReason(job({ locationRestrictions: ["India", "Pakistan"] }), settings)).toBeNull();
  });
});

describe("buildReport", () => {
  test("counts eligible jobs by category and the reason each other job was dropped", () => {
    const report = buildReport(
      [
        job(),
        job({ locationRestrictions: ["Pakistan"], parentCategories: ["Data Science"] }),
        job({ title: "Recruiter", parentCategories: ["Human Resources"] }),
      ],
      settings,
      new Date("2026-10-15T01:30:00Z"),
    );

    expect(report).toMatchObject({
      date: "2026-10-15",
      newJobsOpenToPakistan: 3,
      worldwide: 2,
      listingPakistan: 1,
      dropped: { "not a technical role": 1 },
      eligible: 2,
      eligibleByCategory: { Developer: 1, "Data Science": 1 },
    });
  });
});
