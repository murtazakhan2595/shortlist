import "server-only";
import { z } from "zod";
import { getBoardJson } from "./board-api";

// Greenhouse's Job Board API (docs.greenhouse.io/job-board.html, read 26 October 2026): "Job Board data is
// publicly available, so authentication is not required for any GET endpoints." No rate limit is published,
// so boards are read a few at a time, and a full post only for a job worth reading.

export const GREENHOUSE_SOURCE = "greenhouse";

const API_URL = "https://boards-api.greenhouse.io/v1/boards";

const BoardJobSchema = z.object({
  id: z.number(),
  title: z.string(),
  company_name: z.string().nullish(),
  location: z.object({ name: z.string().nullish() }).nullish(),
  first_published: z.string().nullish(),
});
export type GreenhouseBoardJob = z.infer<typeof BoardJobSchema>;

const BoardSchema = z.object({ jobs: z.array(BoardJobSchema) });

const JobSchema = BoardJobSchema.extend({
  absolute_url: z.url(),
  /** HTML with its tags entity-encoded ("&lt;p&gt;"). */
  content: z.string(),
  // A location of just "Remote" can hide its region here ("Remote US").
  offices: z.array(z.object({ name: z.string() })).default([]),
});
export type GreenhouseJob = z.infer<typeof JobSchema>;

/** A board's open jobs, titles and locations only. Null when the board no longer exists. */
export async function fetchGreenhouseBoard(slug: string): Promise<GreenhouseBoardJob[] | null> {
  const board = await getBoardJson(`${API_URL}/${encodeURIComponent(slug)}/jobs`, "Greenhouse");
  return board === null ? null : BoardSchema.parse(board).jobs;
}

/** One job with its full post. Null when it has closed since its board was read. */
export async function fetchGreenhouseJob(slug: string, jobId: number): Promise<GreenhouseJob | null> {
  const job = await getBoardJson(`${API_URL}/${encodeURIComponent(slug)}/jobs/${jobId}`, "Greenhouse");
  return job === null ? null : JobSchema.parse(job);
}

const QuestionSchema = z.object({
  label: z.string(),
  required: z.boolean().default(false),
  /** HTML, or null. */
  description: z.string().nullish(),
  fields: z.array(
    z.object({
      /** "input_text", "textarea", "input_file", "multi_value_single_select" and others. */
      type: z.string(),
      values: z.array(z.object({ label: z.string() })).default([]),
    }),
  ),
});
export type GreenhouseQuestion = z.infer<typeof QuestionSchema>;

// The voluntary diversity questions (compliance, demographic_questions) are left out.
const QuestionsSchema = z.object({ questions: z.array(QuestionSchema).default([]) });

/** The questions a job's application form asks, as Greenhouse publishes them. Null when the job has closed. */
export async function fetchGreenhouseQuestions(slug: string, jobId: string): Promise<GreenhouseQuestion[] | null> {
  const job = await getBoardJson(`${API_URL}/${encodeURIComponent(slug)}/jobs/${encodeURIComponent(jobId)}?questions=true`, "Greenhouse");
  return job === null ? null : QuestionsSchema.parse(job).questions;
}

// A listing keeps its board with the job's id ("acme/7"): the questions are read from the board, and a job's
// own link can be on the company's site.
export function greenhouseSourceId(slug: string, jobId: number): string {
  return `${slug}/${jobId}`;
}

export function parseGreenhouseSourceId(sourceId: string): { slug: string; jobId: string } | null {
  const match = /^([^/]+)\/(\d+)$/.exec(sourceId);
  return match ? { slug: match[1], jobId: match[2] } : null;
}
