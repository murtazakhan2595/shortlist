import { describe, expect, test } from "vitest";
import type { Listing } from "../schemas";
import { eligibilityOf, minimumYearsRequired, monthlyPayUsd } from "./eligibility";

const SETTINGS = { payFloorUsdMonth: 3000, excludedCountries: ["India"], blockedCompanies: ["micro1", "KDCI"] };

const LISTING: Listing = {
  source: "himalayas",
  source_id: "job-1",
  url: "https://himalayas.app/companies/acme/jobs/job-1",
  title: "Full Stack Engineer",
  company: "Acme",
  location: "Worldwide",
  countries: [],
  salary_min: null,
  salary_max: null,
  salary_currency: null,
  salary_period: null,
  seniority: ["Mid-level"],
  employment_type: "Full Time",
  categories: ["Developer"],
  tags: ["remote"],
  description: "Build our web app with React and Node.",
  fingerprint: "acme_full-stack-engineer",
  posted_at: null,
  expires_at: null,
  run_id: null,
  contact_email: null,
};

function decide(changes: Partial<Listing>) {
  return eligibilityOf({ ...LISTING, ...changes }, SETTINGS);
}

test("a mid-level developer job open worldwide is eligible", () => {
  expect(decide({})).toEqual({ eligibility: "eligible", eligibility_reason: null });
});

describe("drops what clearly does not fit", () => {
  test.each([
    [{ company: "KDCI" }, "A company you blocked"],
    [{ company: "kdci." }, "A company you blocked"],
    [{ company: "Micro1" }, "A company you blocked"],
    [{ title: "Account Manager", categories: ["Sales", "Customer Service"] }, "Not a technical role"],
    [{ title: "Lead Software Engineer" }, "Above the seniority range"],
    [{ title: "Staff Engineer" }, "Above the seniority range"],
    [{ title: "Engineering Manager", seniority: ["Manager"] }, "Above the seniority range"],
    [{ description: "You have 7+ years of professional software experience." }, "Asks for 7+ years"],
    [{ salary_max: 1500, salary_currency: "USD", salary_period: "month" }, "below the floor"],
    [{ salary_max: 10, salary_currency: "USD", salary_period: "hour" }, "below the floor"],
    [{ description: "An active Secret security clearance is required." }, "security clearance or citizenship"],
    [{ description: "You must be a U.S. citizen." }, "security clearance or citizenship"],
    [{ countries: ["India"] }, "Open only to India"],
    [{ description: "We are a startup based in India, building fintech." }, "based in India"],
  ])("%o", (changes, reason) => {
    const decided = decide(changes);
    expect(decided.eligibility).toBe("excluded");
    expect(decided.eligibility_reason).toContain(reason);
  });
});

describe("keeps a listing when in doubt", () => {
  test.each([
    ["a company whose name only contains a blocked one", { company: "Microsoft" }],
    ["a technical title in a non-technical category", { title: "DevOps Engineer", categories: ["Operations"] }],
    ["an AI role filed under Product", { title: "AI Product Engineer", categories: ["Product"] }],
    ["no category at all", { title: "Specialist", categories: [] }],
    ["a mix of categories with one technical", { title: "Growth Hacker", categories: ["Marketing", "Developer"] }],
    ["five years asked", { description: "5+ years of experience with React." }],
    ["one requirement in range among several", { description: "6+ years of backend experience and 2+ years of React experience." }],
    ["the company's age, not the job's", { description: "We have been in business for 10 years in Lahore." }],
    ["pay at the floor", { salary_max: 3000, salary_currency: "USD", salary_period: "month" }],
    ["pay in an unknown currency", { salary_max: 100_000, salary_currency: "PKR", salary_period: "month" }],
    ["open to India and Pakistan", { countries: ["India", "Pakistan"] }],
  ])("%s", (_, changes) => {
    expect(decide(changes).eligibility).not.toBe("excluded");
  });
});

describe("flags doubts, ranked lower", () => {
  test.each([
    [{ description: "You must be authorized to work in the United States." }, "work authorisation"],
    [{ description: "We cannot sponsor visas." }, "work authorisation"],
    [{ seniority: ["Entry-level"] }, "entry level"],
    [{ countries: ["Asia"] }, "Lists Asia, not Pakistan"],
  ])("%o", (changes, doubt) => {
    const decided = decide(changes);
    expect(decided.eligibility).toBe("unclear");
    expect(decided.eligibility_reason).toContain(doubt);
  });
});

test("an excluded country with brackets or dots in its name is matched as written", () => {
  const settings = { ...SETTINGS, excludedCountries: ["Congo (DRC)", "St. Kitts [and Nevis"] };

  expect(eligibilityOf({ ...LISTING, description: "We are based in Congo (DRC), hiring now." }, settings)).toEqual({
    eligibility: "excluded",
    eligibility_reason: "The employer is based in Congo (DRC)",
  });
  expect(eligibilityOf({ ...LISTING, description: "We are based in Congo xDRCx." }, settings).eligibility).toBe("eligible");
  expect(eligibilityOf({ ...LISTING, description: "Located in St. Kitts [and Nevis." }, settings).eligibility).toBe("excluded");
});

test("reads the years of experience asked for", () => {
  expect(minimumYearsRequired("3-5 years of experience")).toBe(3);
  expect(minimumYearsRequired("7 years' experience in Python")).toBe(7);
  expect(minimumYearsRequired("10+ years of hands-on backend engineering experience")).toBe(10);
  expect(minimumYearsRequired("Founded 12 years ago")).toBeNull();
});

test("converts stated pay to US dollars a month", () => {
  expect(monthlyPayUsd({ ...LISTING, salary_min: 60_000, salary_max: 72_000, salary_currency: "USD", salary_period: "year" })).toBe(6000);
  expect(monthlyPayUsd({ ...LISTING, salary_max: 20, salary_currency: "USD", salary_period: "hour" })).toBe(3200);
  expect(monthlyPayUsd({ ...LISTING, salary_max: 3000, salary_currency: "EUR", salary_period: "month" })).toBeCloseTo(3300);
  expect(monthlyPayUsd(LISTING)).toBeNull();
});

test("a title naming several roles is dropped only when every one is above the range", () => {
  expect(decide({ title: "Staff Engineer, Senior Engineer" }).eligibility).toBe("eligible");
  expect(decide({ title: "Staff and Principal Engineers" }).eligibility_reason).toMatch("Above the seniority range");
});

describe("a Hacker News post: kept when it can be done from Pakistan", () => {
  // The first line of the description is the post's own first line.
  function decidePost(description: string) {
    return decide({ source: "hackernews", countries: [], seniority: [], categories: [], location: null, description });
  }

  test.each([
    "Acme | Engineer | REMOTE (Worldwide)\n\nDetails",
    "Acme | Engineer | Remote (Global)",
    "Acme | Engineer | REMOTE (EMEA/APAC)",
    "Acme | Engineer | Remote, anywhere in the world",
    // An employer that sponsors a visa or helps with relocation is open to the owner (Q4).
    "Acme | Engineer | ONSITE in London | Visa sponsorship",
    "Acme | Engineer | Berlin | HYBRID\n\nWe offer relocation support.",
  ])("eligible: %s", (description) => {
    expect(decidePost(description)).toEqual({ eligibility: "eligible", eligibility_reason: null });
  });

  test.each([
    ["Acme | Engineer | San Francisco | ONSITE", "On-site or hybrid, with no visa sponsorship"],
    ["Acme | Engineer | NYC | HYBRID\n\nWe don’t offer visa sponsorship.", "On-site or hybrid, with no visa sponsorship"],
    ["Acme | Engineer | Remote, but not remote for this role: no remote", "On-site or hybrid, with no visa sponsorship"],
    ["Acme | Engineer | REMOTE (US Timezones)", "Remote only within a region that leaves out Pakistan"],
    ["Acme | Engineer | Remote (Germany)", "Remote only within a region that leaves out Pakistan"],
    ["Acme | Engineer | REMOTE [Europe / GMT+2]", "Remote only within a region that leaves out Pakistan"],
    ["Acme | Engineer | Remote US or Ontario, Canada", "Remote only within a region that leaves out Pakistan"],
    ["Acme | Engineer | US-based remote", "Remote only within a region that leaves out Pakistan"],
    // The first line decides: "worldwide" in the body is about the members, not the job.
    ["Acme | Engineer | Remote (North America / LatAm)\n\nOur members are worldwide.", "Remote only within a region that leaves out Pakistan"],
    // A visa that is ruled out does not count as offered.
    ["Acme | Engineer | Remote (US)\n\nWe are not able to sponsor visas.", "Remote only within a region that leaves out Pakistan"],
  ])("excluded: %s", (description, reason) => {
    expect(decidePost(description)).toEqual({ eligibility: "excluded", eligibility_reason: reason });
  });

  test.each([
    "Acme | Engineer | REMOTE | Full-time",
    "Acme | Engineer | NYC or Remote",
    // A preference is not a limit.
    "Acme | Engineer | REMOTE (CET ±3 preferred)",
    // "us" the word is not the country.
    "Acme | Engineer | Remote\n\nJoin us remote-first folks.",
  ])("unclear: %s", (description) => {
    expect(decidePost(description)).toEqual({ eligibility: "unclear", eligibility_reason: "Remote, but it does not say from where" });
  });

  test("the first line's silence lets the body decide", () => {
    expect(decidePost("Acme | Engineer | Remote\n\nThis role is open worldwide.").eligibility).toBe("eligible");
    expect(decidePost("Acme | Engineer | Remote\n\nUS only, sorry.").eligibility).toBe("excluded");
  });

  test("a Himalayas listing is not judged by these words: Himalayas already lists jobs open to Pakistan", () => {
    expect(decide({ description: "Work from our office in San Francisco." }).eligibility).toBe("eligible");
  });
});
