# career-ops deep dive: fork, borrow or ignore for Shortlist (as of 14 Oct 2026)

Method: shallow clone of `career-ops-hq/career-ops` at commit `6caf821` (2026-10-14 08:05 UTC, core v1.36.0, web v0.14.0) and code read with grep, plus the GitHub API for metadata, issues and releases. Labels used below: **[code]** = verified by reading source, **[docs]** = what the repo's own README/docs say, **[API]** = GitHub API metadata, **[inference]** = my judgement. All file links point to `main`. Short name for the base URL: `GH` = https://github.com/career-ops-hq/career-ops/blob/main/

## 1. Architecture: what runs where, data store, unattended running, model calls

### Takeaway
career-ops is a local, file-based toolkit. Its "brain" is Markdown prompt files run by a coding CLI (Claude Code, Codex, etc.), with Node `.mjs` scripts for the steps that need no model. The Next.js app is a loopback-only viewer and launcher over the same local files. It has no database, no login, no hosting story, and no Anthropic/OpenAI SDK in the web app. Discovery (`scan.mjs`) can run unattended from cron with zero tokens. Model-driven steps run unattended only by shelling out to a coding CLI headless (`claude -p --dangerously-skip-permissions`) or through three small standalone evaluators (Gemini, OpenAI-compatible, Ollama) plus an OpenRouter runner. Model choice is one coarse "spend tier" or one env var per run, not per step.

### Cited Findings
- [docs] Principles: "Local-first. Everything runs on your machine against your files. No account required, no server in the loop"; "AI-agnostic. The logic lives in Markdown prompt files under `modes/`, executed by whatever AI coding CLI you use … or by standalone Node scripts" — [ARCHITECTURE.md](https://github.com/career-ops-hq/career-ops/blob/main/ARCHITECTURE.md)
- [docs] Settled doctrine (#918): Markdown files (`data/applications.md`, `data/pipeline.md`, `reports/`) are the "permanent source of truth. SQLite exists only as a derived index … and will never become a primary store — not even opt-in" — [ARCHITECTURE.md](https://github.com/career-ops-hq/career-ops/blob/main/ARCHITECTURE.md)
- [code] Root `package.json` runtime dependencies are only `@google/generative-ai`, `dotenv`, `js-yaml`, `playwright` 1.64.0 and `undici`; Node `^22.13.0 || >=23.4.0`. The derived SQLite index uses Node's built-in `node:sqlite` (`tracker.mjs`) — [package.json](https://github.com/career-ops-hq/career-ops/blob/main/package.json)
- [code] Web app `@career-ops/web` 0.14.0: Next 16.3.8, React 19.2, Tailwind 4, TypeScript 7.0.2, `playwright-core`, `js-yaml`, `react-markdown`. No database client, no auth library, no Zod, no model SDK — [web/package.json](https://github.com/career-ops-hq/career-ops/blob/main/web/package.json)
- [docs] The web UI is "an experimental, opt-in web UI … a local-first view over the exact same files the CLI reads and writes … no parallel engine, no separate database, no server". It binds `127.0.0.1` and "has no login — the bind is the access control" — [web/README.md](https://github.com/career-ops-hq/career-ops/blob/main/web/README.md)
- [code] The web app runs models by spawning a coding CLI as a child process. Its list of known CLIs is Claude Code (`claude -p`), Codex (`codex exec`), Gemini CLI, OpenCode, Pi, Copilot CLI, Qwen, Antigravity (`agy -p`), Grok Build and Hermes — [web/src/lib/clis.ts](https://github.com/career-ops-hq/career-ops/blob/main/web/src/lib/clis.ts)
- [docs] Scheduled scans in the web UI: "Automatic recurring scans through Task Scheduler are Windows-only. On macOS and Linux, saved scans run only when you choose Run now". The worker "never evaluates roles, applies, or invokes an AI model" and needs the user logged in — [web/README.md](https://github.com/career-ops-hq/career-ops/blob/main/web/README.md)
- [docs] Unattended recipes: cron or launchd for `node scan.mjs` (zero tokens), and "a headless `claude -p` call on the same cron/launchd pattern" for follow-up drafts written "to a file for you to review" — [docs/AUTOMATION.md](https://github.com/career-ops-hq/career-ops/blob/main/docs/AUTOMATION.md)
- [code] Batch evaluation runs `claude -p --dangerously-skip-permissions --strict-mcp-config [--model X]` per job, or other CLIs with `--cli opencode --model …` — [batch/batch-runner.sh](https://github.com/career-ops-hq/career-ops/blob/main/batch/batch-runner.sh)
- [code] Direct model API paths, none of which go through a coding agent: `openrouter-runner.mjs` (OpenRouter free-model rotation, or one model pinned with `CAREER_OPS_MODEL`), `gemini-eval.mjs` (`GEMINI_MODEL`), `openai-eval.mjs` (any OpenAI-compatible `OPENAI_BASE_URL` + `OPENAI_MODEL`), `ollama-eval.mjs`. No file calls `api.anthropic.com` or uses `@anthropic-ai/sdk`. `ANTHROPIC_API_KEY` exists only for the Claude CLI and a `doctor` check — [openrouter-runner.mjs](https://github.com/career-ops-hq/career-ops/blob/main/openrouter-runner.mjs), [.env.example](https://github.com/career-ops-hq/career-ops/blob/main/.env.example)
- [code] Model routing is one `spend_tier` (economy/standard/premium) in `config/profile.yml`. For Claude Code this maps to Haiku 4.5, Sonnet 5.5 or Opus 5.5, with extended thinking off/off/adaptive. Other CLIs get "your CLI's cheapest/fastest available model" and so on. It is set once per session, not per step — [modes/_shared.md](https://github.com/career-ops-hq/career-ops/blob/main/modes/_shared.md), [config/profile.example.yml](https://github.com/career-ops-hq/career-ops/blob/main/config/profile.example.yml)
- [code] Size: about 179k lines of non-test `.mjs`. `scan.mjs` alone is 4,988 lines and `test-all.mjs` is 19,523 lines. 793 files under `tests/`; 2,216 files in the repo — local clone count and [git tree API](https://api.github.com/repos/career-ops-hq/career-ops/git/trees/main?recursive=1)
- [docs] Docker exists only to supply Playwright/Chromium on awkward Linux hosts. It bind-mounts your local project folder and is not a hosted deployment — [DOCKER.md](https://github.com/career-ops-hq/career-ops/blob/main/DOCKER.md)

### Inferences
- [inference] For Shortlist this is the wrong shape. Shortlist wants hosted, Postgres-backed, per-step model config with reasoning effort, and a phone UI. career-ops is local files, a loopback-only UI, coding-CLI subprocesses and one coarse tier. Changing that is a rewrite of the core, not a fork-and-tweak, and upstream has ruled out a primary database by doctrine.
- [inference] "Unattended without an interactive session" is technically true for discovery (cron + `scan.mjs`) and for headless `claude -p`. It still assumes an always-on personal machine with the CLI installed and logged in. That is not a free serverless host.

### Gaps
- I did not run the app. The behaviour above is from code and docs, not execution.

## 2. Eligibility: Pakistan-open, exclude India, pay floor

### Takeaway
The scan-time filters can roughly express "exclude India-based jobs": `location_filter.block_hard: ["India", "Bengaluru", …]` uses word-boundary matching on the structured location field. They cannot positively verify "open to candidates in Pakistan". The country-eligibility filter only rejects when an exclusionary phrase is found in the description. The pay floor applies only to structured salary data, compares annual figures, and does no currency conversion: a posting whose currency differs from the filter's is simply rejected, and one with no salary passes. Himalayas, Greenhouse and Lever salary fields are not parsed at all.

### Cited Findings
- [code] `location_filter` tiers are `block_hard` → `always_allow` → `block` → `allow`, with an optional `strict`. A posting with an empty location passes unless `strict: true`. Keywords match on word boundaries, written so that blocking "india" no longer drops "Indiana" or "Indianapolis" — [scan.mjs ~L355-440](https://github.com/career-ops-hq/career-ops/blob/main/scan.mjs), [templates/portals.example.yml](https://github.com/career-ops-hq/career-ops/blob/main/templates/portals.example.yml)
- [docs] The shipped example blocks `India` and `Bengaluru` for a US-based searcher — [templates/portals.example.yml](https://github.com/career-ops-hq/career-ops/blob/main/templates/portals.example.yml)
- [code] `country_eligibility_filter` (opt-in, #2093) reads description text against `location.country`. It rejects only when an `exclusionary` phrase matches, no `inclusive` phrase matches, and the user's country is not named. With no description, or no exclusionary phrase, the posting passes ("ambiguous stays ambiguous") — [templates/portals.example.yml](https://github.com/career-ops-hq/career-ops/blob/main/templates/portals.example.yml)
- [code] `visa_filter` (opt-in) drops postings that say they won't sponsor, or with `require_mention: true` keeps only those advertising sponsorship. Its vocabulary covers US, Singapore, EU and UK visa wording — [templates/portals.example.yml](https://github.com/career-ops-hq/career-ops/blob/main/templates/portals.example.yml)
- [code] The "work-authorization check" is a prompt rule in evaluation Block A, not code. It sorts each role into Sponsors / Not needed / Unstated / No sponsorship using `location.authorized_in` and `needs_sponsorship`. "No sponsorship" counts as a blocker only when the JD says so explicitly — [modes/oferta.md](https://github.com/career-ops-hq/career-ops/blob/main/modes/oferta.md)
- [code] `buildSalaryFilter`: if there is no salary data, the job passes. "If both currencies are known and differ, the job is rejected". The filter uses annual min/max range overlap and has no FX conversion — [scan.mjs L1044-1103](https://github.com/career-ops-hq/career-ops/blob/main/scan.mjs)
- [code] Only 19 provider files mention salary at all (e.g. Ashby, Workable, Built In, Getro, WTTJ, NoFluffJobs, Landing.jobs, Remotli). Himalayas, Greenhouse, Lever and HN do not emit salary. Ashby annualises with interval multipliers (`1 HOUR`: 2080, `1 MONTH`: 12, …) — [providers/ashby.mjs](https://github.com/career-ops-hq/career-ops/blob/main/providers/ashby.mjs), [providers/himalayas.mjs](https://github.com/career-ops-hq/career-ops/blob/main/providers/himalayas.mjs)
- [docs] For the Ashby embed source, compensation arrives "only as a display string … which is not parsed into a salary: a bare `$` does not name a currency" — [docs/SUPPORTED_JOB_BOARDS.md](https://github.com/career-ops-hq/career-ops/blob/main/docs/SUPPORTED_JOB_BOARDS.md)
- [code] The Himalayas provider keeps only `title`, `companyName`, `locationRestrictions` (joined into a location string), `applicationLink`/`guid` and `pubDate`. It fetches a single page, `?limit=50`, with no pagination — [providers/himalayas.mjs](https://github.com/career-ops-hq/career-ops/blob/main/providers/himalayas.mjs)

### Inferences
- [inference] "Open to Pakistan" could be approximated with `allow: ["Pakistan", "Asia", "Worldwide", "Anywhere", …]`, `block_hard: ["India", …]` and `strict` off, so Himalayas' empty restrictions (worldwide) pass. That is substring heuristics, not a verified rule. A worldwide posting whose body says "India-based team" would slip through.
- [inference] A USD monthly floor would be written as a yearly `min` in USD. That wrongly drops EUR/GBP-paid jobs (currency mismatch means reject) and lets through every job without structured pay. Shortlist needs its own salary parser, period normaliser and FX step either way. Ashby's interval table is the one piece worth copying.

### Gaps
- I did not check whether any other provider normalises hourly or monthly pay before the filter. Only Ashby's annualisation was confirmed.

## 3. Email drafts and Gmail

### Takeaway
The "draft-only email mode" is a prompt (`modes/email.md`) that outputs an email body as text in the chat for the user to paste, plus an attachment checklist. It creates no Gmail drafts, attaches no files, and the README says "There is no mail transport anywhere in this codebase". The only Gmail code is a read-only ingest plugin that pulls job-lead URLs from a label via the Gmail REST API with a user-supplied OAuth refresh token.

### Cited Findings
- [code] email mode: "Generate a formal application email body that the candidate can paste into an email client … Never submit. Never send email. Never click send. Draft only." It outputs an "Attachments to include" checklist and says "Do not attach files or send anything." — [modes/email.md](https://github.com/career-ops-hq/career-ops/blob/main/modes/email.md)
- [docs] "Send an email. Drafts only. There is no mail transport anywhere in this codebase." — [README.md](https://github.com/career-ops-hq/career-ops/blob/main/README.md)
- [code] A grep for `users/me/drafts`, `drafts.create` or `gmail.compose` finds no matches in the codebase — local clone
- [code] Gmail plugin manifest: "Gmail ingest … Pull job leads from a Gmail label into your pipeline (read-only, your OAuth token)". Hooks: `ingest`; env: `GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN`; allowed hosts `oauth2.googleapis.com`, `gmail.googleapis.com`. It uses raw `fetch` to `gmail/v1/users/me` and keeps a cursor in `data/gmail-state.json`. The code never requests a scope: whatever scope the user's refresh token carries is what it gets — [plugins/gmail/manifest.json](https://github.com/career-ops-hq/career-ops/blob/main/plugins/gmail/manifest.json), [plugins/gmail/index.mjs](https://github.com/career-ops-hq/career-ops/blob/main/plugins/gmail/index.mjs)
- [code] Email fact discipline is a prompt instruction ("Use only facts from source-of-truth files"). The code fact gate (`verify-cv-facts.mjs`) is wired into CV PDF generation and `generate-cover-letter.mjs`, not into email mode — [modes/email.md](https://github.com/career-ops-hq/career-ops/blob/main/modes/email.md), [generate-cover-letter.mjs](https://github.com/career-ops-hq/career-ops/blob/main/generate-cover-letter.mjs)
- [API] Open issue #3731: "gmail ingest: LinkedIn digests and Indeed alerts land as untitled URL-only leads" — [issue #3731](https://github.com/career-ops-hq/career-ops/issues/3731)

### Inferences
- [inference] Shortlist's Gmail-draft-with-attachment feature (`gmail.compose` scope, MIME with the CV PDF) has to be built from scratch. The prompt rules in `modes/email.md` (email variants, structure, attachment checklist, no sending) are useful as a prompt reference. The token-refresh helper in `plugins/gmail/index.mjs` is about 20 lines and easy to rewrite.

### Gaps
- None material.

## 4. Form answering

### Takeaway
Two paths exist. (1) The CLI `apply` mode is a prompt. It reads the live form through Playwright, or from a screenshot or pasted questions, drafts answers from `config/profile.yml`, the tailored CV / `cv.md` and the evaluation report, and presents them for copy-paste. Answers can then be saved into the report's "Application Answers" section. (2) The web `Apply` page drives Playwright to prefill fields, with a "submit guard" that never clicks submit. Both forbid inventing answers to legal, visa, work-authorisation, salary and demographic questions: these are marked `needs_candidate_confirmation`. There is no reusable global answer bank. The nearest things are `profile.yml`, per-report saved answers and an interview story bank.

### Cited Findings
- [code] apply mode: "Best with Playwright in visible mode … Without Playwright: the candidate shares a screenshot or pastes the questions manually." Workflow: DETECT → IDENTIFY → SEARCH reports → LOAD → PREFLIGHT (liveness, blacklist, cross-channel) → PRE-SCAN knock-outs → GENERATE → SWEEP → PRESENT for copy-paste → PERSIST — [modes/apply.md](https://github.com/career-ops-hq/career-ops/blob/main/modes/apply.md)
- [code] "Never invent answers for legal, demographic, work-authorization, visa/sponsorship, salary, disability, veteran, background-check, relocation, or self-identification fields. If the answer is not present in `config/profile.yml` or visible context, mark it as needing candidate confirmation" — [modes/apply.md](https://github.com/career-ops-hq/career-ops/blob/main/modes/apply.md)
- [code] Character limits: count the final answer against the confirmed `maxlength`, and show "limit unknown" when it isn't known ("A missing limit is never proof that an answer fits") — [modes/apply.md](https://github.com/career-ops-hq/career-ops/blob/main/modes/apply.md)
- [code] Web prefill prompt: "Ground EVERY answer in the REAL candidate — never invent facts". `profile.yml` owns contact details, work authorisation, visa and comp; the tailored CV owns experience. Comment: the sensitive-field carve-out "is what keeps legal, visa, work-authorization, salary and demographic questions from being auto-filled" — [web/src/lib/apply/answer-prompt.mjs](https://github.com/career-ops-hq/career-ops/blob/main/web/src/lib/apply/answer-prompt.mjs)
- [code] "NEVER-SUBMIT is by construction for the planner's ACTION VOCABULARY … there is no 'submit' action to issue". It admits a JS handler on an allowed button could still call `form.submit()` — [web/src/lib/apply/submit-guard.mjs](https://github.com/career-ops-hq/career-ops/blob/main/web/src/lib/apply/submit-guard.mjs)
- [code] `application-answers.mjs` writes an "## Application Answers" section into a report, with state `filled` or `submitted` — [application-answers.mjs](https://github.com/career-ops-hq/career-ops/blob/main/application-answers.mjs)
- [docs] ATS quirks handled for Ashby (duplicate email merge), Lever (never touches checkboxes/radios/hCaptcha), Workable (clipboard paste) and react-select — [docs/APPLY_AUTOFILL.md](https://github.com/career-ops-hq/career-ops/blob/main/docs/APPLY_AUTOFILL.md)
- [code] `openrouter-runner.mjs apply <report_no>` "Generate[s] draft application form answers" with no CLI needed — [openrouter-runner.mjs](https://github.com/career-ops-hq/career-ops/blob/main/openrouter-runner.mjs)

### Inferences
- [inference] Shortlist's "screenshot in, answer-bank lookup, refuse when unknown" design matches career-ops' rules but not its mechanics. Screenshots here are just read by the coding agent's multimodal Read tool. Worth borrowing: the sensitive-field list, the `needs_candidate_confirmation` contract, and the char-limit rule. Shortlist should keep its own structured answer bank in Postgres.

### Gaps
- I did not test how well screenshot-only answering works in practice.

## 5. Quality checks (evals, fact checks) and cost tracking

### Takeaway
Evals: 10 synthetic JDs with frozen reference labels, archetype as the gate and score within ±0.5. They are replayed from recorded fixtures and are not wired into CI. They test only evaluation scoring and archetype, not emails, form answers or fact-faithfulness. The fact gate is a deterministic checker (`verify-cv-facts.mjs`, ~142 KB) that blocks CV and cover-letter PDFs whose numbers or tools are missing from `cv.md`/`article-digest.md`, plus user-configured forbidden phrases. Cost: token counts per run, a hard-coded USD rate table and per-run estimates. There is no spending cap anywhere.

### Cited Findings
- [code] "10 synthetic cases … wiring into CI is still deferred". Metric is "agreement-with-reference, not absolute correctness". The archetype gate is `MIN_ARCHETYPE_AGREEMENT` 0.8 and the score tolerance ±0.5. `COST_PER_RUN_USD` is "empty — needs real provider rates". Replay is `$0`; the live path runs through `openai-eval.mjs` — [evals/README.md](https://github.com/career-ops-hq/career-ops/blob/main/evals/README.md)
- [code] No workflow under `.github/workflows/` mentions `eval-golden` or `evals/` (grep of test.yml, web-ci.yml and the rest) — local clone, [.github/workflows](https://github.com/career-ops-hq/career-ops/tree/main/.github/workflows)
- [code] Example golden case: `{ id, synthetic: true, jd, label: { archetype: "Agentic / Automation", score: 3.9, provenance: "reference-frozen-v1" } }`. A fixture holds only a `---SCORE_SUMMARY---` block — [evals/golden/agentic-automation.json](https://github.com/career-ops-hq/career-ops/blob/main/evals/golden/agentic-automation.json)
- [code] `verify-cv-facts.mjs`: "Verify generated candidate-facing documents against the user's source facts … shared by PDF generators so every generated document gets the same gate". Sources are `cv.md` and `article-digest.md`; config `config/cv-facts.json` has `allow_metrics`, `allow_facts`, `forbidden_phrases` and `warn_phrases` — [verify-cv-facts.mjs](https://github.com/career-ops-hq/career-ops/blob/main/verify-cv-facts.mjs), [config/cv-facts.example.json](https://github.com/career-ops-hq/career-ops/blob/main/config/cv-facts.example.json)
- [docs] "A check in code stops a PDF whose numbers or facts appear in neither your CV nor your article digest, but it cannot judge every rewording yet." — [README.md](https://github.com/career-ops-hq/career-ops/blob/main/README.md)
- [code] `story-provenance-check.mjs` classifies figures in the interview story bank as `existing`, `supportedByResume` or `derived-unverified` against `cv.md` — [modes/oferta.md](https://github.com/career-ops-hq/career-ops/blob/main/modes/oferta.md)
- [API] Open issue #1411 proposes "a fail-closed CV faithfulness gate", and #5125 reports a fact-gate gap ("a German count noun outside the list is neither checked nor reported") — [#1411](https://github.com/career-ops-hq/career-ops/issues/1411), [#5125](https://github.com/career-ops-hq/career-ops/issues/5125)
- [code] `utils/token-tracker.mjs` has a hard-coded `RATES` table (MiniMax, gpt-4o(-mini), several Gemini models, DeepSeek, Claude 3.x only). `estimateCost` returns 0 for Ollama and for unpinned OpenRouter free models — [utils/token-tracker.mjs](https://github.com/career-ops-hq/career-ops/blob/main/utils/token-tracker.mjs)
- [code] `batch/aggregate-tokens.mjs` sums per-worker tokens and dollars after a batch run. The web app's `run-cost-estimate.mjs` predicts a run from the median of the user's last 10 runs of the same kind. `claude-usage.mjs` counts tokens and says "This is a volume signal, not a dollar-cost estimate" — [batch/aggregate-tokens.mjs](https://github.com/career-ops-hq/career-ops/blob/main/batch/aggregate-tokens.mjs), [web/src/lib/run-cost-estimate.mjs](https://github.com/career-ops-hq/career-ops/blob/main/web/src/lib/run-cost-estimate.mjs), [web/src/lib/claude-usage.mjs](https://github.com/career-ops-hq/career-ops/blob/main/web/src/lib/claude-usage.mjs)
- [code] A grep for a spend cap, max-USD, monthly budget or cost cap across `.mjs`/`.ts`/`.sh`/`.md` (excluding tests and the changelog) finds nothing. The only "budget" in `batch-runner.sh` is the retry budget — local clone
- [API] Open issue #3237 "Claude token drains quickly" — [#3237](https://github.com/career-ops-hq/career-ops/issues/3237)

### Inferences
- [inference] Shortlist's per-call cost table, monthly cap and per-model eval suite would all be new work. Two things are worth porting as ideas: the golden-set harness design (frozen reference labels, replay fixtures, an agreement gate) and the fact-gate approach, a deterministic number/tool extraction checked against the CV. The 142 KB fact checker itself is heavily tuned to CV prose and multilingual edge cases. Read it for ideas rather than port it whole.

### Gaps
- I did not measure the fact gate's precision or recall.

## 6. Sources: API vs scraping, the five target modules, portability, ToS

### Takeaway
105 provider modules (excluding `_` helpers). By the project's own table: 64 "API", 27 "Parser" (HTML), 9 RSS, 1 Atom, 1 XML, 2 retired. About 20 modules send a browser-like User-Agent or use Playwright. LinkedIn scraping is not in core, and CONTRIBUTING rejects it. The five Shortlist targets are small, dependency-free ES modules (JSDoc-typed JS) that take an injected `fetchJson`. They port to TypeScript + Zod in hours, not days.

### Cited Findings
- [docs] Type column counts from the supported-boards table: API 64, Parser 27, RSS 9, plus Atom, XML, 2 retired and a few "evaluated, not supported" rows — [docs/SUPPORTED_JOB_BOARDS.md](https://github.com/career-ops-hq/career-ops/blob/main/docs/SUPPORTED_JOB_BOARDS.md)
- [code] Modules that reference `BROWSER_LIKE_USER_AGENT` or Playwright (a sign of bot-wall workarounds): builtin, careerviet, consider, eightfold, feishu-jobs, getro, glints, icims, itviec, jazzhr, jobbankca, mycareersfuture, occ, oraclecloud, peoplesoft, platsbanken, senjob, taleo, workable, workday. Separate Playwright scanners exist for Dayforce (behind Cloudflare) and Interamt — [providers/](https://github.com/career-ops-hq/career-ops/tree/main/providers), [docs/SUPPORTED_JOB_BOARDS.md](https://github.com/career-ops-hq/career-ops/blob/main/docs/SUPPORTED_JOB_BOARDS.md)
- [docs] Source admission rules include the source's `robots.txt` read per path. A `Disallow` counts only if it covers paths the provider fetches ("precedent: ITviec, CareerViet, both carrying disallows they route around"). AI-crawler-specific robots rules are deemed not to name this client — [CONTRIBUTING.md](https://github.com/career-ops-hq/career-ops/blob/main/CONTRIBUTING.md)
- [docs] "PRs that scrape platforms prohibiting automated access (LinkedIn, etc.). We actively reject these to respect third-party ToS." — [CONTRIBUTING.md](https://github.com/career-ops-hq/career-ops/blob/main/CONTRIBUTING.md)
- [docs] EchoJobs was retired when it put up bot protection: "career-ops does not work around bot protection" — [docs/SUPPORTED_JOB_BOARDS.md](https://github.com/career-ops-hq/career-ops/blob/main/docs/SUPPORTED_JOB_BOARDS.md)
- [code] LinkedIn appears only as: (a) a third-party registry plugin `linkedin-alerts` that parses LinkedIn alert emails from Gmail (repo by Schlaflied, which issues #4130/#4186 report now returns 404); (b) `linkedin-join.mjs`, which joins the user's own `Connections.csv` export; (c) Telegram-channel link classification. LinkedIn URLs pasted for evaluation hit the authwall (open issues #2993 and #2995) — [plugins-registry/linkedin-alerts.json](https://github.com/career-ops-hq/career-ops/blob/main/plugins-registry/linkedin-alerts.json), [linkedin-join.mjs](https://github.com/career-ops-hq/career-ops/blob/main/linkedin-join.mjs), [#4186](https://github.com/career-ops-hq/career-ops/issues/4186), [#2995](https://github.com/career-ops-hq/career-ops/issues/2995)
- [code] DuckDuckGo: `scan.mjs` has an opt-in "search-and-reverify fallback". In Playwright it loads `https://html.duckduckgo.com/html/?q="title" "company" site:<domain>` to re-find a moved posting during verification — [scan.mjs ~L1370-1440](https://github.com/career-ops-hq/career-ops/blob/main/scan.mjs)
- [code] The template's `search_queries` (e.g. `site:wellfound.com …`, which is `enabled: true` in the example) are run by the AI agent's own WebSearch tool in scan mode, not by `scan.mjs` — [templates/portals.example.yml](https://github.com/career-ops-hq/career-ops/blob/main/templates/portals.example.yml)
- [code] Sizes of the target modules, in lines: himalayas 129, hackernews 185, lever 133, greenhouse 280, ashby 538. Shared `_http.mjs` is 576 lines (retry, backoff, SSRF/IP guard, DNS cache, UA); `_types.js` is 219. Imports are local helpers only (`_http`, `_ids`, `_html-to-text`, `_html-entities`, `_safe-url`); no npm dependencies — local clone (`wc -l`), [providers/](https://github.com/career-ops-hq/career-ops/tree/main/providers)
- [code] Endpoints: Himalayas `https://himalayas.app/jobs/api?limit=50`; HN via Algolia `search_by_date?tags=story,author_whoishiring` then `items/{id}`, with free-form comment parsing; Greenhouse `boards-api.greenhouse.io/v1/boards/{slug}/jobs` (with `content=true`); Lever `api.(eu.)lever.co/v0/postings/{slug}` (merges `allLocations`); Ashby `api.ashbyhq.com/posting-api/job-board/{slug}` with compensation tiers, plus an opt-in embed fallback — [providers/hackernews.mjs](https://github.com/career-ops-hq/career-ops/blob/main/providers/hackernews.mjs), [providers/greenhouse.mjs](https://github.com/career-ops-hq/career-ops/blob/main/providers/greenhouse.mjs), [providers/lever.mjs](https://github.com/career-ops-hq/career-ops/blob/main/providers/lever.mjs), [providers/ashby.mjs](https://github.com/career-ops-hq/career-ops/blob/main/providers/ashby.mjs)
- [code] `scan-hn.mjs` can optionally send each HN comment to Gemini (`GEMINI_MODEL`, default `gemini-3.6-flash`) for extraction when `GEMINI_API_KEY` is set, and falls back to keyword matching otherwise — [scan-hn.mjs](https://github.com/career-ops-hq/career-ops/blob/main/scan-hn.mjs)
- [code] Per-provider contract tests exist: `tests/providers/{himalayas,hackernews,greenhouse,lever,ashby,ashby-compensation-tiers,ashby-retry}.test.mjs` — [tests/providers](https://github.com/career-ops-hq/career-ops/tree/main/tests/providers)
- [API] Maintainer on an "IP Ban warning!" issue (#2286, closed): `scan.mjs` "is zero-token and API-only by design" — [#2286](https://github.com/career-ops-hq/career-ops/issues/2286). Bot-wall issues exist on secondary sources: Getro "unpaced pagination triggers Datadog WAF IP ban" (#2706, closed), HigherEdJobs Incapsula block (#3637, closed), Ontario GO Jobs Radware (#4014) — [#2706](https://github.com/career-ops-hq/career-ops/issues/2706), [#3637](https://github.com/career-ops-hq/career-ops/issues/3637)

### Inferences
- [inference] The five modules are good reference implementations: response shapes, edge cases (HN thread lookup by the `whoishiring` author, Lever `allLocations`, Ashby compensation tiers and annualisation, Greenhouse embed `?for=` slugs) and test fixtures. The Himalayas module is weaker than Shortlist needs: one page of 50, no salary, no description. Shortlist should write its own paginated Himalayas client with salary fields. Porting means rewriting each `parse*Response` as a Zod schema plus a mapper, about 50-200 lines of TS each. The SSRF/redirect guards in `_http.mjs` matter less for fixed hosts in a serverless function.
- [inference] Nothing that violates terms is enabled by default for the five target sources. The 20 or so browser-UA/Playwright providers and the robots-only admission rule are a reason not to adopt the full provider set blindly.

### Gaps
- I did not check each of the 105 providers against its site's Terms of Service. The project's gate is robots.txt plus operator declaration, not a ToS review.

## 7. Data handling, telemetry, third parties

### Takeaway
No telemetry or analytics SDK was found. Personal data stays in local gitignored files, and the CV goes to whichever model provider or CLI the user chose. Default outbound calls that are not job boards: Google's favicon service (company domains) from the web UI's logo route, GitHub API/raw for the updater and "what's new", and job-board APIs (no personal data is sent). Optional plugins add Gmail, Notion, Apify, Serper and Tavily.

### Cited Findings
- [docs] "Phone home. No telemetry, no backend of ours. Your CV goes from your machine to the AI provider you chose, and nowhere else." — [README.md](https://github.com/career-ops-hq/career-ops/blob/main/README.md)
- [code] A grep for posthog, sentry, plausible, mixpanel, segment, google-analytics, gtag and amplitude finds no analytics SDK. The only "telemetry" hits are comments saying there is none (e.g. `hired-share.mjs`) — local clone
- [code] The web logo route fetches `https://www.google.com/s2/favicons?domain=<company domain>` and caches results under `.career-ops-web/logo-cache` — [web/src/app/api/logo/route.ts](https://github.com/career-ops-hq/career-ops/blob/main/web/src/app/api/logo/route.ts)
- [code] `.gitignore` excludes `cv.md`, `config/profile.yml`, `data/*` and `reports/*.md`. A `no-user-data.yml` CI workflow guards against committing user data — [.gitignore](https://github.com/career-ops-hq/career-ops/blob/main/.gitignore), [.github/workflows/no-user-data.yml](https://github.com/career-ops-hq/career-ops/blob/main/.github/workflows/no-user-data.yml)
- [docs] Automation docs: scans "send none of your personal data" to the public job-board APIs — [docs/AUTOMATION.md](https://github.com/career-ops-hq/career-ops/blob/main/docs/AUTOMATION.md)
- [code] The plugin engine declares `allowedHosts` per plugin, and secrets are scoped through `ctx.env`. Its own types say this is "a convenience accessor — NOT an isolation boundary (process.env stays globally reachable)" — [plugins/_types.js](https://github.com/career-ops-hq/career-ops/blob/main/plugins/_types.js)
- [code] Batch mode runs Claude with `--dangerously-skip-permissions` over untrusted JD text. The web `pdf` worker, by contrast, has write tools denied on Claude Code — [batch/batch-runner.sh](https://github.com/career-ops-hq/career-ops/blob/main/batch/batch-runner.sh), [web/README.md](https://github.com/career-ops-hq/career-ops/blob/main/web/README.md)

### Inferences
- [inference] Privacy posture is good for a local tool. The main risk is prompt injection from job descriptions into an agent running with all permissions (batch mode). Shortlist avoids that by calling model APIs directly with no tools.

### Gaps
- No network capture was done. The findings come from code grep.

## 8. Project health, governance, licence

### Takeaway
Very active and well-maintained, but centralised. One BDFL (santifer) has final say on architecture, alongside one reviewer and one area owner. Releases ship about weekly. The rename moved the repo into an organisation (`career-ops-hq`, created 2026-08-31) without changing governance. The code is plain MIT with no CLA or DCO. The name "career-ops" is reserved by a trademark policy: forks must use a different name.

### Cited Findings
- [API] Repo metadata on 2026-10-14: 74,443 stars, 13,957 forks, MIT, language JavaScript, created 2026-04-04, pushed 2026-10-14. `santifer/career-ops` now resolves to `career-ops-hq/career-ops`. The org was created 2026-08-31 with 4 public repos; its site is career-ops.org — [GitHub API repo](https://api.github.com/repos/career-ops-hq/career-ops), [org](https://api.github.com/orgs/career-ops-hq)
- [API] 31 core releases from v1.7.0 (2026-05-06) to v1.36.0 (2026-10-10), each paired with a web release. Recent gaps between releases are 2-13 days. Weekly commits over the last 8 weeks: 180, 164, 206, 71, 220, 208, 171, 260 — [releases](https://github.com/career-ops-hq/career-ops/releases), [participation stats](https://api.github.com/repos/career-ops-hq/career-ops/stats/participation)
- [API] 222 open issues (47 labelled bug) and 171 open PRs. 717 PRs merged since 2026-09-14. Top contributors by commits: santifer 554, careerops-ledger (bot) 160, abankar1 128, Schlaflied 117, rubicon 107 — [search API](https://github.com/career-ops-hq/career-ops/issues), [contributors](https://github.com/career-ops-hq/career-ops/graphs/contributors)
- [docs] Governance: "maintained by @santifer under a BDFL (Benevolent Dictator for Life) model". Architecture, scoring and the data contract are "maintainer only". New features "require an approved issue before PR". Contributor status is earned with the 3rd merged PR — [GOVERNANCE.md](https://github.com/career-ops-hq/career-ops/blob/main/GOVERNANCE.md)
- [docs] Maintainers: lead @santifer; reviewer @FReptar0; area owner @Scott-Emberson (tests, Go dashboard, `providers/`, with code-owner review required) — [MAINTAINERS.md](https://github.com/career-ops-hq/career-ops/blob/main/MAINTAINERS.md)
- [docs] Licence: "MIT License, Copyright (c) 2026 Santiago Fernández de Valderrama". Trademark policy: "MIT covers the code … This policy covers the name and brand". Forking is allowed; "Naming a fork distinctly" is expected; commercial naming and endorsement need permission — [LICENSE](https://github.com/career-ops-hq/career-ops/blob/main/LICENSE), [TRADEMARK.md](https://github.com/career-ops-hq/career-ops/blob/main/TRADEMARK.md)
- [code] No CLA or DCO: CONTRIBUTING has no sign-off requirement. `SIGNATURES.md` is a manifesto guestbook, not a contributor agreement — [CONTRIBUTING.md](https://github.com/career-ops-hq/career-ops/blob/main/CONTRIBUTING.md), [SIGNATURES.md](https://github.com/career-ops-hq/career-ops/blob/main/SIGNATURES.md)
- [API] Ecosystem fragility: 5 of 9 approved community plugins could not be installed because a contributor's GitHub account disappeared (#4186, #4130, open) — [#4186](https://github.com/career-ops-hq/career-ops/issues/4186)
- [docs] Path stability is deliberate: there are about 100 scripts in a flat repo root because "thousands of fork scripts" depend on the paths — [ARCHITECTURE.md](https://github.com/career-ops-hq/career-ops/blob/main/ARCHITECTURE.md)

### Inferences
- [inference] Copying or porting MIT code into Shortlist needs only the licence and copyright notice kept in the copied files. Calling Shortlist "based on career-ops" is fine under the trademark policy.
- [inference] The churn is very high: about 700 merged PRs a month on a ~180k-line codebase. A hard fork would diverge almost at once, and rebasing a Supabase-based fork onto upstream would be impractical.

### Gaps
- I found no author blog post or video specific to the org move. Release notes and community posts were not read.

## 9. Fork feasibility and what to port

### Takeaway
Do not fork. Build Shortlist as planned and borrow specific modules and prompt rules. career-ops covers maybe 40-50% of Shortlist's features in name: discovery from the same sources, a draft-only email, form answers that never submit, evals and fact checks. Almost every one of those is built on assumptions Shortlist rejects: local Markdown files as the store, a coding CLI as the runtime, text output instead of Gmail drafts, no hosting or auth, one coarse model tier, no spending cap, no phone UI. Turning it into Shortlist would mean replacing the store, the runtime, the UI's security model and the scheduler, which is most of the system. You would then carry ~180k lines you don't use and an upstream you can't merge.

### Cited Findings
- (See sections 1-8 for the evidence behind each line in the table.)

### Inferences
- [inference] What a fork would need to change, by Shortlist requirement:

| Shortlist requirement | career-ops today | Change needed in a fork |
|---|---|---|
| Supabase Postgres/Storage store | Markdown/TSV files + derived `node:sqlite`; doctrine forbids a primary DB | Rewrite every reader/writer (tracker, pipeline, reports, web `lib/core/*`); upstream will never accept it |
| Unattended daily discovery on a free host | `node scan.mjs` via cron on your own machine; web scheduler is Windows-only | Port the scanner to a Supabase Cron / Edge Function; trim `scan.mjs` (5k lines, uses fs paths) |
| Model scoring with provider/model/effort per step | Coding CLI subprocesses + one `spend_tier`; direct evaluators for Gemini/OpenAI-compatible/Ollama/OpenRouter only | New model-gateway layer; prompts in `modes/*.md` assume agent tool access (Read files, Playwright) |
| Gmail drafts with the CV attached | Text for copy-paste; no mail code | New (Gmail API `drafts.create`, MIME, OAuth) |
| Form answers from screenshots + answer bank | Prompt-only; agent reads the image; no structured bank | New vision call + answer-bank table; reuse rules |
| Evals per model, cost per call, monthly cap | 10 scoring-only golden cases, not in CI; token totals; no cap | New |
| Phone review app, Android share target, LinkedIn paste/screenshot | Desktop loopback UI, no auth, no PWA/share target; LinkedIn URLs hit the authwall | New, and the UI's no-login model must be replaced |
| Host independence | Local-only | Already a design goal for Shortlist; career-ops gives no help |

- [inference] Worth porting or reading closely, by priority:
  1. `providers/hackernews.mjs` (185 lines): Algolia lookup by `author_whoishiring`, comment parsing. Port to TS + Zod.
  2. `providers/ashby.mjs` (538 lines): the compensation-tier parsing and `INTERVAL_MULTIPLIERS` annualisation, plus the embed fallback idea. Port the salary part.
  3. `providers/greenhouse.mjs` (280) and `providers/lever.mjs` (133): slug detection (including the Greenhouse embed `?for=`), `content=true`, Lever `allLocations` merge, EU host.
  4. `providers/himalayas.mjs` (129): use it as a shape reference only. Shortlist needs pagination and salary fields it ignores.
  5. `tests/providers/*.test.mjs`: recorded API shapes to turn into Shortlist fixtures.
  6. The location-keyword word-boundary compiler and tier order in `scan.mjs` (`compileLocationKeyword`, `buildLocationFilter`, ~L355-660), and the `country_eligibility_filter` phrase lists. A good base for Shortlist's eligibility rules, with India in `block_hard`.
  7. The `verify-cv-facts.mjs` approach (extract numbers and tool names, check them against the CV, forbidden-phrase config) for Shortlist's email fact-check. Take ideas, not the 142 KB file.
  8. `evals/` harness design (frozen reference labels, replay fixtures, agreement gate) for per-model evals.
  9. Prompt rules: `modes/email.md` (email variants and structure), `modes/apply.md` sensitive-field list and `needs_candidate_confirmation` contract, `modes/oferta.md` Block A work-authorisation tiers and posting-legitimacy signals, `web/src/lib/apply/answer-prompt.mjs`.
  10. `utils/token-tracker.mjs` `normalizeOpenAIUsage` and cached-input costing as a pattern. Its rate table is out of date for current models.
- [inference] Effort: porting items 1-6 is a small job, roughly 1-2 focused days including Zod schemas and tests. A fork-to-Shortlist conversion would be a near-total rewrite of core paths with no realistic upstream sync, so it is strictly worse than the planned build.

### Gaps
- These effort figures are estimates and were not timed.
- I did not check whether any hosted or multi-user fork of career-ops already exists. Some of the 13,957 forks may have tried a database or hosting conversion.
