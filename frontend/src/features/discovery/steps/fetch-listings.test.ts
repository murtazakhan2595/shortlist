import { describe, expect, test } from "vitest";
import type { HackerNewsPost } from "@/server/hacker-news";
import type { HimalayasJob } from "@/server/himalayas";
import { contactEmailIn, hackerNewsListing, himalayasListing } from "./fetch-listings";

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
    contact_email: null,
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



describe("a Hacker News post in the common format", () => {
  const POST: HackerNewsPost = {
    id: 49922600,
    created_at_i: Date.parse("2026-10-01T16:00:00Z") / 1000,
    text:
      'Acme (YC S21) | Senior Full-Stack Engineer | REMOTE (Worldwide) | Contract | <a href="https:&#x2F;&#x2F;acme.com&#x2F;jobs" rel="nofollow">https:&#x2F;&#x2F;acme.com&#x2F;j...</a>' +
      "<p>We build tools with React &amp; Node.<p>Apply at jobs@acme.com",
  };

  test("takes the company, role and place from the first line, and keeps the whole post", () => {
    expect(hackerNewsListing(POST, "run-1")).toEqual({
      source: "hackernews",
      source_id: "49922600",
      url: "https://news.ycombinator.com/item?id=49922600",
      title: "Senior Full-Stack Engineer",
      company: "Acme",
      location: "REMOTE (Worldwide) | Contract",
      countries: [],
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      salary_period: null,
      seniority: [],
      employment_type: null,
      categories: [],
      tags: ["remote", "contractor"],
      description:
        "Acme (YC S21) | Senior Full-Stack Engineer | REMOTE (Worldwide) | Contract | https://acme.com/jobs\n\nWe build tools with React & Node.\n\nApply at jobs@acme.com",
      fingerprint: "acme_senior-full-stack-engineer",
      posted_at: "2026-10-01T16:00:00.000Z",
      expires_at: "2026-11-15T16:00:00.000Z",
      run_id: "run-1",
      contact_email: "jobs@acme.com",
    });
  });

  test("finds the role wherever it is, and reads dashes as separators", () => {
    const listing = hackerNewsListing({ ...POST, text: "Beta Labs — NYC or Remote — Backend Developer<p>Details" }, "run-1");

    expect(listing).toMatchObject({ company: "Beta Labs", title: "Backend Developer", location: "NYC or Remote" });
  });

  test("a first line with no separator is the title, and the post gets its own company key", () => {
    const listing = hackerNewsListing({ ...POST, text: "We are hiring engineers to work on compilers.<p>More" }, "run-1");

    expect(listing).toMatchObject({
      company: "Hacker News post 49922600",
      title: "We are hiring engineers to work on compilers.",
      location: null,
      tags: [],
    });
  });

  test("tags a post that offers visa sponsorship", () => {
    const listing = hackerNewsListing({ ...POST, text: "Gamma | Engineer | London | ONSITE<p>Visa sponsorship available." }, "run-1");

    expect(listing.tags).toEqual(["visa"]);
  });
});

describe("the email address a post gives", () => {
  test.each([
    ["Apply at jobs@acme.com.", "jobs@acme.com"],
    ["Email Jane.Doe+hn@Acme.co.uk with your CV", "jane.doe+hn@acme.co.uk"],
    ["resumes [at] voladynamics [dot] com", "resumes@voladynamics.com"],
    ["hiring (at) beta (dot) io, or see the site", "hiring@beta.io"],
    ["jobs [at] acme.com", "jobs@acme.com"],
    // The first address in the post wins, written either way.
    ["Write to first [at] acme [dot] com, or second@acme.com", "first@acme.com"],
    ["Write to first@acme.com, or second [at] acme [dot] com", "first@acme.com"],
  ])("%s", (text, email) => {
    expect(contactEmailIn(text)).toBe(email);
  });

  test.each([
    "Apply on our site: https://acme.com/jobs",
    // Too easily a sentence: "engineers at acme dot com" is left out.
    "Our engineers at acme dot com build tools",
  ])("none in: %s", (text) => {
    expect(contactEmailIn(text)).toBeNull();
  });
});
