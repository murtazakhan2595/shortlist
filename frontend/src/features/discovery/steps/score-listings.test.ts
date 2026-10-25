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

test("keeps each source's best listings by score up to the daily target, unscored and weak ones never", () => {
  const listings = [
    { id: "hn-90", source: "hackernews", company: "Company hn-90", score: 90 },
    { id: "him-60", source: "himalayas", company: "Company him-60", score: 60 },
    { id: "him-80", source: "himalayas", company: "Company him-80", score: 80 },
    { id: "him-weak", source: "himalayas", company: "Company him-weak", score: MIN_SCORE_TO_KEEP - 1 },
    { id: "him-at-line", source: "himalayas", company: "Company him-at-line", score: MIN_SCORE_TO_KEEP },
    { id: "hn-unscored", source: "hackernews", company: "Company hn-unscored", score: null },
  ];

  expect(topListings(listings, 20)).toEqual([
    { id: "hn-90", rank: 1 },
    { id: "him-80", rank: 1 },
    { id: "him-60", rank: 2 },
    { id: "him-at-line", rank: 3 },
  ]);
  // The target counts per source: a strong source does not take another's places.
  expect(topListings(listings, 1)).toEqual([
    { id: "hn-90", rank: 1 },
    { id: "him-80", rank: 1 },
  ]);
});

test(`keeps at most ${MAX_LISTINGS_PER_COMPANY} listings from one company, its best ones, and fills the list from others`, () => {
  const listings = [
    { id: "kdci-90", source: "himalayas", company: "KDCI", score: 90 },
    { id: "kdci-85", source: "himalayas", company: "kdci.", score: 85 },
    { id: "kdci-80", source: "himalayas", company: "KDCI", score: 80 },
    { id: "acme-70", source: "himalayas", company: "Acme", score: 70 },
  ];

  expect(topListings(listings, 3).map(({ id }) => id)).toEqual(["kdci-90", "kdci-85", "acme-70"]);
});
