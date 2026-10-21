import { expect, test } from "vitest";
import type { HimalayasJob } from "@/server/himalayas";
import { himalayasListing, htmlToText } from "./fetch-listings";

const JOB: HimalayasJob = {
  guid: "https://himalayas.app/companies/acme/jobs/full-stack-engineer-123",
  title: " Full-Stack Engineer (Remote) ",
  companyName: "Acme",
  applicationLink: "https://himalayas.app/companies/acme/jobs/full-stack-engineer-123?utm_source=api",
  description: "<p>We build <strong>tools</strong>.</p><ul><li>React</li><li>Node &amp; Postgres</li></ul>",
  pubDate: Date.parse("2026-10-20T10:00:00Z") / 1000,
  expiryDate: Date.parse("2026-12-19T10:00:00Z") / 1000,
  employmentType: "Contractor",
  seniority: ["Mid-level", "Senior"],
  parentCategories: ["Developer"],
  locationRestrictions: ["Pakistan", "India"],
  minSalary: 40,
  maxSalary: 60,
  currency: "USD",
  salaryPeriod: "hourly",
};

test("converts a Himalayas job to the common format, keeping its link to apply and credit Himalayas", () => {
  expect(himalayasListing(JOB, "run-1")).toEqual({
    source: "himalayas",
    source_id: JOB.guid,
    url: JOB.applicationLink,
    title: "Full-Stack Engineer (Remote)",
    company: "Acme",
    location: "Pakistan, India",
    countries: ["Pakistan", "India"],
    salary_min: 40,
    salary_max: 60,
    salary_currency: "USD",
    salary_period: "hour",
    seniority: ["Mid-level", "Senior"],
    employment_type: "Contractor",
    categories: ["Developer"],
    tags: ["remote", "contractor"],
    description: "We build tools.\n\n- React\n- Node & Postgres",
    fingerprint: "acme_full-stack-engineer-remote",
    posted_at: "2026-10-20T10:00:00.000Z",
    expires_at: "2026-12-19T10:00:00.000Z",
    run_id: "run-1",
  });
});

test("a worldwide job with no pay, period or expiry stated", () => {
  const listing = himalayasListing(
    { ...JOB, locationRestrictions: [], minSalary: null, maxSalary: null, salaryPeriod: "weekly", expiryDate: null, employmentType: "Full Time" },
    "run-1",
  );

  expect(listing).toMatchObject({
    location: "Worldwide",
    countries: [],
    salary_min: null,
    salary_period: null,
    expires_at: null,
    tags: ["remote"],
  });
});

test("turns HTML into plain text, with line breaks and list items kept", () => {
  expect(htmlToText("<h2>About</h2><p>Line one<br>Line   two</p><p></p><p>It&#39;s &quot;great&quot;&nbsp;here</p>")).toBe(
    'About\nLine one\nLine two\n\nIt\'s "great" here',
  );
});
