# Open-source AI job-search and job-application tools: landscape as of October 2026 (excluding MadsLorentzen/ai-job-search)

Method note: All star counts, fork counts, creation and last-push dates, languages, licences and archive flags below come from the authenticated GitHub REST API (`gh api repos/<owner>/<repo>`), queried on 2026-10-14. "Last push" is the API's `pushed_at` value, which approximates the last commit date. Feature descriptions come from each repo's README unless marked "verified in code". Where I read source files, I say so. README statements are the project's own claims and were not tested by running the software.

## Q1. Which projects exist, and how do they compare? (comparison table and profiles)

### Takeaway
The field is now led by one very large project. career-ops (74k stars, MIT, JavaScript with a Next.js web app) does draft-only discovery, scoring, email drafts and form answers, and already has providers for Himalayas, HN "Who is hiring", Greenhouse, Lever and Ashby. Around it sit a group of LinkedIn auto-apply bots that work by browser automation (GodsScion, nicolomantini, wodsuz, beatwad), which Shortlist rules out by design. The original AIHawk repo no longer exists in usable form: the old URL now redirects to an unrelated product with a fresh git history.

### Comparison table (GitHub API, 2026-10-14)

| # | Project | Stars | Last push | Lang / stack | Licence | Data sources and method | Auto-apply / auto-send? | Human review | Email drafts | Form answering | Evals / tests | Status / problems |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | [career-ops-hq/career-ops](https://github.com/career-ops-hq/career-ops) (was santifer/career-ops) | 74,441 | 2026-10-14 | JS (.mjs with `@ts-check`) + Next.js 16 web UI + Go TUI; runs inside Claude Code, Codex, OpenCode and similar | MIT | ~110 provider modules. Public ATS/board APIs (Greenhouse boards-api, Ashby posting-api, Lever api, Himalayas, HN via Algolia, Remotive, RemoteOK, WWR and others), plus DuckDuckGo HTML search queries and Playwright | No. "never POSTs"; "no mail transport anywhere" | Yes, you press Submit | Yes (`/career-ops email`, draft only) | Yes (`/career-ops apply` reads the form and generates answers) | Golden-set eval harness (10 synthetic cases) and a large test suite in CI | Very active; 393 open issues |
| 2 | AIHawk ([feder-cr/Jobs_Applier_AI_Agent_AIHawk](https://github.com/feder-cr/Jobs_Applier_AI_Agent_AIHawk), now redirects to [feder-cr/invisible_dots](https://github.com/feder-cr/invisible_dots)) | 32,028 (inherited by the renamed repo) | 2026-10-13 (new product) | Was Python + Selenium + LLM | Was MIT, later AGPL-3.0 (forks show both) | LinkedIn via browser automation | Yes, auto-applied on LinkedIn | No | No (wrote cover letters and resumes) | Yes (LLM answered Easy Apply questions) | — | **Gone.** Repo renamed; earliest commit in the current history is 2026-09-29; code survives only in forks |
| 3 | [speedyapply/JobSpy](https://github.com/speedyapply/JobSpy) (cullenwatson/ and Bunsly/JobSpy redirect here) | 4,479 | 2026-10-13 | Python library | MIT | Scrapes LinkedIn, Indeed, Glassdoor, ZipRecruiter, Google, Bayt, Naukri, BDJobs, HelloWork, with proxy rotation | n/a (discovery only) | n/a | No | No | mypy and ruff added to CI in Oct 2026 | Active; LinkedIn rate-limits scraping (see below) |
| 4 | [DaKheera47/job-ops](https://github.com/DaKheera47/job-ops) | 4,001 | 2026-10-06 | TypeScript, Docker | **Commons Clause** (not OSI open source; cannot sell or host commercially) | LinkedIn, Indeed, Glassdoor via JobSpy; Adzuna API; Seek via Apify; hiring.cafe, Working Nomads and others | No ("It does not auto-apply") | Yes | No (reads Gmail to detect replies) | No | Not checked | Active |
| 5 | [stickerdaniel/linkedin-mcp-server](https://github.com/stickerdaniel/linkedin-mcp-server) | 3,864 | 2026-10-13 | Python MCP | Apache-2.0 | LinkedIn through your logged-in browser session | Can send connections and messages | Agent-dependent | — | — | — | Active; a PR titled "Stop on a restricted account" shows that account restriction is a real risk |
| 6 | [GodsScion/Auto_job_applier_linkedIn](https://github.com/GodsScion/Auto_job_applier_linkedIn) | 2,930 | 2026-09-11 | Python + Selenium | MIT | LinkedIn via browser automation on your account | Yes (optional `stop_before_submit` dry run) | Optional | No | Yes (fills Easy Apply questions, optional AI) | README mentions tests | Active |
| 7 | [Paramchoudhary/ResumeSkills](https://github.com/Paramchoudhary/ResumeSkills) | 2,698 | 2026-06-19 | Markdown Claude skills (no code) | MIT | — | No | — | — | — | — | Prompt library only |
| 8 | [Gsync/jobsync](https://github.com/Gsync/jobsync) | 1,400 | 2026-10-12 | **TypeScript, Next.js 15, Prisma, Vercel AI SDK 6, next-auth v5**, Docker | MIT | Greenhouse, Lever (handles `lever.co` and `eu.lever.co`) and Ashby public boards, with built-in company directories (1,160+ Lever, 1,860+ Ashby); paste-a-posting | No | Yes (discovered jobs go to an accept/dismiss queue; AI-extracted fields shown on a confirmation card) | No (writes cover letters) | No | Not checked | Active; also exposes an MCP server |
| 9 | [nicolomantini/LinkedIn-Easy-Apply-Bot](https://github.com/nicolomantini/LinkedIn-Easy-Apply-Bot) | 1,155 | 2026-10-07 | Python | Apache-2.0 | LinkedIn browser automation | Yes | No | No | Basic | — | Oldest in the set (created 2018) |
| 10 | [DanielPan12/JobHuntBot](https://github.com/DanielPan12/JobHuntBot) | 860 | 2026-10-12 | JS + agent instructions + Playwright MCP; local HTML dashboard | MIT | Agent-driven browsing | Only with authorization: "Final submission requires authorization" | Yes | No | Yes, with `answer_bank.template.md` and `experience_bank.template.md` | `scripts/` and `tests/` with regression tests | New (created 2026-08); docs are partly in Chinese |
| 11 | [wodsuz/EasyApplyJobsBot](https://github.com/wodsuz/EasyApplyJobsBot) | 831 | 2026-05-18 | Python | NOASSERTION | LinkedIn and Glassdoor browser automation | Yes ("apply automatically") | No | No | Yes (auto-fills extra questions) | — | Less active |
| 12 | [offercontext/offerPilot](https://github.com/offercontext/offerPilot) | 747 | 2026-10-14 | Python | AGPL-3.0 | China-focused workspace | No | — | — | — | — | Mostly interview and offer tooling |
| 13 | [pinloop-ai/pinloop-cli](https://github.com/pinloop-ai/pinloop-cli) | 557 | 2026-10-03 | TypeScript CLI for coding agents | MIT (CLI only; the data comes from their hosted service) | Hosted index of "millions" of postings | No | — | — | — | — | Depends on a third-party service |
| 14 | [elliottdehn/open-jobs](https://github.com/elliottdehn/open-jobs) | 383 | 2026-10-11 | Python + data dump | CC0-1.0 | ~3M jobs from 36 ATS, LLM-enriched | No | — | — | — | — | **Shut down 2026-10-10**; a final ~31 GB dump remains downloadable |
| 15 | [olyaiy/resume-lm](https://github.com/olyaiy/resume-lm) | 331 | 2026-10-14 | **Next.js 15, React 19, Supabase** | AGPL-3.0 | — (resume builder) | No | — | — | — | — | **Archived** (read-only). Earlier versions shipped Supabase demo JWT and service keys as fallbacks (issue #90) |
| 16 | [Anshul439/job-auto-apply](https://github.com/Anshul439/job-auto-apply) | 274 | 2026-10-10 | TypeScript | none | Wellfound and Instahyre | Yes (one-click auto apply) | No | — | — | — | No licence, so it cannot legally be reused |
| 17 | [tarunlnmiit/autopilot-jobhunt](https://github.com/tarunlnmiit/autopilot-jobhunt) | 216 | 2026-09-20 | Python; OpenRouter, Claude CLI or Anthropic API; Telegram | MIT | 130+ company careers pages, fetched through the TinyFish API (third-party key) | No ("Drafts only — never applies") | Yes | Drafts cover letters (not email drafts) | No | `docs/09-testing-checklist.md` | Active |
| 18 | [beatwad/LinkedIn-AI-Job-Applier-Ultimate](https://github.com/beatwad/LinkedIn-AI-Job-Applier-Ultimate) | 173 | 2026-10-09 | Python + Playwright | MIT | LinkedIn and Indeed browser automation | Yes ("Applies to ALL job types") | No | No | Yes | — | Active |
| 19 | [surapuramakhil-org/Job_search_agent](https://github.com/surapuramakhil-org/Job_search_agent) | 171 | 2026-08-07 | Python + Chrome | AGPL-3.0 | Browser automation | Yes ("applies to jobs on your behalf") | — | — | — | README: "testing CI/CD is not working, doing manual testing" | **Archived** |
| 20 | [vaibhavarora14/job-application-agent](https://github.com/vaibhavarora14/job-application-agent) | 156 | 2026-10-14 | JS Agent Skill (npx); optional Cloudflare D1/R2 | MIT | Reviewed `SOURCES.json` catalog plus a community registry | Submits after confirmation (`review-each` mode) | Yes | "stores drafts" for outreach; no automated LinkedIn/X sending | Yes | Deterministic `score` and ledger commands | **Analytics, including name and email, are on by default**, and confirmed applications are shared with a community registry by default |
| 21 | [adrianhajdin/job_pilot](https://github.com/adrianhajdin/job_pilot) (JavaScript Mastery) | 145 | 2026-06-06 | Next.js, GPT-4o, Browserbase + Stagehand, InsForge | none | Authenticated LinkedIn search via a saved Browserbase session; Wellfound; YC Jobs | Experimental auto-submit of LinkedIn Easy Apply | Per-job review page | No | Via Stagehand | — | Tutorial code; no licence |
| 22 | [neonwatty/job-apply-plugin](https://github.com/neonwatty/job-apply-plugin) | 124 | 2026-10-14 | Python Claude Code / Codex plugin | MIT | LinkedIn, HN Who's Hiring, Twitter/X search; visible browser automation | No ("Stops at final review so only you can click Submit") | Yes | No | **Yes**: answers are reused with confirmed / inferred / missing / sensitive states and provenance | README: individual ATS flows "remain unverified and may drift" | Active |
| 23 | [borgius/jobspy-mcp-server](https://github.com/borgius/jobspy-mcp-server) | 118 | 2026-03-13 | JS MCP over JobSpy | none | JobSpy scraping | — | — | — | — | — | No licence; inactive since March |
| 24 | [suxrobGM/jobpilot](https://github.com/suxrobGM/jobpilot) | 91 | 2026-10-07 | **TypeScript, Next.js 16**, runs on a Claude Code or Codex subscription | MIT | LinkedIn, Indeed, Hiring Cafe and others, in a real browser | **Yes**: "Auto-apply" campaigns; Upwork proposal submission | Optional | Drafts recruiter emails and LinkedIn messages; reads Gmail replies | Yes (fills forms in a browser) | Not checked | Active |
| 25 | [alpharomercoma/ts-jobspy](https://github.com/alpharomercoma/ts-jobspy) | 17 | 2026-09-17 | TypeScript port of JobSpy | NOASSERTION | Indeed and LinkedIn scraping (the defaults; other boards are not reliably working) | n/a | n/a | — | — | — | Unclear licence |
| 26 | [shawnmacharia/ai-job-search](https://github.com/shawnmacharia/ai-job-search) | 0 | 2026-10-10 | Python (+ copied TS skill CLIs) | MIT (copyright Mads Lorentzen) | WeWorkRemotely feed, Remotive API, MyJobMag RSS; per-source access decisions | No ("no application submission, and no automatic sending") | Yes, manual review queue | No | No | Its LLM match step "has never produced a usable result" | **A copy of MadsLorentzen/ai-job-search** (see the forks section) |
| 27 | [kohtabeloff/jobforge](https://github.com/kohtabeloff/jobforge) | 4 | 2026-10-12 | JS + Claude Code skills; README in Russian | MIT | Remotive, RemoteOK, WWR, Working Nomads, Indeed, LinkedIn, Wellfound, Greenhouse/Ashby/Lever, Freelancer.com | No ("you apply yourself") | Yes | Writes cover letters | — | — | Tiny; the best match I could find for "jobforge" |

Sources for every row: the GitHub repo URL in column 2. Metadata comes from `https://api.github.com/repos/<owner>/<repo>` and features from each repo's README.

### Cited Findings

**career-ops (the biggest and most relevant project)**
- 74,441 stars, 13,957 forks, last push 2026-10-14, MIT, primary language JavaScript. The API resolves `santifer/career-ops` to `career-ops-hq/career-ops`, so the repo was moved into an organisation. — [GitHub](https://github.com/career-ops-hq/career-ops)
- README positioning: "It tailors your CV and drafts your answers. You press Submit." The "What career-ops will not do" section says it will not "Auto-submit an application. It drafts the answer to every field... The script never POSTs (`prepare-application.mjs`)" and will not "Send an email. Drafts only. There is no mail transport anywhere in this codebase." — [README](https://github.com/career-ops-hq/career-ops)
- Features claimed in the README:
  - A–H evaluation, including a "Work-Auth signal that flags an explicit no-sponsorship JD as a hard blocker" and a posting-legitimacy check.
  - A cover-letter generator with a "draft-in-chat approval gate".
  - An `email` mode that produces "subject line, body, and attachment checklist without sending".
  - An `apply` mode, a "Live application assistant (reads form + generates answers)".
  - A Portal Scanner covering "Ashby, Greenhouse, Lever, Wellfound".
  - A `calibrate` mode that checks whether scores predict real outcomes.
  - An opt-in plugin system ("Gmail, Notion, Apify + a community registry"), disabled by default.
  - A Go terminal dashboard.

  — [README](https://github.com/career-ops-hq/career-ops)
- Verified in code (the repo tree and provider files): the `providers/` folder holds about 110 provider modules, among them `himalayas.mjs`, `hackernews.mjs`, `greenhouse.mjs`, `lever.mjs`, `ashby.mjs`, `remotive.mjs`, `remoteok.mjs`, `weworkremotely.mjs`, `workable.mjs` and `smartrecruiters.mjs`. Endpoints found in the code:
  - Himalayas: `https://himalayas.app/jobs/api?limit=50`
  - HN: `hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring`, then the item API, with a comment parser `parseHnComment`
  - Greenhouse: `boards-api.greenhouse.io/v1/boards/`
  - Ashby: `api.ashbyhq.com/posting-api/job-board/`
  - Lever: `api.lever.co` and `api.eu.lever.co`

  The files use `// @ts-check` with JSDoc types and enforce a trusted hostname and HTTPS. — [himalayas.mjs](https://github.com/career-ops-hq/career-ops/blob/main/providers/himalayas.mjs), [hackernews.mjs](https://github.com/career-ops-hq/career-ops/blob/main/providers/hackernews.mjs), [providers/](https://github.com/career-ops-hq/career-ops/tree/main/providers)
- Verified in code: `scan.mjs` also builds `https://html.duckduckgo.com/html/?q=...` requests for its web-search queries. That is HTML scraping of a search engine, not an official API. — [scan.mjs](https://github.com/career-ops-hq/career-ops/blob/main/scan.mjs)
- Verified in code: `web/package.json` is `@career-ops/web` v0.14.0, using Next.js 16.3.8, React 19.2, Tailwind 4, playwright-core and TypeScript 7.0.2. It has API routes such as `web/src/app/api/apply/fill/route.ts` and `/apply/prefill`. — [web/package.json](https://github.com/career-ops-hq/career-ops/blob/main/web/package.json)
- Verified in code: `evals/README.md` describes a "Golden-set eval for cheap-model routing", "v1" with "10 synthetic cases". Labels are a frozen verdict from a premium model, the metric is "agreement-with-reference, not absolute correctness", and "wiring into CI is still deferred". The CI workflow (`.github/workflows/test.yml`) runs `npm run lint`, `node test-all.mjs --quick` and `go test ./...`. The repo tree has about 837 files matching test-file naming patterns (a filename count, not a test count). — [evals/README.md](https://github.com/career-ops-hq/career-ops/blob/main/evals/README.md)
- The author's claimed results conflict between sources. The README says "740 listings evaluated. 68 applied. 12 interviews. 1 offer." A third-party blog says he "applied to 66" and landed a Head of Applied AI role that came inbound. — [README](https://github.com/career-ops-hq/career-ops); [themenonlab blog](https://themenonlab.blog/blog/career-ops-ai-job-search-claude-code-skill)
- A Product Hunt commenter worried that "one bad filter config and it's applying to roles you excluded" (an opinion, not a verified bug). — [Product Hunt](https://www.producthunt.com/products/santifer-io)
- Derivative projects exist (GitHub API):
  - shuheng-mo/career-ops-china (111 stars)
  - Fighter90/career-ops-ui (82)
  - andrew-shwetzer/career-ops-plugin-do-not-fork-currently-updating-v2- (502)
  - AnojSKunte/career-ops-india (13)
  - outscal/OpenJobs (35)

  — [GitHub search "career-ops"](https://github.com/search?q=career-ops&type=repositories)

**AIHawk (feder-cr)**
- 404 Media reported in October 2024 that a reporter used AIHawk's Auto Jobs Applier to apply to 2,843 LinkedIn roles at about 17 per hour. The tool is Python and uses an LLM (GPT or Gemini) to tailor cover letters and resumes. Creator Federico Elia said it is meant to "balance the use of artificial intelligence in the recruitment process". — [404 Media](https://www.404media.co/i-applied-to-2-843-roles-the-rise-of-ai-powered-job-application-bots/); secondary: [Genbeta](https://www.genbeta.com/inteligencia-artificial/alguien-ha-usado-ia-para-aspirar-a-2-843-puestos-trabajo-solo-tuvo-que-escribir-comando-esperar), [Reworked](https://www.reworked.co/employee-experience/job-candidates-can-now-spam-employers-more-efficiently/)
- Verified via the GitHub API: `feder-cr/Jobs_Applier_AI_Agent_AIHawk`, `feder-cr/Auto_Jobs_Applier_AIHawk` and `AIHawk-FOSS/Auto_Jobs_Applier_AI_Agent` all resolve to `feder-cr/invisible_dots`. That repo was created 2024-08-04 (AIHawk's creation date) and has 32,028 stars and 4,726 forks. It now describes itself as an "Open-source, self-hosted alternative to OpenAI Dots, Grok Bot. Built to be undetectable by anti-bot systems." (TypeScript, MIT). Its oldest commit in the current history is dated 2026-09-29, so the AIHawk history was replaced. — [feder-cr/invisible_dots](https://github.com/feder-cr/invisible_dots)
- The feder-cr account now hosts "invisible_*" anti-detection browser repos: invisible_playwright (3,147 stars), invisible_selenium (3,063), invisible_playwright_mcp (2,769) and invisible_puppeteer (1,415). — [feder-cr on GitHub](https://github.com/feder-cr)
- The most-starred surviving forks date from 2024: pillow34/aihawk (144, MIT, last push 2024-10-02), us/linkedIn_auto_jobs_applier_with_AI_fast (134), Intusar/Auto_Jobs_Applier_AI_Agent (36, AGPL-3.0, 2024-11-27). Forks from late 2024 and 2025 carry AGPL-3.0 and 2024-08/09 forks carry MIT, which suggests a licence change around late 2024. — [forks via GitHub API](https://github.com/feder-cr/invisible_dots/forks)
- No TechCrunch article on AIHawk turned up in my searches.

**JobSpy**
- Verified via the API: speedyapply/JobSpy has 4,479 stars, 887 forks and 25 open issues, MIT. Pushes continued through 2026-10-13, including a v1.3.0 release, HelloWork support, and replacing tls-client with curl_cffi. The old `cullenwatson/JobSpy` and `Bunsly/JobSpy` URLs redirect here. — [GitHub](https://github.com/speedyapply/JobSpy)
- The README advertises "Proxy support to bypass blocking". The PyPI FAQ says a 429 means "you have been blocked by the job board site for sending too many requests". Third-party docs say LinkedIn "usually rate limits around the 10th page with one ip". — [README](https://github.com/speedyapply/JobSpy); [PyPI](https://pypi.org/project/python-jobspy/1.1.54); [mintlify troubleshooting](https://mintlify.wiki/speedyapply/JobSpy/troubleshooting)
- An open JobSpy issue (2026-08-16) asks to add freehire.me as a "public API, no proxy needed" source. — [JobSpy issue #381](https://github.com/speedyapply/JobSpy/issues/381)

**Other notable projects**
- job-ops: "It does not auto-apply. Recruiters can tell when applications are automated and it gets you blacklisted." It "Connects to Gmail and auto-detects interviews, offers, and rejections" and credits JobSpy for its scraping. Its licence is MIT-style plus the Commons Clause ("does not grant to you, the right to Sell the Software"). — [README](https://github.com/DaKheera47/job-ops), [LICENSE](https://github.com/DaKheera47/job-ops/blob/main/LICENSE)
- JobSync's stack, verified in package.json: Next.js ^15.5, Prisma ^6.19, `ai` (Vercel AI SDK) ^6.0, next-auth ^5 beta. Languages are ~4.49 MB TypeScript. Per the README, discovered Greenhouse, Lever and Ashby jobs are "surfaced for review — accept the ones you like... or dismiss the rest". It supports local models through Ollama. — [package.json](https://github.com/Gsync/jobsync/blob/main/package.json), [README](https://github.com/Gsync/jobsync)
- vaibhavarora14/job-application-agent qualifies jobs on "seniority, skills, location, authorization, compensation, and posting status". It also states: "Structured usage analytics and name/email sharing are enabled by default", and "Anonymous community sharing is also enabled by default". — [README](https://github.com/vaibhavarora14/job-application-agent)
- neonwatty/job-apply-plugin covers "Confidence-aware answer reuse: Reuses confirmed non-sensitive answers and flags inferred, missing, or sensitive answers for review", and stops "at final review so only you can click Submit or Send". The README says ATS flows were "reviewed on 2026-07-28" but "remain unverified and may drift". — [README](https://github.com/neonwatty/job-apply-plugin)
- DanielPan12/JobHuntBot: "This is not a one-click auto-apply bot". It ships `answer_bank.template.md` ("Reusable truthful answers for common application questions") and `scripts/ / tests/` ("Data checks and regression tests"). — [README](https://github.com/DanielPan12/JobHuntBot)
- tarunlnmiit/autopilot-jobhunt: "Scans 130+ company careers pages nightly → scores every role against your resume with an LLM → sends you the top matches on Telegram → drafts a tailored resume + cover letter on demand... Drafts only — never applies." Discovery goes through the TinyFish API. — [README](https://github.com/tarunlnmiit/autopilot-jobhunt)
- suxrobGM/jobpilot is "An AI agent that applies to jobs for you... fills out applications in a real browser" (Next.js 16), with "Auto-apply" campaigns and a Gmail reply reader. — [README](https://github.com/suxrobGM/jobpilot)
- olyaiy/resume-lm: "This repository is archived and read-only". Earlier Docker/Helm versions "shipped Supabase's public demo `JWT_SECRET`, `ANON_KEY`, and `SERVICE_ROLE_KEY` as fallbacks (#90)". — [README](https://github.com/olyaiy/resume-lm)
- elliottdehn/open-jobs: "Open Jobs is no longer running" since 10 October 2026; a final ~31 GB export is offered. — [README](https://github.com/elliottdehn/open-jobs)
- stickerdaniel/linkedin-mcp-server: 147 issues or PRs match restriction or blocking keywords, including the PR "fix(auth): Stop on a restricted account" (2026-09-27, closed). — [PR #1147](https://github.com/stickerdaniel/linkedin-mcp-server/pull/1147)
- MCP servers for job search (GitHub API):
  - workopia/workopia-mcp (316, JS, MIT)
  - amikai/openings-mcp (101, Go, MIT, "search job boards and company career sites")
  - borgius/jobspy-mcp-server (118, JS, no licence, last push 2026-03-13)
  - MLS-Tech-Inc/shortlistjobs-mcp (37, TS, MIT; note the name clash with "Shortlist")

  — [GitHub search "job search mcp"](https://github.com/search?q=job+search+mcp&type=repositories)

**Forks and copies of MadsLorentzen/ai-job-search (repo excluded from scope; noted as asked)**
- Verified: shawnmacharia/ai-job-search is **not a GitHub fork** (no parent), but it is a copy:
  - It shares 215 of the 305 file paths in MadsLorentzen/ai-job-search, including `.agents/skills/freehire-search/cli/src/*.ts` and `jobbank-search`.
  - Its LICENSE reads "Copyright (c) 2026 Mads Lorentzen".
  - The oldest commit in its history is a Mads commit ("docs(readme): document the extension model...").
  - It was then reworked into a Kenya-focused, permission-first discovery queue.

  — [shawnmacharia/ai-job-search](https://github.com/shawnmacharia/ai-job-search), [MadsLorentzen/ai-job-search](https://github.com/MadsLorentzen/ai-job-search)
- Most-starred real forks of MadsLorentzen/ai-job-search (46,694 stars, 16,145 forks): youngledo/ai-job-search-cn (38), davicalvarenga/ai-job-search (22), hahaha375/ai-job-search-auto-scraper (17), p3ji/ai-job-search-ca (10), andreadorizza/ai-job-search-italy (8), anjolok1997/ai-job-search-uk (5). These are mostly country localisations. — [forks via GitHub API](https://github.com/MadsLorentzen/ai-job-search/forks)
- None of the other 21 READMEs I downloaded mention "AIHawk", "MadsLorentzen" or "ai-job-search" (grep over the README text).

### Inferences
- Shortlist's no-LinkedIn-automation rule removes about half the popular projects at once: AIHawk and its forks, GodsScion, nicolomantini, wodsuz, beatwad, stickerdaniel's LinkedIn MCP, JobSpy's LinkedIn scraper, and adrianhajdin/job_pilot.
- Draft-only, human-presses-Submit design has become the norm among newer (2026) projects: career-ops, job-ops, autopilot-jobhunt, neonwatty, JobHuntBot, shawnmacharia. The 2023-2024 generation auto-submitted.
- AIHawk should be treated as dead for reuse. The surviving forks are from 2024, the code is Selenium-on-LinkedIn, and later forks carry AGPL.
- "jobforge" does not name any notable project. The user may have meant a commercial product or a different name; kohtabeloff/jobforge (4 stars) is the closest match.
- AGPL projects (resume-lm, offerPilot, surapuramakhil, later AIHawk forks) are risky to copy code from if Shortlist is ever shared or hosted. MIT projects (career-ops, JobSync, JobSpy, neonwatty, JobHuntBot, autopilot-jobhunt) are safe to borrow from with attribution. job-ops (Commons Clause) and repos with no licence (adrianhajdin/job_pilot, Anshul439, borgius) cannot be copied freely.

### Gaps
- I did not run any of these tools. Ban rates, scraper breakage and the quality of outputs come from READMEs and issue titles only.
- I found no GitHub issues on the auto-apply repos that clearly report a LinkedIn ban. Keyword searches on GodsScion, nicolomantini, wodsuz and beatwad returned 0-2 unrelated hits. That is absence of evidence in issues, not evidence of safety.
- I could not confirm when or why feder-cr replaced AIHawk with invisible_dots. The web search found no announcement, and a Wayback Machine check was rate-limited (HTTP 429).
- No Hacker News or Reddit threads (r/cscareerquestions, r/SideProject) about these tools came up in my searches. Community sentiment is therefore missing, apart from Product Hunt comments.
- Whether career-ops's Gmail plugin creates Gmail drafts (rather than reading mail) was not verified, nor whether it has a hard monthly LLM cost cap (`docs/RUNNING_ON_A_BUDGET.md` exists but I did not read it).
- Which database JobSync's Prisma setup uses was not checked.

## Q2. Which projects are TypeScript/Next.js, or have parts directly reusable in TypeScript?

### Takeaway
The most reusable code for Shortlist is in career-ops (MIT). It has small, self-contained, type-checked JavaScript provider modules for the exact sources Shortlist plans to use: Himalayas, HN via Algolia, Greenhouse, Lever and Ashby. It also has a Next.js 16 web app with form-fill API routes. JobSync (MIT, Next.js 15, Prisma, Vercel AI SDK) is the best reference for a full TypeScript app with an accept/dismiss discovery queue.

### Cited Findings
- career-ops providers are ES modules with `// @ts-check` and JSDoc `@typedef` imports from `./_types.js`. They export pure parse functions such as `parseHimalayasResponse(json)` and `parseHnComment(text, threadUrl)`, which return `{title, url, company, location, postedAt?}`. The repo also has `providers/ADDING_A_PROVIDER.md` and shared helpers (`_http.mjs`, `_safe-url.mjs`, `_ip-guard.mjs`, `_country.mjs` for ISO-code-to-name lookups). — [providers/](https://github.com/career-ops-hq/career-ops/tree/main/providers)
- Verified in code: the Himalayas provider fetches one page (`limit=50`) and leaves the "title_filter / location_filter" to `scan.mjs` to apply locally. — [himalayas.mjs](https://github.com/career-ops-hq/career-ops/blob/main/providers/himalayas.mjs)
- career-ops `web/` is a Next.js 16.3.8 / React 19 / TypeScript app with `/api/apply/{fill,prefill,drive,close}` routes. — [web/](https://github.com/career-ops-hq/career-ops/tree/main/web)
- JobSync: Next.js 15, Prisma 6, Vercel AI SDK 6, next-auth 5, MIT. Greenhouse, Lever and Ashby discovery with company directories, an AI chat with tool calling, and an MCP endpoint at `/api/mcp`. — [Gsync/jobsync](https://github.com/Gsync/jobsync)
- job-ops is ~6.4 MB of TypeScript, but it is under the Commons Clause and does its scraping through Python JobSpy. — [DaKheera47/job-ops](https://github.com/DaKheera47/job-ops)
- suxrobGM/jobpilot (Next.js 16, MIT) is an auto-apply design, but it has a Gmail reply reader and outreach drafting in TypeScript. — [suxrobGM/jobpilot](https://github.com/suxrobGM/jobpilot)
- olyaiy/resume-lm (Next.js 15 + Supabase, AGPL, archived) is the only Next.js + Supabase project in the set. It also shows a Supabase security pitfall: default demo keys shipped as fallbacks. — [olyaiy/resume-lm](https://github.com/olyaiy/resume-lm)
- TypeScript ports of JobSpy are alpharomercoma/ts-jobspy (17 stars, NOASSERTION licence, Indeed and LinkedIn by default) and DaKheera47/jobspy-node (5 stars, MIT, created and last pushed 2026-02-25). Both scrape, so they do not fit Shortlist's permitted-API rule. — [ts-jobspy](https://github.com/alpharomercoma/ts-jobspy), [jobspy-node](https://github.com/DaKheera47/jobspy-node)
- pinloop-cli (TS, MIT) and workopia-mcp (JS, MIT) are thin clients for hosted services. — [pinloop-cli](https://github.com/pinloop-ai/pinloop-cli), [workopia-mcp](https://github.com/workopia/workopia-mcp)
- Other TypeScript projects: Anshul439/job-auto-apply (TS, no licence, Wellfound and Instahyre auto-apply), adrianhajdin/job_pilot (Next.js, no licence) and MLS-Tech-Inc/shortlistjobs-mcp (TS, MIT, 37 stars). — GitHub API ([Anshul439](https://github.com/Anshul439/job-auto-apply), [job_pilot](https://github.com/adrianhajdin/job_pilot))

### Inferences
- Porting career-ops's five relevant providers to TypeScript should take little work, because they are already type-checked JS with pure parse functions. Keeping MIT attribution is enough. This would save Shortlist from writing its own HN comment parser and handling Lever's EU and US endpoints.
- None of the projects has a Supabase-based design worth forking whole. Shortlist's Supabase + Gmail-drafts + cost-cap combination would still be new code.
- neonwatty's answer-provenance model (confirmed / inferred / missing / sensitive) is a design worth copying for Shortlist's answer bank, even though the code is Python.

### Gaps
- I did not read career-ops's `_types.js` Provider interface or `scan.mjs`'s location_filter logic in detail. Whether it can express "open to Pakistan, exclude India-only" without changes is unverified.
- I did not check whether JobSync's discovery runs on a schedule or whether its scoring uses an LLM or keyword matching. The README mentions "a fast local" ranking step but the text was truncated.

## Q3. Notable YouTube videos (2025-2026) showing people building AI job-search agents

### Takeaway
The most-viewed "I built an AI job agent" videos from 2025-2026 are mostly no-code n8n builds: they scrape LinkedIn through Apify, filter with GPT-4o and rewrite resumes. Their workflow files are gated behind Skool or lead-capture links, not public GitHub repos. Only a few have public code: JavaScript Mastery's JobPilot, Mayank Joshi's Claude skill, and Eric Tech's use of browser-use/web-ui.

### Cited Findings
Dates are the YouTube `publishDate` fields and view counts were captured 2026-10-14, both read from the video pages.

**Videos with public code**
- **JavaScript Mastery, "How Senior Engineers Actually Build with AI in 2026 | Build a Full Stack Job Applications Platform"** (2026-06-06, ~214k views, ~2h56m). Builds "JobPilot", a full-stack AI job application platform, using InsForge, Browserbase and PostHog. The description links a "Video Kit (Code, Prompts)". The code is public at [adrianhajdin/job_pilot](https://github.com/adrianhajdin/job_pilot) (145 stars, no licence; README: Next.js, GPT-4o, Browserbase/Stagehand, authenticated LinkedIn discovery, experimental Easy Apply auto-submit). The README's "tutorial" link points to a different video (XUkNR-JfHwo, a 2025 LMS SaaS course). — [YouTube 9dKA2hq4vf0](https://www.youtube.com/watch?v=9dKA2hq4vf0)
- **Mayank Joshi, "I Automated My Job Search Using AI | Step by Step with Live Demo | Find Jobs and Auto Apply"** (2026-08-16, ~117k views). A "custom Claude skill that searches 12+ job platforms" (Naukri, LinkedIn, Instahyre, Cutshort, Hirist, Indeed, Foundit, Glassdoor), scores matches, and writes a tailored resume and cover letter for each. Code: [mayankjoshii/claude-job-skill](https://github.com/mayankjoshii/claude-job-skill) (98 stars, no licence). — [YouTube V_OlWyt8g7I](https://www.youtube.com/watch?v=V_OlWyt8g7I)
- **Eric Tech, "How I Automated My LinkedIn Job Hunt with BrowserUse + AI"** (2025-04-05, ~70k views). Uses BrowserUse with OpenRouter (free DeepSeek) to "Apply to LinkedIn jobs automatically" and message recruiters. Uses the public [browser-use/web-ui](https://github.com/browser-use/web-ui) (16,613 stars, MIT). — [YouTube dmMMsq8Sp8s](https://www.youtube.com/watch?v=dmMMsq8Sp8s)
- **Singh in USA, "This Tool solves Job Applications (100s in ONE Shot)!!"** (2026-04-06, ~64k views). Covers santifer's career-ops. — [YouTube KNrBqIky8Qo](https://www.youtube.com/watch?v=KNrBqIky8Qo)
- **Sai Vignesh Golla (GodsScion), "Auto Job Applier Demo"** (2024-03-01, ~65k views; older than the window). A demo of the public GodsScion LinkedIn auto-applier. — [YouTube gMbB1fWZDHw](https://www.youtube.com/watch?v=gMbB1fWZDHw)

**No-code n8n or Claude builds, with templates behind gates**
- **Michele Torti, "I Built an AI System That Automates My Job Applications (n8n tutorial)"** (2025-11-01, ~144k views). Scrapes "100s of LinkedIn job postings using Apify", uses GPT-4o in n8n to check relevance, and writes a customised resume per job. The free n8n template sits behind a lead-capture link. — [YouTube lq8OaM-SeJo](https://www.youtube.com/watch?v=lq8OaM-SeJo)
- **Nick Saraev, "watch me apply to 1000+ jobs in minutes with AI"** (2025-06-21, ~118k views). A "no code AI job application system that scrapes job listings, filters them, customizes resumes, finds decision maker emails, and drafts personalized outreach". Templates are in a paid Skool community. This is the one video I found that drafts outreach emails. — [YouTube ntSbFUQZHJ0](https://www.youtube.com/watch?v=ntSbFUQZHJ0)
- **Jono Catliff, "Automate Your Job Search Using AI (Indeed, LinkedIn, ZipRecruiter)"** (2025-10-12, ~111k views). n8n plus ChatGPT nodes; blueprints in a free Skool classroom. The pinned description has a bug fix for an n8n ChatGPT-node update. — [YouTube LIzZRgfW4ok](https://www.youtube.com/watch?v=LIzZRgfW4ok)
- **Website Learners, "How I Automated My Entire Job Search with n8n (Step-by-Step)"** (2025-10-14, ~100k views). n8n + Apify + OpenAI + Google Sheets, with a shared Sheet template. — [YouTube t2rm66G8NRc](https://www.youtube.com/watch?v=t2rm66G8NRc)
- **Vishal Manocha, "I Got 5 Interview Calls in 1 Week Using Claude AI + Apify"** (2026-06-28, ~124k views). Claude Desktop + Apify; no code; promotes a masterclass. — [YouTube h07t1nr0TQo](https://www.youtube.com/watch?v=h07t1nr0TQo)
- **Akshat Bahety, "I Automated 1,000 Job Applications With AI"** (2025-08-01, ~10k views). Spreadsheet-based workflow; template sold on Gumroad. — [YouTube gwVs5RbUsTQ](https://www.youtube.com/watch?v=gwVs5RbUsTQ)

**Other results**
- AIHawk-era tutorials (The Sage, ~77k views; Fahd Mirza, with Ollama) show "2y ago", so they are outside the window. — [YouTube search results, "AIHawk auto apply"](https://www.youtube.com/results?search_query=AIHawk+auto+apply)
- The highest-view result for "AI job application agent" is a commercial ad: "How I Apply to 1000+ Jobs on Autopilot (AI Apply Demo)" by AIApply (~2.9M views, "11mo ago"). It is not open source. — [YouTube 6KMadqoPIpo](https://www.youtube.com/watch?v=6KMadqoPIpo)
- Codebasics ran "Build Your First AI Agent - Job Search Automation with N8N" live events in August 2025. — [codebasics.io](https://codebasics.io/event/build-your-first-ai-agent-job-search-automation-with-n8n)

### Inferences
- The YouTube genre mostly pushes volume ("1000+ jobs") and LinkedIn scraping through Apify. Shortlist's eligibility-first, low-volume, never-automate-LinkedIn design runs against the popular approach, which helps it stand out as a portfolio piece.
- None of these videos uses Supabase or does eligibility filtering by country. Nick Saraev's is the only one that drafts emails, and it does not write Gmail drafts specifically (as far as the description says).

### Gaps
- No YouTube video turned up that builds a LangGraph job agent specifically. Searches returned only generic LangGraph courses.
- I read video descriptions, not the videos themselves. Stack details come from the descriptions.
- The AIApply video's exact publish date was not fetched ("11mo ago" relative to 2026-10-14, so about November 2025).

## Q4. Does any project already combine several Shortlist features (discovery + eligibility filter + email drafts + human review)?

### Takeaway
Yes. career-ops covers the most: permitted-API discovery from Shortlist's planned sources, local location and title filters, a work-authorisation blocker, LLM scoring, draft-only application emails, form-answer generation with you pressing Submit, and a golden-set eval. It differs from Shortlist in being file-based, run from an AI coding CLI, and built around Claude Code/Codex sessions rather than a Supabase web app with a cost cap. No project matches Shortlist's specific eligibility rules (open to Pakistan, exclude India-only roles, USD 2,500/month floor), its paste-or-screenshot LinkedIn post capture, or its Gmail drafts.

### Cited Findings
- **career-ops** against Shortlist's features (a) to (g):
  - Discovery (b): Himalayas, HN, Greenhouse, Lever and Ashby providers verified in code.
  - Eligibility (c): `location_filter`/`title_filter`, plus "a Work-Auth signal that flags an explicit no-sponsorship JD as a hard blocker".
  - LLM scoring (d): 1-5 / A-H evaluation.
  - Email drafts (e): "Formal application email drafts... without sending, submitting, or clicking anything".
  - Form answers (f): `apply` mode "reads form + generates answers"; "The script never POSTs".
  - Evals (g): `eval-golden.mjs` and `calibrate`.
  - Paste-in capture (a): "Paste a job URL or JD text to trigger auto-pipeline".

  — [README](https://github.com/career-ops-hq/career-ops), [providers](https://github.com/career-ops-hq/career-ops/tree/main/providers), [evals/README.md](https://github.com/career-ops-hq/career-ops/blob/main/evals/README.md)
- **vaibhavarora14/job-application-agent** covers discovery from a reviewed source catalog, qualification on "location, authorization, compensation", "stores drafts", `review-each` mode, and answer handling. However, it submits applications after confirmation and turns on name and email analytics by default. — [README](https://github.com/vaibhavarora14/job-application-agent)
- **tarunlnmiit/autopilot-jobhunt** covers nightly discovery (careers pages through the TinyFish API), LLM scoring from 0 to 100, Telegram alerts and draft-only cover letters and resumes. It has no eligibility logic beyond the score and no email drafts. — [README](https://github.com/tarunlnmiit/autopilot-jobhunt)
- **JobSync** covers Greenhouse, Lever and Ashby discovery, an accept/dismiss review queue, AI matching and cover letters in a Next.js app. It has no email drafts and no form answering. — [README](https://github.com/Gsync/jobsync)
- **shawnmacharia/ai-job-search** (a Mads copy) matches Shortlist's philosophy most closely: "Access is decided before anything is fetched" for each source (robots.txt and terms), country eligibility (Kenya), a manual review queue, "no automatic sending". Its LLM matching never worked ("Three controlled trials against a local llama3.2 model... produced nine requests and zero assessments"). It has 0 stars. — [README](https://github.com/shawnmacharia/ai-job-search)
- **DanielPan12/JobHuntBot** and **neonwatty/job-apply-plugin** cover form answering with an answer bank plus a human-submit gate. They do not draft emails. — [JobHuntBot](https://github.com/DanielPan12/JobHuntBot), [job-apply-plugin](https://github.com/neonwatty/job-apply-plugin)
- **job-ops** covers multi-board discovery (scraping), a visa sponsorship check, no auto-apply, and Gmail reply tracking. Its licence (Commons Clause) and scraping approach conflict with Shortlist's rules. — [README](https://github.com/DaKheera47/job-ops)

### Inferences
- Recommendation for the report writer to weigh: **borrow from career-ops rather than fork it.** Forking would mean taking on a 2,400-file, CLI-agent-centred, file-based system, while Shortlist targets Supabase, Gmail drafts and a cost cap. The pieces worth taking (MIT, with attribution) are:
  - the Himalayas, HN, Greenhouse, Lever and Ashby provider modules
  - the HN comment parser
  - the "never POSTs, no mail transport" boundary as a design rule
  - the golden-set eval pattern (frozen reference labels, agreement metric) for Shortlist's evals
  - possibly prompt and rubric ideas from `modes/*.md` (evaluation, email, apply)
- Secondary borrow targets: JobSync for Next.js app patterns (Vercel AI SDK tool-calling chat, accept/dismiss queue, company directories for Greenhouse/Lever/Ashby); neonwatty and JobHuntBot for answer-bank provenance states; shawnmacharia (as Mads-derived MIT code) for the per-source "access decision" registry idea.
- Shortlist's distinctive features have no open-source equivalent that I found: Pakistan-specific eligibility with India exclusion, a USD pay floor, screenshot-based LinkedIn post capture, real Gmail drafts through the Gmail API, and a monthly LLM cost cap.

### Gaps
- I did not verify whether career-ops's `location_filter` supports exclude rules (for example "India only"). Pay-floor filtering in career-ops was also not verified; the README mentions "comp research" in the evaluation but not a hard floor.
- No project was tested end-to-end. All capability claims about combinations come from READMEs, plus the code checks noted above.
