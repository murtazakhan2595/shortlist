import { expect, test } from "vitest";
import { MAX_LISTINGS_PER_COMPANY, MIN_SCORE_TO_KEEP, overallScore, reasonsText, topListings } from "./score-listings";

test("the overall score weighs technical skills, experience and career alignment", () => {
  expect(overallScore({ technical: 80, experience: 60, careerAlignment: 100 })).toBe(81);
  // A rating outside 0 to 100 is held inside it.
  expect(overallScore({ technical: 150, experience: -20, careerAlignment: 100 })).toBe(70);
});

test("the reasons list up to three strengths and gaps", () => {
  expect(reasonsText({ strengths: [" React and Node ", "Built an AI product"], gaps: ["No Go", "No Kubernetes", "No Rust", "No Elixir"] })).toBe(
    "Strengths:\n- React and Node\n- Built an AI product\nGaps:\n- No Go\n- No Kubernetes\n- No Rust",
  );
  expect(reasonsText({ strengths: ["React"], gaps: [] })).toBe("Strengths:\n- React");
});

test("keeps the best listings up to the daily target: eligible before unclear, unscored and weak ones never", () => {
  const listings = [
    { id: "unclear-90", company: "Company unclear-90", eligibility: "unclear", score: 90 },
    { id: "eligible-60", company: "Company eligible-60", eligibility: "eligible", score: 60 },
    { id: "eligible-80", company: "Company eligible-80", eligibility: "eligible", score: 80 },
    { id: "eligible-weak", company: "Company eligible-weak", eligibility: "eligible", score: MIN_SCORE_TO_KEEP - 1 },
    { id: "eligible-at-line", company: "Company eligible-at-line", eligibility: "eligible", score: MIN_SCORE_TO_KEEP },
    { id: "unscored", company: "Company unscored", eligibility: "eligible", score: null },
  ];

  expect(topListings(listings, 20)).toEqual(["eligible-80", "eligible-60", "eligible-at-line", "unclear-90"]);
  expect(topListings(listings, 2)).toEqual(["eligible-80", "eligible-60"]);
});

test(`keeps at most ${MAX_LISTINGS_PER_COMPANY} listings from one company, its best ones, and fills the list from others`, () => {
  const listings = [
    { id: "kdci-90", company: "KDCI", eligibility: "eligible", score: 90 },
    { id: "kdci-85", company: "kdci.", eligibility: "eligible", score: 85 },
    { id: "kdci-80", company: "KDCI", eligibility: "eligible", score: 80 },
    { id: "acme-70", company: "Acme", eligibility: "eligible", score: 70 },
  ];

  expect(topListings(listings, 3)).toEqual(["kdci-90", "kdci-85", "acme-70"]);
});

