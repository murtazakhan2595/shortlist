# Third-party notices

Shortlist reuses open-source code only under permissive licences (REQUIREMENTS.md, principle 6). Each reused file carries a `Ported from:` header naming its source, and each source is credited here with its licence and copyright notice.

## ai-job-search

MadsLorentzen/ai-job-search, pinned at commit `5d9e0977f01465166f25abf0826bd61e7c8cac25`. MIT License, Copyright (c) 2026 Mads Lorentzen.

| Source | Used in | What was taken |
|---|---|---|
| https://github.com/MadsLorentzen/ai-job-search/blob/5d9e0977f01465166f25abf0826bd61e7c8cac25/tools/job_key.py | `frontend/src/server/job-key.ts` | The duplicate key's slug and length cap, translated to TypeScript |
| https://github.com/MadsLorentzen/ai-job-search/blob/5d9e0977f01465166f25abf0826bd61e7c8cac25/.claude/skills/job-application-assistant/03-writing-style.md | `frontend/src/features/applications/steps/draft-checks.ts` | The banned phrases, merged with the owner's own list |
| https://github.com/MadsLorentzen/ai-job-search/blob/5d9e0977f01465166f25abf0826bd61e7c8cac25/.claude/commands/apply.md | `frontend/src/features/applications/steps/writer.ts` | The reviewer's factual grounding audit, adapted as the check prompt |
| https://github.com/MadsLorentzen/ai-job-search/blob/5d9e0977f01465166f25abf0826bd61e7c8cac25/.claude/skills/job-application-assistant/04-job-evaluation.md | `frontend/src/features/discovery/steps/score-listings.ts` | The scoring rubric: three of its dimensions with their score bands, re-weighted, and "match on the function, not the title" |

## LangGraph.js

langchain-ai/langgraphjs, `@langchain/langgraph-checkpoint-postgres` 1.1.0, pinned at commit `4510774dd362264f44efd34b29b4f5648eeb4c4c`. MIT License, Copyright (c) 2024 LangChain.

| Source | Used in | What was taken |
|---|---|---|
| https://github.com/langchain-ai/langgraphjs/blob/4510774dd362264f44efd34b29b4f5648eeb4c4c/libs/checkpoint-postgres/src/migrations.ts | `supabase/migrations/20261019020616_writer.sql` | The checkpoint tables, as a versioned migration |

## career-ops

career-ops-hq/career-ops, pinned at commit `6caf821f1b852f27a63b297484617784c47b8b2a`. MIT License, Copyright (c) 2026 Santiago Fernández de Valderrama.

| Source | Used in | What was taken |
|---|---|---|
| https://github.com/career-ops-hq/career-ops/blob/6caf821f1b852f27a63b297484617784c47b8b2a/providers/hackernews.mjs | `frontend/src/server/hacker-news.ts` | Finding the "Who is hiring?" thread by the whoishiring account and its title, and reading its posts in one Algolia request, translated to TypeScript |

An idea was also taken, with no code: `verify-cv-facts.mjs` checks that every number and tool in a draft appears in the profile, which `frontend/src/features/applications/steps/draft-checks.ts` does in its own way.

## job-board-aggregator (data)

Feashliaa/job-board-aggregator, `data/greenhouse_companies.json`, `data/lever_companies.json` and `data/ashby_companies.json`, read each night from the `main` branch. MIT License, Copyright (c) 2026 Riley Dorrington.

| Source | Used in | What was taken |
|---|---|---|
| https://github.com/Feashliaa/job-board-aggregator/tree/main/data | `frontend/src/features/discovery/steps/check-boards.ts` | The lists of company board names on Greenhouse, Lever and Ashby, as the starting list for the company watchlist. No code |

## MIT License text

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
