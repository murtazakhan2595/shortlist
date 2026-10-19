# Third-party notices

Shortlist reuses open-source code only under permissive licences (REQUIREMENTS.md, principle 6). Each reused file carries a `Ported from:` header naming its source, and each source is credited here with its licence and copyright notice.

## ai-job-search

MadsLorentzen/ai-job-search, pinned at commit `5d9e0977f01465166f25abf0826bd61e7c8cac25`. MIT License, Copyright (c) 2026 Mads Lorentzen.

| Source | Used in | What was taken |
|---|---|---|
| https://github.com/MadsLorentzen/ai-job-search/blob/5d9e0977f01465166f25abf0826bd61e7c8cac25/tools/job_key.py | `frontend/src/server/job-key.ts` | The duplicate key rules, translated to TypeScript |
| https://github.com/MadsLorentzen/ai-job-search/blob/5d9e0977f01465166f25abf0826bd61e7c8cac25/.claude/skills/job-application-assistant/03-writing-style.md | `frontend/src/features/applications/steps/banned-phrases.ts` | The banned phrases, merged with the owner's own list |
| https://github.com/MadsLorentzen/ai-job-search/blob/5d9e0977f01465166f25abf0826bd61e7c8cac25/.claude/commands/apply.md | `frontend/src/features/applications/steps/check-email.ts` | The reviewer's factual grounding audit, adapted as the check prompt |

## LangGraph.js

langchain-ai/langgraphjs, `@langchain/langgraph-checkpoint-postgres` 1.1.0, pinned at commit `4510774dd362264f44efd34b29b4f5648eeb4c4c`. MIT License, Copyright (c) 2024 LangChain.

| Source | Used in | What was taken |
|---|---|---|
| https://github.com/langchain-ai/langgraphjs/blob/4510774dd362264f44efd34b29b4f5648eeb4c4c/libs/checkpoint-postgres/src/migrations.ts | `supabase/migrations/20261019020616_writer.sql` | The checkpoint tables, as a versioned migration |

## career-ops

career-ops-hq/career-ops, pinned at commit `6caf821`. MIT License. Only an idea was taken, no code: `verify-cv-facts.mjs` checks that every number and tool in a draft appears in the profile, which `frontend/src/features/applications/steps/draft-checks.ts` does in its own way.

## MIT License text

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
