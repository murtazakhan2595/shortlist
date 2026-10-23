# Shortlist: Build Plan

Version 2.8, 22 October 2026. Agreed plan. Sprints 0 to 5 are done; sections 2, 3, 5, 8 and 9 describe what sprint 1 actually built. Sprints 3, 4 and 5 record what they built under their tables.

This document says **how** Shortlist gets built. **What** is being built, and how success is judged, is in [REQUIREMENTS.md](REQUIREMENTS.md). Requirement IDs (C1, D3, F4, E2 and so on) refer to that file.

## 1. How the work is organised

The build is done by coding agents working in parallel, with the owner directing and reviewing.

- **Sprints are defined by outcome.** Each has a goal, a list of work items and an exit check. A sprint is finished when its exit check passes.
- **Each work item is one agent task.** It has an ID, a "done when" test, and a track letter.
- **Tracks show what can run in parallel.** Items in different tracks of the same sprint do not depend on each other. Items in the same track run in order.
- **Contracts are fixed first.** The database tables, the server routes and the model module's interface are set in sprint 1. Agents build against them; only the owner changes them.
- **Every item ends with passing tests.** The owner reviews and merges.
- **The owner decides anything that touches the principles** in REQUIREMENTS.md section 4.

The owner should be able to explain every design decision. Owning the contracts and the reviews is how that stays true while agents write the code.

## 2. How it works

Everything is one Next.js application, with its data, queue, schedule and triggers in Supabase Postgres. The host only has to serve the pages and answer short HTTPS calls, so it can be swapped (section 3).

All work is done as a chain of short steps. Each step is one job on the queue and one short call to a worker route. A step does at most one model call, saves its result, and puts the next step on the queue.

**Capture path** (on demand, result within one minute):

1. The owner shares a screenshot or pastes a post into the app. Screenshots upload straight from the browser to Supabase Storage.
2. A Server Action saves the capture and puts the first step on the queue. Queuing a step makes the database call the worker route at once, so nothing waits for the next scheduled tick.
3. Step "extract": the role, the company, and either a contact email or a form link.
4. With an email, steps "write", "check" and, if the check fails, "revise": the email is written and fact-checked. Then ordinary code creates the Gmail draft with the chosen CV attached.
5. With a form link: the app asks the owner for full-page screenshots of the form. Steps list the questions and answer them from the profile and the answer bank. Anything that cannot be answered is marked for the owner.

**Discovery path** (once a day, overnight):

1. Supabase's scheduler calls a database function that records the run and queues its first step. There is no route for it (owner's decision, 21 October 2026): as a queued step, a failed fetch is retried.
2. That step fetches new listings, converts them to one format, decides which clearly exclude the owner, saves the new ones once each (excluded ones too, so the filter can be checked), and deletes expired ones.
3. The worker route runs one step per call. While steps are waiting it asks the database to call it again, and the scheduler also calls it every minute in case a call is missed. This repeats until the queue is empty.
4. The top N listings each get a chosen CV and a short tailored note, by the same steps as a capture.

Both paths end in the same place: an entry in the review app.

## 3. Technical decisions

| Area | Choice | Reason |
|---|---|---|
| Language | TypeScript throughout | The owner's strongest language; one codebase to review and explain |
| Application | Next.js: pages and server routes in one project, installable on Android so it appears in the share menu | Meets C2 |
| Host | Vercel's free plan to start; movable to AWS Amplify | Free at this size; see the portability rules below |
| Overall shape | A workflow: code decides the steps and calls models along the way. No step is given open-ended control | Predictable, testable, and the rule the owner's own playbook sets |
| Agent framework | LangGraph (its TypeScript version), for the write-check-revise loop, with the loop's state saved in Postgres between steps | The framework most asked for in AI roles; saved state is what lets each step be a short call |
| Model access | One module that every model call goes through, built on LangChain's model classes; provider, model and reasoning effort per step come from configuration | Meets B3, makes B1 automatic, and adds no dependency beyond LangGraph's own family |
| Model outputs | A typed schema (Zod) for every extraction, score and check | Rules live in the field descriptions and bad output fails loudly |
| Database | Postgres on Supabase | Free tier, familiar SQL, always awake |
| Files | Supabase Storage, for CVs, screenshots and raw listings | Uploads go from the browser, past any host's request size limit |
| Sign-in | Supabase Auth, one allowed account only | Meets U6 |
| Queue | Supabase Queues, in Postgres | Retries without a separate service |
| Schedule and triggers | Supabase Cron and database triggers, calling protected routes on the app | Scheduling does not depend on the host |
| Secrets | Plain environment variables for the app; Supabase Vault for the app's address, the worker's secret and the Gmail token | Every host supports environment variables; never in the repository |
| Delivery | GitHub Actions run tests on every push and apply database migrations; the host builds and publishes on merge | |
| Gmail | Gmail API, `gmail.compose` permission, one-time consent by the owner | The narrowest permission that can create drafts |

**Portability rules.** These keep a move to AWS Amplify, or any other host, a matter of configuration:

1. **Nothing from the host's own toolkit.** No Vercel packages, no Vercel scheduler, storage, key-value store or gateway, and nothing that needs a `vercel.json` file to work.
2. **Standard Next.js only, on the Node runtime.** No edge routes and no on-demand page revalidation, because Amplify supports neither.
3. **No work continues after a response is sent.** Background work is always a queued step, triggered from Supabase.
4. **Every server call is short.** One step per call, with a budget of 60 seconds, raised from 25 on 20 October 2026 because reading a full-page form screenshot took 22 seconds. Vercel allows 300 seconds. Amplify allows 30 (owner, 20 October 2026), so a move there means lowering the budget and splitting slow steps.
5. **Requests and responses stay small.** Under 4.5 MB, the lower of the two hosts' limits.
6. **The app's address is a setting.** The scheduler and triggers read the address they call from one place.

Moving host then means: connect the repository to the new host, copy the environment variables, and change the one address setting in Supabase.

**What this choice gives up.** Earlier versions of this plan ran a Python pipeline on AWS. The project itself now shows neither Python nor an AWS deployment. Job posts for AI engineers mostly ask for Python, so that evidence has to come from the course repositories and interview preparation. The gain is one language, one deployment and no hosting cost, and a project that fits the owner's first-priority role, full-stack with AI.

Two rules for the code (the full set is in `AGENTS.md`, section "Architecture"):

- **All data goes through server code.** Pages read through each feature's data layer and write through Server Actions, both of which first check that the owner is signed in. The browser never queries the database; files are uploaded to one-time signed upload URLs that the server creates. Access rules in the database allow only the owner, as a second line of defence.
- **The database key that bypasses access rules** is used only in server code and never reaches the browser.

## 4. Models

Checked on 13 October 2026. Prices are from each provider's own pricing page, in USD per million tokens. Benchmark figures are from Artificial Analysis: its Intelligence Index (version 4.3.2, a composite of ten evaluations, higher is better) and its cost to run one benchmark task, which reflects how many tokens a model actually uses.

Reasoning effort is a setting on each model, and it moves the score, the cost and the response time as much as the choice of model does.

**Lower-priced models**

| Model | Price in / out | Effort | Index | Cost per task | Response time |
|---|---|---|---|---|---|
| OpenAI `gpt-6-luna` | 0.10 / 0.50 | low | 22 | $0.0045 | 7 s |
| | | medium | 30 | $0.02 | |
| | | high | 33 | $0.03 | 23 s |
| DeepSeek `deepseek-flash` | 0.15 to 0.30 / 0.60 to 1.20 | none | 25 | $0.15 | 4 s |
| | | max | 39 | $0.27 | 14 s |
| Google `gemini-3.5-flash-lite` | 0.30 / 2.50 | | 22 | $0.19 | 9 s |
| Google `gemini-2.5-flash-lite` | 0.10 / 0.40 | none | 7 | | |

**Mid-priced models**

| Model | Price in / out | Effort | Index | Cost per task | Response time |
|---|---|---|---|---|---|
| OpenAI `gpt-6.1-sol` | 2.00 / 10.00 | low | 42 | $0.13 | 12 s |
| | | medium | 48 | $0.21 | 17 s |
| | | high | 50 | $0.32 | 68 s |
| Google `gemini-3.8-flash` | 0.75 / 3.75 | medium | 40 | $0.93 | |
| | | high | 41 | $1.24 | 25 s |
| OpenAI `gpt-5.6-terra` | 2.00 / 12.00 | medium | 30 | $0.18 | 7 s |
| | | high | 34 | $0.34 | 12 s |
| Google `gemini-3.1-pro-preview` | 2.00 / 12.00 | | 30 | $1.30 | 25 s |

For reference, the top of the index is 58.

What the figures show:

- **`gpt-6.1-sol` leads the mid-priced group** on score, and costs far less per task than `gemini-3.8-flash`, whose lower list price is offset by the tokens it uses.
- **`gpt-6-luna` leads the lower-priced group** on cost per task; `deepseek-flash`, an open-weight model, scores higher at maximum effort for more per task.
- **Two earlier candidates drop out.** Artificial Analysis marks `gemini-2.5-flash-lite` (index 7) and `gpt-5.4-mini` as deprecated.
- **High effort is slow.** It suits overnight work, not the one-minute capture path.

**Starting models:**

| Step | Start with | Effort |
|---|---|---|
| Scoring | `gpt-6-luna` | medium |
| Reading screenshots | `gpt-6.1-sol` | low |
| Writing on capture | `gpt-6.1-sol` | low |
| Checking on capture | `gpt-6.1-sol` | medium |
| Writing and checking, overnight | `gpt-6.1-sol` | medium |

Challengers are cheaper open-source models (for example `deepseek-flash`), compared in item 6.1. Anthropic models are not used (owner's decision, 15 October 2026).

Both starting models accept images, per Artificial Analysis. A challenger for reading screenshots must too.

**Expected cost.** At the planned volume (6,000 listings scored, 900 applications written and checked a month), scoring on `gpt-6-luna` is about $4 to $8 a month and writing on `gpt-6.1-sol` about $30 to $45, so roughly $35 to $50 in total. These are estimates from assumed token counts; the first week of real use replaces them. If a cheaper model passes the writing checks, the monthly cost drops well below that.

What this does not settle:

- **Fit for these tasks.** The index measures general reasoning, knowledge and coding. It does not measure writing a job application or judging a job match. The quality checks do that (item 6.1), and a cheaper model replaces a dearer one only when it passes the same bars.
- **Missing rows.** The Artificial Analysis page was cut short when read, so `gpt-5.6-luna`, `gpt-5-nano` and `gemini-3.1-flash-lite` have no benchmark figures here.
- **Google's free tier** uses submitted content to improve its products; its paid tier does not. Use the free tier with test data only.

## 5. Data

The tables, as built in sprint 1 (`supabase/migrations/`). Every table allows only the owner.

| Table | Holds |
|---|---|
| `settings` | One row: the owner's account, daily target, monthly cap, pay floor, excluded countries (India) |
| `step_models` | The provider, model and reasoning effort for each model step (B3) |
| `documents` | The owner's plain-text material, versioned: profile, answer bank, voice examples, email patterns. An edit adds a version; the `current_documents` view shows the latest |
| `cv_files` | Each CV variant (full-stack, AI engineer, AI full-stack), its stored file and which one is current |
| `captures` | Posts the owner sent in: raw text or images, extracted fields, whether the email was confirmed, a fingerprint for spotting duplicates |
| `listings` | Automated listings in the common format, with source, link, the job's text, expiry, the run that found them, eligibility, tags, a fingerprint, and the owner's apply or skip mark. Expired listings are deleted, except marked ones and ones with an application |
| `scores` | Score and reasons per listing, with the model call that produced them |
| `applications` | One row per prepared application: route (email, note, form), CV, title and email pattern used, recipient, text, Gmail draft reference, status. Its fingerprint is unique, so a job gets one application (X6). A form also keeps its pages and the job read from them |
| `form_answers` | Each question of a form, its choices, its answer, and where it stands: pending, checking, answered, needs the owner's input, or something to upload |
| `runs` | Each daily run, capture and evaluation run: timings and counts |
| `model_calls` | Every model call: step, provider, model, effort, tokens, cost, time, error. Run and monthly costs are summed from here |
| `failed_steps` | Queued steps that failed every attempt, with the last error. A row is an open failure until the owner tries the step again or dismisses it |

Alongside the tables:

- **Queues** (Supabase Queues): `steps` for real work, `steps_test` and `steps_db_test` for tests only.
- **File buckets** (Supabase Storage, private): `cvs`, `screenshots`, and `raw-listings`, which is unused: a listing's text is kept in its row (21 October 2026).
- **Vault secrets:** `app_url` (where the worker is called) and `internal_api_secret`.
- **Fixed lists live in code, not tables:** the model steps, providers, effort levels and model prices are in `frontend/src/lib/model-catalog.ts`.

## 6. What already exists

The three course folders beside this one contain working examples of most of Shortlist's parts. Both course repositories are MIT licensed. The examples are in Python, so agents should treat them as designs to translate into TypeScript, not code to copy.

| Shortlist part | Existing example | Used in |
|---|---|---|
| Master profile, and asking the owner when the answer is unknown | `agents/1_foundations/twin`: the career twin, its `summary.txt` and `linkedin.pdf`, and its `record_unknown_question` tool | 0.1, 3.2 |
| Writing outreach emails with several cooperating steps | `agents/2_openai`: the sales-email labs and `deep_research` (planner, writer, email steps) | 2.2 |
| A worker checked by an evaluator, with typed evaluator output | `agents/4_langchain_langgraph/sidekick.py` | 2.2 |
| Scan sources, skip what was seen before, rank, notify | `llm_engineering/week8`: the deal finder and its scanner, planner and memory | 4.1 to 4.5 |
| A test set in a file, a scoring script and a results view | `llm_engineering/week5/evaluation` and `evaluator.py` | 1.6 |
| One client for many providers; model names in configuration | `ai-engineering-playbook`: the notes on providers and on choosing a model | 1.4 |

Two lessons from the owner's playbook are built into this plan: guard side effects in code, not in prompts (X5); and replace the course's file-based memory with database rows and duplicate keys (D2, X6).

**Open-source projects.** Research on 14 October 2026 (in `research/`) found two large projects that do part of what Shortlist does: career-ops (74k stars, MIT) and MadsLorentzen/ai-job-search (47k stars, MIT). Both run locally inside a coding tool and keep everything in files, so neither is forked. These parts are reused, translated into TypeScript with their tests, and credited in `THIRD_PARTY_NOTICES.md`. career-ops is pinned at commit `6caf821`.

| Part | Take from | Used in |
|---|---|---|
| Hacker News hiring-thread fetcher and comment parser | career-ops `providers/hackernews.mjs` | Sprint 7 |
| Greenhouse, Lever and Ashby fetchers, including Ashby's pay parsing | career-ops `providers/` | Sprint 8, 4.3 |
| Himalayas fetcher, as a reference only (it reads one page and skips salary) | career-ops `providers/himalayas.mjs` | 4.1 |
| Location matching, filter order and country-eligibility phrases | career-ops `scan.mjs` | 4.3 |
| Rules for sensitive form questions (visa, work authorisation, salary, demographics): never guess, ask | career-ops `modes/apply.md` | 0.4, 3.2 |
| Eligibility rules ("silence is not permission") and the five-part scoring rubric | ai-job-search `04-job-evaluation.md` | 4.3, 4.4 |
| Reviewer prompt and grounding check for drafts | ai-job-search `apply.md` | 2.2 |
| Writing rules and banned phrases | ai-job-search `03-writing-style.md` | 0.9, 2.2 |
| Standard form answers as a starting answer bank | ai-job-search `08-application-forms.md` | 0.4 |
| Duplicate key | ai-job-search `tools/job_key.py` | 2.6, 4.2 |
| Code check that every number and tool in a draft is in the profile | idea from career-ops `verify-cv-facts.mjs` | 2.2 |
| Lists of about 16,000 company job boards on Greenhouse, Lever and Ashby | Feashliaa/job-board-aggregator (MIT) | Sprint 8 |
| Gmail draft with attachment | read MaxwellVolz/hn_whos_hiring (MIT) before building | 2.3 |
| Installable app and share menu | Next.js's own PWA guide: `app/manifest.ts` and a hand-written `public/sw.js` that only receives shares. `@serwist/next` was dropped: it is for offline caching, which Shortlist does not need, and on Turbopack it adds a separate build step | 2.5 |

**Not taken:** ai-job-search's LinkedIn scraper; career-ops's DuckDuckGo search fallback; career-ops's pay filter, which rejects any job paid in another currency; anything under AGPL, GPL, Commons Clause or with no licence.

## 7. Sprints

### Sprint 0: Prepare (from 17 October 2026, owner's own work)

**Goal:** everything the build needs from the owner exists. None of this needs code, and the drafts can only be as good as this material.

| ID | Item | Done when |
|---|---|---|
| 0.1 | Master profile | One document covers every job and project: what was done, the stack, results with numbers where they exist. Start from the twin's `linkedin.pdf`; its three-sentence `summary.txt` is far too thin on its own |
| 0.2 | Three CVs | Full-stack, AI engineer and AI full-stack versions exist as PDF files |
| 0.3 | Voice examples | Five or more examples of the owner's own writing are collected |
| 0.4 | Answer bank | Written answers exist for: notice period, expected pay (local and international), current location, willingness to relocate, years with each main technology, links to LinkedIn, GitHub and portfolio |
| 0.5 | Saved posts and forms | A private folder of sample hiring posts and forms exists, as test cases. Continues through every sprint |
| 0.6 | Accounts | Created: private GitHub repository `shortlist`, Supabase project, Vercel account, Google Cloud project with the Gmail API switched on, an OpenAI API key with a spending limit, the separate alerts mailbox |
| 0.7 | Read-through | The owner has read REQUIREMENTS.md and this plan in full and raised anything that looks wrong |
| 0.8 | Owner-only checks | Checked: whether Wellfound's job-alert switch still exists |
| 0.9 | Email patterns | Research into application emails that get replies is done, and two or three patterns are written down with their length, structure and an example each (P7) |

**Exit check:** items 0.1 to 0.4 and 0.6 to 0.9 are done, and 0.5 holds at least ten posts.

### Sprint 1: Foundations

**Goal:** the contracts and tools every later item builds on.

| ID | Track | Item | Done when |
|---|---|---|---|
| 1.1 | A | Repository layout and agent rules file | One Next.js project with folders for pages, server code, database migrations and evaluation; the rules file states the principles as hard rules |
| 1.2 | A | Database tables | The tables in section 5 exist in Supabase through versioned migrations, with access rules limited to the owner |
| 1.3 | A | Server contract | Every server route's request and response shape is written down and agreed |
| 1.4 | B | Model module | A call made through it uses the configured provider, model and reasoning effort, returns typed output, and writes its cost to `model_calls` (B1, B3). The starting models from section 4 are in configuration |
| 1.5 | B | Tests and delivery | Tests run on every push; a merge publishes the app and applies migrations. Rule tests exist for: no sending anywhere in the code (`messages.send`, `drafts.send`, `sendMail`, `createTransport`) (X5); no secrets or personal data in the repository; no import from a host-specific package (portability rule 1); no dependency outside the licence list, and every reused file credited in `THIRD_PARTY_NOTICES.md` (principle 6) |
| 1.6 | C | Evaluation harness | One command (`pnpm eval`) runs a check over a folder of private cases and writes a results table per model. Built as a small runner of our own: promptfoo was tried and dropped, as it added about 490 packages, some without an open-source licence |
| 1.7 | C | Profile loading | The sprint 0 material is stored in Supabase and none of it is in the repository |
| 1.8 | D | Background jobs | A test step put on the Supabase queue is picked up at once through a database trigger, and by the every-minute schedule if the trigger is missed; a failed step is retried; a step can queue the next one. This also confirms the queue and scheduler work on the free plan |
| 1.9 | D | Himalayas yield check | A script queries Himalayas for jobs open to Pakistan and for worldwide jobs once a day for seven days and records how many pass the filters. This answers the first risk in section 8 before sprint 4 |

**Exit check:** a script makes one model call through the module, the cost row appears, a test job runs through the queue, and all tests pass.

### Sprint 2: Capture to Gmail draft

**Goal:** a LinkedIn post shared from the phone becomes a Gmail draft.

| ID | Track | Item | Done when |
|---|---|---|---|
| 2.1 | A | Extraction | Role, company, email or form link and poster's name are extracted from pasted text and from screenshots (C3) |
| 2.2 | B | Writer | A LangGraph loop chooses the CV, title and email pattern, writes the email in the owner's voice, checks every claim against the profile, and revises or blocks (P4, P7, X4). Its state is saved in Postgres, so each step runs as its own short call. Before the model's check, code confirms every number and technology in the draft appears in the profile and the draft is within the word limit |
| 2.3 | C | Gmail drafts | After one-time consent, code creates a draft with the CV attached in the owner's Gmail (X1). The Google app is in production mode and the token survives past seven days. The code refuses to run if the token has any Gmail permission other than `gmail.compose` |
| 2.4 | D | Capture route | A capture is saved and its first step queued; the steps run one after another without waiting for the schedule, each within the step budget |
| 2.5 | E | Pages: sign-in and capture | The owner signs in, shares a screenshot from Android or pastes text, and sees the result (C1, C2, U6). Confirming a screenshot's email address was dropped on 20 October 2026 (C4). The installed app is a share target; a small service worker hands the shared post to the capture form |
| 2.6 | all | Join the tracks | Duplicate captures are recognised (C5, X6) and the whole path meets the one-minute target (C6) |

**Exit check:** a screenshot shared from the phone produces a correct Gmail draft within a minute, and checks E1, E3 and E4 pass on 20 saved posts.

### Sprint 3: Form answers

**Goal:** a form supplied as screenshots comes back with answers to copy.

| ID | Track | Item | Done when |
|---|---|---|---|
| 3.1 | A | Question reading | Questions are listed from full-page screenshots or pasted text, including forms sent in several parts (F1, F3) |
| 3.2 | B | Answering | Each question is answered from the profile and answer bank, or marked "needs your input"; new answers are saved (F4, F5) |
| 3.3 | B | Missing items | Videos, uploads and portfolios are listed, with any stored asset that covers them (F6) |
| 3.4 | C | Pages: form | Questions are shown first, then answers with copy buttons; more screenshots can be added; the answer bank can be edited (F2, P6) |

**Exit check:** check E5 passes on 20 saved forms. Replaced by the owner's decision (20 October 2026): the owner tests forms live instead.

**As built (20 October 2026).** A form needs no captured post: on one page the owner adds screenshots of the form and of the job post or description, in any order, and the job is read from them. Three queued steps run in turn: `read_form` reads the pages one per step, listing their questions and the job's text word for word (one call for several screenshots ran past the time limit; pages added later add only new questions), `answer_form` answers them ten at a time, one call per step, and `check_form_answers` sends any answer it cannot support to the owner. There is no rewrite loop as in the writer: the owner knows the answer to a rejected question. A question the profile answers only in part comes with a draft whose guesses are in [brackets]; the owner replaces them before saving, and an answer with a bracket left in is refused (owner's decision, 21 October 2026). An answer the owner types is saved to the answer bank's "Answers given on forms" section. The Profile page shows every document and CV and edits documents as plain text (P6); from here on Supabase holds the latest versions. `pnpm profile:load` was removed in sprint 5, once CVs could be uploaded there too: run again, it would have saved the old files over edits made in the app.

### Sprint 4: Discovery

**Goal:** a ranked list of jobs is waiting every morning.

| ID | Track | Item | Done when |
|---|---|---|---|
| 4.1 | A | Himalayas connector | New listings are fetched once a day; its terms and rate limit are in configuration and covered by tests; the link back is kept (D7) |
| 4.2 | A | Common format and duplicates | Listings are stored in one format; duplicates across sources, captures and past applications are removed (D2, X6) |
| 4.3 | B | Filter | Listings that clearly exclude the owner, and listings for an excluded country, are dropped before any model call; unclear ones are flagged (D3, D3a, D4) |
| 4.4 | B | Scoring | Remaining listings are scored against the profile with ai-job-search's rubric as the starting point, one short step each, tagged, and the top N kept (D5, D6) |
| 4.5 | C | Daily run | The scheduler starts the run; each run is recorded with counts and cost (D1) |
| 4.6 | C | Preparation | Each kept listing gets a chosen CV and a short tailored note (X2) |
| 4.7 | D | Pages: marking | The owner marks listings as apply or skip (U7) |

**Exit check:** a list arrives five mornings in a row, check E2 passes on at least 200 marked listings, and the number of eligible jobs per day is known.

**As built (21 October 2026).** Supabase Cron calls `start_daily_run()` at 02:00 in Pakistan; it records the run and queues `fetch_listings`, so there is no daily-run route and a failed fetch is retried. That step reads Himalayas jobs open to Pakistan posted since the last run (`sort=recent`, a second between pages), decides eligibility in plain code that keeps a listing when in doubt, saves new listings once each in the database (`save_new_listings` also skips jobs already captured or answered on a form), deletes expired ones, and queues one `score_listing` step per kept listing. `gpt-6-luna` rates technical fit, experience and career alignment with ai-job-search's bands (behavioural fit and location left out, weights 35/30/35); code computes the score. When the last listing is scored, `select_top_listings` keeps up to the daily target, eligible before unclear, each scoring at least 45, stores their `top_rank` for check E2, and queues `prepare_note_application` for each: the writer's loop in its note mode (the `job-board-note` pattern, `write_note` and `check_note`), with the chosen CV. The Jobs page shows the latest run's list with each note to copy and Apply and Skip marks, then the other scored listings and what the filter dropped, with its reason. Added on 23 October 2026 (owner): blocked companies in Settings, or one tap on a job, whose jobs the filter drops before scoring; and at most two listings from one company on a night's list.

### Sprint 5: Review app and hardening

**Goal:** the morning routine runs entirely in the app, safely.

| ID | Track | Item | Done when |
|---|---|---|---|
| 5.1 | A | Daily list and statuses | Each day's jobs are shown with what was prepared; sent, skipped, replied and interview are one tap each (U1, U2) |
| 5.2 | A | Settings | Daily target, monthly cap, model per step and excluded countries can be changed in the app (U4) |
| 5.3 | A | Reports | Spending per run and month, and reply and interview rates per source and per email pattern, are shown (U5) |
| 5.4 | B | Spending cap | Automated runs stop at the cap and the app says so (B2) |
| 5.5 | B | Hidden-instruction tests | Posts and forms that contain instructions cause no action and no change to a draft's recipient |
| 5.6 | C | Failures | Failed jobs are retried, then shown in the app; the app warns if the daily run did not finish |

**Exit check:** every stage 1 requirement is met, and the owner has used the system for a week.

**As built (22 October 2026).** Sprint 5 is done (owner, 22 October 2026). Its exit check, a week of use, carries over as the owner's ongoing task, as sprint 4's did. Before the sprint, a code audit's findings were fixed (PR #30), and every page got one-tap navigation, with a bar at the bottom on a phone, as the installed app has no back button (#29).

- **Daily list and statuses (5.1).** The home page lists the last seven days' applications by day, in Pakistan time, with where each came from, what was prepared, and a listing's score and tags. Sent, Skipped, Replied and Interview are one tap each; the first time an application counts as sent is kept for the reports. Above the list, "Needs your attention" collects every open failure, the nightly run's warning and the cap notice.
- **Settings (5.2).** The nightly run's settings (jobs a night, monthly cap, lowest pay, excluded countries) and each step's model and effort, from the priced models only, are edited on the Settings page. Each takes effect from the next step that reads it.
- **Reports (5.3).** A Reports page shows reply and interview rates per source and per email pattern, counted from the statuses marked on the home page; the last fourteen nightly runs with their counts and cost; and spending per month and step. Nothing is stored for reports.
- **Spending cap (5.4).** Once the month's model spending reaches the cap, the nightly run fetches nothing, scores nothing and writes no notes; a note already queued is saved as blocked, saying why. Captures and forms are the owner's own requests and always run. The Jobs, Home and Settings pages say when the cap is reached.
- **Hidden instructions (5.5).** Tests with a fake model that obeys hidden text in a post, a form and a listing show that it causes no action, the answer bank is never written, and a draft's recipient always comes from the capture. A post can still name any address: the owner sees it in the Gmail draft before sending.
- **Failures (5.6).** A step that fails every attempt stays open in `failed_steps` and shows on the page of what it was working on (the capture, the form, or the job), with Try again, which queues it once more with the same payload, and Dismiss. A listing that cannot be scored no longer holds up the night: the worker's `giveUp` hook moves the run on to choosing its list. The app warns when a nightly run has not finished after six hours, failed, or no run started for over a day.
- **CVs.** A new CV is uploaded on the Profile page; `pnpm profile:load` is removed, as running it saved old files over edits made in the app.

### Sprint 6: Evidence and showcase

**Goal:** the repository is ready to show an employer.

| ID | Track | Item | Done when |
|---|---|---|---|
| 6.1 | A | Model comparison | Checks E1 to E5 are run across the candidates in section 4, the results table is written, and the final model per step is chosen on cost against results |
| 6.2 | B | Documentation | README, architecture diagram and cost report exist; the README has a "prior art" section comparing Shortlist with career-ops and ai-job-search; the playbook has notes on what the build taught |
| 6.3 | B | Demo | A short video shows capture, form answers and the morning list |
| 6.4 | C | Publication check | The repository and its history contain no secrets and no personal data |

### Stage 2 sprints, in outline

| Sprint | Goal |
|---|---|
| 7 | Hacker News connector: the monthly hiring thread and the jobs feed, ported from career-ops, reusing the email draft path |
| 8 | Company watchlist on Greenhouse, then Lever and Ashby (D8), with fetchers ported from career-ops and the company list seeded from Feashliaa's job-board lists; answers prepared from published questions (X7) |
| 9 | Alerts mailbox reader for Wellfound, LinkedIn job alerts and country portals |

## 8. Risks

| Risk | What to do |
|---|---|
| One source cannot supply enough eligible jobs a day | Item 1.9 measures it early. If it falls short, the Hacker News port (sprint 7) joins sprint 4 |
| Overnight work outgrows the host's free limits | Vercel's free plan allows four hours of active processing a month; time spent waiting for a model does not count. Short steps keep usage low. Watch the usage page in the first week of sprint 4 |
| A step runs longer than the 60-second budget | High reasoning effort can take a minute or more. Effort is set per step in configuration; the capture path uses low effort. A form is read one screenshot per step |
| A move to Amplify, whose limit is 30 seconds | Lower the step budget and split any step that needs longer, such as reading a long screenshot; the step design means no other change |
| Gmail access stops after a week | Google expires tokens after seven days for apps left in testing mode. Item 2.3 sets production mode and confirms the token survives |
| Google asks for app verification | `gmail.compose` is a restricted permission. A personal app used only by its owner is expected to work with an "unverified app" warning; item 2.3 confirms this before more is built on Gmail |
| A screenshot is misread or incomplete | Questions are shown before use (F2) and the email address is seen in the Gmail draft before sending; pasted text is the more exact alternative |
| Drafts and answers read as generic | Voice examples (0.3), email patterns (0.9), and checks E3, E4 and E5 before real use |
| Supabase free project is paused or outgrown | Free projects pause after a week without activity and allow 500 MB of database. The every-minute schedule keeps it active; expired listings are deleted every night, so the listings table stays small |
| Reused code carries upstream bugs | Pin the source commit, port its tests, and check each endpoint live before relying on it. A failed fetch is not an expired listing |
| A source changes its terms | Terms and limits live in one configuration file per source; each terms page is re-read before its connector is built |
| A model's price or standing changes | Models are retired and repriced often; two candidates were already marked deprecated. Configuration makes a swap a one-line change; item 6.1 supplies the evidence |
| Spending runs over the cap | Item 5.4 stops the nightly run at the monthly cap. Captures and forms still run, so the spending limit set on the provider key in item 0.6 stays the last safeguard |

## 9. Facts checked

Checked against the providers' own pages on 13 October 2026:

- **Himalayas API:** free, 20 listings per request, refreshed every 24 hours, filters for country, worldwide, seniority and time zone. Re-read on 21 October 2026: an API key is now optional (60 requests a minute; without one, callers share one allowance); the default order is by recent activity, so Shortlist asks for `sort=recent`. Terms: apply through the supplied `applicationLink`, credit Himalayas with a visible link, do not pass its jobs to other job boards or aggregators, and remove jobs once they expire.
- **Supabase free plan:** 500 MB database, 1 GB file storage, two active projects, paused after one week of inactivity.
- **Supabase Cron:** runs SQL or makes an HTTP request, as often as every second. Supabase recommends no more than eight jobs at once and ten minutes per job.
- **Vercel free plan:** functions run up to 300 seconds; 4.5 MB per request; scheduler once a day, within an hour of the set time; about one million function calls and four hours of active processing a month; personal, non-commercial use only.
- **Gmail:** no draft-only permission exists. `gmail.compose` creates drafts and can also send; it is classed as restricted.
- **Google sign-in tokens:** expire after seven days while the app is in testing mode.
- **Android share menu:** an installed web app can receive shared text, links and images.
- **Model prices and benchmarks:** as in section 4.
- **Supabase Queues, Cron and pg_net:** available on the free plan, and the deployed worker answers the every-minute schedule (item 1.8, confirmed 15 October 2026).
- **AWS Amplify:** hosts Next.js with server routes; no edge routes, no on-demand page revalidation, responses up to 5.72 MB, build output up to 220 MB.

Not yet checked:

- Whether a single-owner app can use `gmail.compose` in production mode without Google's verification (item 2.3).
- The time limit for a server call on AWS Amplify.
