# Reusable open-source building blocks and datasets for Shortlist (as of 2026-10-14)

How to read the tags:
- **[V-API]**: verified by me on 2026-10-14 against the GitHub REST API, npm registry, PyPI or the Hugging Face API (stars, last push, licence, archived flag).
- **[V-LIVE]**: verified by calling the live endpoint on 2026-10-14.
- **[V-DOC]**: read directly in the primary doc or README.
- **[SECONDARY]**: from a search-result summary or a third-party page that I did not open in full. Treat these as claims.

"Last push" is the GitHub `pushed_at` date. A repo with no LICENSE file is under default copyright (all rights reserved), which is flagged as **NO LICENCE**.

## 1. Company and ATS board-identifier lists (Greenhouse, Lever, Ashby, SmartRecruiters)

### Takeaway
The most useful source is **Feashliaa/job-board-aggregator** (MIT, updated daily). It ships plain JSON arrays of ATS slugs: 8,333 Greenhouse board tokens, 4,368 Lever slugs, 3,161 Ashby board names and 12,884 Workday tenants. These lists are not filtered for remote work. The large remote-company lists (remoteintech, established-remote, awesome-remote-job) give company names and careers URLs but no ATS slugs, and two of them have no licence. No GitHub list of SmartRecruiters ids turned up.

### Cited Findings
- **Feashliaa/job-board-aggregator**: ★167, last push 2026-10-13, **MIT**, not archived. "Job board aggregator indexing 1,000,000+ active positions from 20,000+ companies across Greenhouse, Lever, Ashby, BambooHR, iCIMs, Paylocity, and Workday." [V-API] — [GitHub](https://github.com/Feashliaa/job-board-aggregator)
  - I downloaded and counted the files under `data/` [V-API]:
    - `greenhouse_companies.json`: 8,333 tokens, e.g. `"0x"`, `"1047games"`.
    - `lever_companies.json`: 4,368 slugs, e.g. `"15five"`.
    - `ashby_companies.json`: 3,161 names, e.g. `"11x"`.
    - `workday_companies.json`: 12,884 entries in the form `tenant|wdN|site`.
    - The folder also has `bamboohr_`, `icims_` and `paylocity_companies` lists, a `data/salary/salary_lookup.json` (4 MB) and a 29 MB `locations.json` geolocation lookup. — [GitHub data dir](https://github.com/Feashliaa/job-board-aggregator/tree/main/data)
  - The README says a daily GitHub Actions run scrapes all seven ATS APIs. Worker counts are tuned per platform: "50 for Workday, 30 for Greenhouse/Lever/iCIMs, 10 for BambooHR, and 5 for Ashby/Paylocity (the tightest limiters)". Jobs older than 30 days are pruned. [V-DOC] — [README](https://github.com/Feashliaa/job-board-aggregator#readme)
  - The scraped jobs are force-pushed to a separate repo, `Feashliaa/job-board-data`, as gzipped chunks. That repo keeps no history. [V-DOC] — [GitHub](https://github.com/Feashliaa/job-board-data)
- **remoteintech/remote-jobs**: ★40,886, last push 2026-10-01, not archived. The licence file says **ISC** for the project, plus MIT and SIL for bundled components. GitHub reports NOASSERTION. The repo has 887 files under `src/companies/` (one profile per remote-friendly company). It describes itself as "a community-maintained directory of remote-friendly tech companies". [V-API] — [GitHub](https://github.com/remoteintech/remote-jobs)
- **yanirs/established-remote**: ★8,971, last push 2026-07-23, **NO LICENCE**. About 78 rows in the README table. It is limited to "established" companies (50+ employees, well-funded or profitable). It excludes companies "that limit their hiring of engineers to a small set of rich countries", so it leans towards companies that hire globally. It has a "Globally-competitive compensation?" column and careers links. The README carries an affiliate link to Remote Rocketship. [V-API, V-DOC] — [GitHub](https://github.com/yanirs/established-remote)
- **lukasz-madon/awesome-remote-job**: ★49,459, last push 2026-09-21, **NO LICENCE** (GitHub licence API returns 404). It has a `Companies with "remote DNA"` section (README lines ~296–531) and sections for job boards and aggregators. [V-API] — [GitHub](https://github.com/lukasz-madon/awesome-remote-job)
- **SimplifyJobs/New-Grad-Positions**: ★18,220, last push 2026-10-14, **NO LICENCE**. It is a new-grad role list and not specific to remote work. [V-API] — [GitHub](https://github.com/SimplifyJobs/New-Grad-Positions)
- **simpixelated/remote-companies-list** (600+ companies) is **ARCHIVED** (last push 2019-08-28, ★9). [V-API] — [GitHub](https://github.com/simpixelated/remote-companies-list)
- **YvetteZheng0812/ats-job-scraper**: MIT, ★3, last push 2026-09-02, Python. It covers 7 ATS platforms including SmartRecruiters. It ships `discovered_slugs.example.json`, a 131-byte example file rather than a full list. [V-API] — [GitHub](https://github.com/YvetteZheng0812/ats-job-scraper)
- No ATS vendor publishes a directory of its customers, and board tokens go stale because companies "adopt Greenhouse, leave it, rename their board and get acquired". [SECONDARY] — [jobspipe.dev](https://jobspipe.dev/blog/greenhouse-api-for-many-companies)
- Commercial alternatives exist:
  - jobspipe.dev publishes "companies using Ashby/Lever/Greenhouse" pages (about 2,000 Ashby orgs claimed). [SECONDARY] — [jobspipe.dev company lists](https://jobspipe.dev/companies-using)
  - Paid Apify actors claim bundled lists, e.g. "7,500 boards". [SECONDARY] — [Apify](https://apify.com/webdata_labs/greenhouse-lever-ashby-jobs-scraper.md)
  - These are paid tools, and I did not confirm whether their data can be exported or reused.

### Inferences
- Practical path for Shortlist:
  1. Seed the `company_boards` table from Feashliaa's MIT JSON files. Keep the MIT notice.
  2. Join those slugs against company names from remoteintech (ISC) or established-remote to prioritise remote-friendly companies.
  3. Re-verify each slug with a cheap GET to the public endpoint before use, and mark dead slugs.
- Using established-remote and awesome-remote-job as hand-reading references is fine, but don't vendor their text into the repo, because they have no licence. Company names themselves are facts.
- established-remote's "hires globally" filter fits Shortlist's "open to Pakistan" rule better than the other lists do.

### Gaps
- I found no maintained public list of SmartRecruiters company identifiers.
- No list I found is pre-filtered for "remote and open to Pakistan".
- I did not check how many Feashliaa slugs are currently live, or whether its company lists are refreshed or just accumulated.

## 2. Open-source connectors for the job sources (Himalayas, HN, Greenhouse, Lever, Ashby, SmartRecruiters, RemoteOK, Remotive, Jobicy)

### Takeaway
There is no maintained TypeScript client library for any of these sources. The official public endpoints are simple JSON GETs, so a thin hand-written fetcher with Zod schemas per source is the realistic approach. Python repos (Feashliaa, GetAnything-1, YvetteZheng0812) are useful as reference implementations. The official MCP servers from Himalayas and Jobicy (both MIT) are the only vendor-maintained code.

### Cited Findings

**Himalayas**
- Endpoints:
  - Browse: `https://himalayas.app/jobs/api`. It uses cursor pagination (`nextCursor`), and offset paging is deprecated.
  - Search: `https://himalayas.app/jobs/api/search`. Parameters include `q`, `country` (ISO alpha-2 or name), `worldwide`, `exclude_worldwide`, `seniority`, `employment_type`, `company`, `timezone`, `sort` and `page`.
  - [V-DOC] — [Himalayas API docs](https://himalayas.app/api)
- Limits: at most 20 records per request. Requests are rate-limited (HTTP 429), and data is cached every 24 hours. The API sends no CORS header, so calls must go through a backend. [V-DOC] — [Himalayas API docs](https://himalayas.app/api)
- Job fields:
  - `locationRestrictions`: an array of countries where candidates must be located.
  - `timezoneRestriction`: timezones. The FAQ calls it `timezoneRestrictions`, so check the field name against the OpenAPI spec.
  - Salary: `minSalary`, `maxSalary`, `salaryPeriod` (hourly, weekly, fortnightly, monthly or annual) and `currency`.
  - [V-DOC] — [Himalayas API docs](https://himalayas.app/api)
- Terms:
  - "please link back to the URL found on Himalayas AND mention Himalayas as the original source"
  - "Please do not submit Himalayas jobs to third-party websites" (Jooble, Google Jobs, LinkedIn and others)
  - The page says the API can "feed AI agents and automation workflows".
  - [V-DOC] — [Himalayas API docs](https://himalayas.app/api)
- **Himalayas-App/himalayas-mcp**: official, **MIT**, ★21, last push 2026-08-06. "Remote jobs MCP server — search 100,000+ remote jobs…" [V-API] — [GitHub](https://github.com/Himalayas-App/himalayas-mcp)

**Greenhouse, Lever and Ashby (public job-board endpoints)** [V-LIVE]
- Greenhouse: `GET https://boards-api.greenhouse.io/v1/boards/gitlab/jobs` returned 215 jobs. Fields: `absolute_url, application_deadline, company_name, data_compliance, first_published, id, internal_job_id, language, location, metadata, requisition_id, title, updated_at`. The default response has no salary field. — [Greenhouse endpoint](https://boards-api.greenhouse.io/v1/boards/gitlab/jobs)
- Lever: `GET https://api.lever.co/v0/postings/15five?mode=json` returned fields including `salaryRange`, `salaryDescription`, `workplaceType`, `country`, `categories` and `applyUrl`. — [Lever endpoint](https://api.lever.co/v0/postings/15five?mode=json)
- Ashby: `GET https://api.ashbyhq.com/posting-api/job-board/ramp?includeCompensation=true` returned 162 jobs. Fields include `compensation`, `isRemote`, `workplaceType`, `location`, `secondaryLocations`, `address`, `shouldDisplayCompensationOnJobPostings` and `applyUrl`. — [Ashby endpoint](https://api.ashbyhq.com/posting-api/job-board/ramp?includeCompensation=true)

**SmartRecruiters**
- `GET https://api.smartrecruiters.com/v1/companies/{id}/postings` returned `totalFound: 0` for both `Visa` and `smartrecruiters`. Either the identifiers are wrong or access differs, so this is **unverified**. [V-LIVE] — [SmartRecruiters endpoint](https://api.smartrecruiters.com/v1/companies/smartrecruiters/postings?limit=1)
- The repos I found are stale:
  - roksela/smartrecruiters-python-client: MIT, ★3, last push 2017-07-08.
  - davejcameron/smartrecruiters: MIT, ★1, last push 2021.
  - [V-API] — [GitHub](https://github.com/roksela/smartrecruiters-python-client)

**Multi-ATS reference scrapers (Python)**
- **GetAnything-1/ats-jobs-scraper**: MIT, ★0, last push 2026-07-10. Covers Greenhouse, Lever, Ashby (titles, locations, type), SmartRecruiters and Workday. Its README has a section titled "The endpoints, if you'd rather roll your own". It is also published as an Apify actor. [V-API, V-DOC] — [GitHub](https://github.com/GetAnything-1/ats-jobs-scraper)
- **Babak-hasani/company-career-scraper**: MIT, ★5, last push 2026-03-29. Queries Greenhouse, Lever, Ashby and others. [V-API] — [GitHub](https://github.com/Babak-hasani/company-career-scraper)
- **speedyapply/JobSpy**: ★4,479, **MIT**, last push 2026-10-13, PyPI `python-jobspy` 1.3.0. It scrapes LinkedIn, Indeed, Glassdoor, ZipRecruiter, Bayt, Naukri and others. These are not "permitted sources" under Shortlist's rules, so it is listed for awareness only. [V-API] — [GitHub](https://github.com/speedyapply/JobSpy)

**RemoteOK**
- `GET https://remoteok.com/api` returned 99 jobs. Fields: `apply_url, company, date, description, location, position, salary_min, salary_max, tags, url`, among others.
- The first array element holds the terms: "Please link back (with follow, and without nofollow!) to the URL on Remote OK and mention Remote OK as a source… Please don't use the Remote OK logo without written permission."
- [V-LIVE] — [RemoteOK API](https://remoteok.com/api)
- Client repos are toys. The largest is igorer88/remoteok-api-fetcher (MIT, ★10, last push 2026-02-14). [V-API] — [GitHub](https://github.com/igorer88/remoteok-api-fetcher)

**Remotive**
- Endpoint: `GET https://remotive.com/api/remote-jobs` (parameters include `limit`).
- Terms:
  - "Please do not submit Remotive jobs to third Party websites…"
  - "Please link back to the URL found on Remotive AND mention Remotive as a source… If you don't do that, we'll terminate your API access"
  - "Jobs displayed are delayed by 24 hours"
  - "Displaying our jobs in order to collect signups/email addresses… constitutes a breach"
  - Rate guidance: "max. 4 times a day", and more than 2 requests per minute is blocked.
- [V-DOC] — [remotive-com/remote-jobs-api README](https://github.com/remotive-com/remote-jobs-api)
- The docs repo is stale: ★84, **NO LICENCE**, last push 2022-04-02. [V-API]

**Jobicy**
- **Jobicy/remote-jobs-api**: official, **MIT**, ★8, last push 2026-10-01. Contains the docs, an OpenAPI spec (`openapi.json`/`yaml`), MCP, RSS and WordPress tools. [V-API] — [GitHub](https://github.com/Jobicy/remote-jobs-api)
- API: `GET https://jobicy.com/api/v2/remote-jobs` with `count` (1–200), `cursor`, `geo` (an eligibility slug such as `usa`, `europe`, `apac`, `anywhere`), `industry` and `tag`. The feed only covers the last **7 days**. Cursors expire after 24 hours. Public requests need no authentication, and there is a paid Commercial tier. [V-DOC] — [README](https://github.com/Jobicy/remote-jobs-api)
- Other official repos: Jobicy/remote-jobs-mcp-server (MIT, ★2, last push 2026-10-03) and Jobicy/jobicy-api-examples (MIT, includes Node.js and Next.js examples, last push 2026-10-01). [V-API] — [GitHub](https://github.com/Jobicy/jobicy-api-examples)

### Inferences
- Remotive's 24-hour delay and its ban on "collecting signups" make no difference for a single-user private tool. Its link-back attribution rule is about public display. For Shortlist, keep the source URL on each job and show "via Remotive", "via Himalayas" and so on in the UI. That is cheap insurance.
- Ashby's `includeCompensation=true` and Lever's `salaryRange` give structured pay. Greenhouse's default response does not, so pay for Greenhouse jobs will often need LLM extraction from the description.
- Jobicy's `geo=anywhere` and Himalayas' `worldwide` and `country=PK` filters can do first-pass eligibility filtering on the server before any LLM call.

### Gaps
- I found no npm package that wraps any of these job APIs in TypeScript and is maintained.
- The SmartRecruiters public postings endpoint returned zero results for the identifiers I tried, so it is not confirmed working.
- I did not find Jobicy's attribution or terms-of-use text in its README.
- Remotive's current live terms were not checked beyond the GitHub README, which was last pushed in 2022.

## 3. Parsers and datasets for HN "Who is hiring"

### Takeaway
One recent MIT project, **MaxwellVolz/hn_whos_hiring** (last push 2026-10-02), does almost exactly Shortlist's HN pipeline: it scores every post against a resume, extracts salary and location, drafts emails as Gmail drafts with the resume attached, and pre-fills application forms. Older HN parsers are small and stale. A large tagged dataset exists from Cotera (CC BY 4.0, which requires attribution), but I did not verify it directly.

### Cited Findings
- **MaxwellVolz/hn_whos_hiring**: **MIT**, ★11, last push 2026-10-02, Python, "No dependencies", runs on Claude Code. Its README says it:
  - gives every post a 0–100 score that weighs "role priorities, the locations you'll work from, your seniority and your dealbreakers";
  - pulls "Salary, stage, stack and how to apply… out of free-form posts";
  - can "queue it to become a Gmail draft with your resume attached";
  - does "Form prefill… stops before submit";
  - re-scores only new or edited posts on refresh, with "About 180 posts took 2 minutes".
  - [V-API, V-DOC] — [GitHub](https://github.com/MaxwellVolz/hn_whos_hiring)
- **ryanwi/hiringtrends**: MIT, ★72, last push 2024-08-26. Tracks language and tool popularity in whoishiring posts. [V-API] — [GitHub](https://github.com/ryanwi/hiringtrends)
- Other whoishiring UIs and parsers are small or stale [V-API]:
  - SimonBerens/hn-jobs: ★25, 2023, NO LICENCE.
  - gabfl/hn-whoishiring: ★10, 2024, NO LICENCE.
  - GRBurst/hnjobs: ★5, 2024-11, NO LICENCE.
  - arxpoetica/who-is-hiring-dashboard: MIT, ★10, 2023.
  - gaganpreet/hn-hiring-mapped: Unlicense, ★37, 2018.
  - brmeyer/hacker-news-who-is-hiring-parser: **GPL-3.0** (copyleft), ★4, 2017.
  - [GitHub search](https://github.com/search?q=whoishiring&type=repositories)
- **withexxa/hn-whoshiring** now redirects to hypermind-co/hn-whoshiring: ★2, last push 2024-09-22, **NO LICENCE**. Its pipeline is parse, then LLM processing (Exxa API), then analysis, and its README calls it "not production ready". [V-API, SECONDARY] — [GitHub](https://github.com/withexxa/hn-whoshiring)
- Hugging Face datasets [V-API]:
  - **brusic/hacker-news-who-is-hiring-posts**: MIT, under 1K rows, modified 2026-09-19. — [HF](https://huggingface.co/datasets/brusic/hacker-news-who-is-hiring-posts)
  - dansbecker/hackernews_hiring_posts: no licence tag, modified 2021-12-07. — [HF](https://huggingface.co/datasets/dansbecker/hackernews_hiring_posts)
- **Cotera "Hacker News Who Is Hiring Jobs Dataset"**:
  - 93,339 posts across 183 monthly threads (March 2011 to August 2026).
  - Tagged with languages and tools, role family, remote flag, and US or Europe location.
  - Parquet format, **CC BY 4.0** (attribution required), and post text is *not* included.
  - [SECONDARY, not opened] — [Cotera](https://cotera.co/datasets/library/hacker-news-who-is-hiring)
- A Metabase community post gives an OpenAI prompt that extracts company, role, location, salary, contact and description from HN posts as flat JSON. [SECONDARY] — [Metabase](https://www.metabase.com/community-posts/who-is-hiring-hacker-news-visualizations-gpt-metabase)

### Inferences
- MaxwellVolz/hn_whos_hiring is the closest existing match to Shortlist's whole loop (score, draft, form prefill). Its scoring prompt, location-fit logic and Gmail-draft code are worth reading before writing Shortlist's own. It is MIT, so code can be ported with the notice kept.
- The Cotera tags (remote, US/EU) could serve as a weak label set for evaluating an HN location extractor, but only with attribution and after checking its method.

### Gaps
- I did not open Cotera's dataset page or check how its tags were generated.
- I did not read MaxwellVolz's prompts or source code, only its README.
- I did not re-fetch the official HN Firebase API docs (github.com/HackerNews/API) in this session.

## 4. Location-eligibility parsing and salary normalisation

### Takeaway
No open-source library normalises job-location strings like "Remote (US only)", "EMEA" or "worldwide" into country eligibility. The practical pattern is:
1. Use structured fields from the sources first (Himalayas `locationRestrictions`, Jobicy `geo`, Ashby `isRemote`/`secondaryLocations`, Lever `country`/`workplaceType`).
2. Fall back to LLM extraction into a Zod schema.
3. Resolve region names through a hand-maintained region-to-country table built on country-code libraries.

For salary, Himalayas `salaryPeriod`, Lever `salaryRange` and Ashby `compensation` give structure. FX rates can come from Frankfurter (MIT) or fawazahmed0/exchange-api (CC0).

### Cited Findings
- No dedicated open-source LLM location normaliser with EMEA/LATAM mapping turned up. A commercial Apify actor normalises eligibility into worldwide, eligible regions, eligible countries, excluded countries and timezones. It also records whether eligibility came from structured fields or from the ad text, which is a useful schema to copy. [SECONDARY] — [Apify Remote Jobs by Country](https://apify.com/quietbyte/remote-jobs-by-country)
- Country and region data libraries [V-API]:
  - **i18n-iso-countries** (npm 7.14.0, **MIT**, last release 2025-02-17, ★904, slightly stale). — [GitHub](https://github.com/michaelwittig/node-i18n-iso-countries)
  - **countries-and-timezones** (npm 3.10.0, **MIT**, released 2026-08-05, ★278). Maps countries to timezones, which is useful for "UTC-3 to UTC+3" style restrictions. — [GitHub](https://github.com/manuelmhtr/countries-and-timezones)
  - **mledoze/countries** (★6,267, last push 2026-09-29). Its licence is **ODbL-1.0**, which requires attribution and share-alike for derived databases. The data includes `region`/`subregion` fields. — [GitHub](https://github.com/mledoze/countries)
  - **country-region-data** (npm 4.1.0, MIT, 2026-02-06). — [npm](https://www.npmjs.com/package/country-region-data)
  - **openvenues/libpostal** (★4,909, MIT, last push 2026-05-13). A C library for street addresses. It is the wrong tool for "Remote – EMEA" strings. — [GitHub](https://github.com/openvenues/libpostal)
- Currency and FX [V-API]:
  - **lineofflight/frankfurter** (formerly hakanensari/frankfurter): ★1,978, **MIT**, last push 2026-10-02, "Currency data API". — [GitHub](https://github.com/lineofflight/frankfurter)
  - npm `frankfurter-js` 0.1.1 (MIT, 2026-03-20) is a tiny wrapper.
  - **fawazahmed0/exchange-api**: ★2,679, **CC0-1.0**, last push 2026-10-01, "200+ Currencies & No Rate Limits". — [GitHub](https://github.com/fawazahmed0/exchange-api)
  - currency-codes (npm 2.2.0, MIT, 2024-10-23).
- Salary fields in the sources:
  - Himalayas: `minSalary`/`maxSalary`/`salaryPeriod`/`currency` [V-DOC] — [Himalayas](https://himalayas.app/api)
  - RemoteOK: `salary_min`/`salary_max` [V-LIVE] — [RemoteOK](https://remoteok.com/api)
  - Lever: `salaryRange` [V-LIVE] — [Lever](https://api.lever.co/v0/postings/15five?mode=json)
  - Ashby: `compensation` [V-LIVE] — [Ashby](https://api.ashbyhq.com/posting-api/job-board/ramp?includeCompensation=true)
- Feashliaa ships a 4 MB `salary_lookup.json` (sharded a–z). Its source and method are not documented in what I read. [V-API] — [GitHub](https://github.com/Feashliaa/job-board-aggregator/tree/main/data/salary)
- Real location strings are often lists separated by semicolons, e.g. GitLab's "Remote, Canada; Remote, United States". [SECONDARY] — [seoulstart.com](https://seoulstart.com/jobs/company/gitlab)

### Inferences
- A suggested eligibility schema (Zod): `{ scope: 'worldwide'|'regions'|'countries'|'unknown', countries_allowed: ISO2[], countries_excluded: ISO2[], regions: ('EMEA'|'APAC'|'LATAM'|'AMER'|...)[], tz_window?: {min_utc, max_utc}, source: 'structured'|'text', evidence_quote }`.
- With that schema, the rule "open to PK, exclude IN" is deterministic code applied to the extracted fields.
- PK is in "APAC" or "Asia" depending on the employer, and it is in neither EMEA nor LATAM. A region table must be explicit about this, and ambiguous cases should be marked "needs review" rather than guessed.
- Monthly USD normalisation: annual / 12, hourly × ~160–173, weekly × ~4.33. Apply FX with the rate date stored. Because the pay limit is a floor, keep `pay_unknown` as its own state rather than treating it as a fail.

### Gaps
- No open-source benchmark or labelled dataset of job location strings with eligibility labels turned up.
- I did not verify whether Frankfurter (ECB-based) covers PKR. fawazahmed0 claims 200+ currencies, which likely includes PKR, but this is unverified.

## 5. Evidence on what gets job-application and cold emails replies

### Takeaway
I found **no peer-reviewed study** of job seekers emailing recruiters or hiring managers. The credible large datasets are vendor studies of *sales* cold email (tens of millions of emails) and recruiter-to-candidate outreach. They agree on one point: short emails (under ~100–125 words; for LinkedIn InMail, 200–400 characters) get more replies. Treat all figures as directional, because the vendors have an incentive to report good numbers and they define "reply" differently.

### Cited Findings
- Hunter's study of 34 million emails: 20–39 words had the highest response rate (4.5%), against an average of 3.7%. [SECONDARY, via a write-up] — [FullEnrich](https://www.fullenrich.com/content/how-long-should-a-cold-email-be)
- The often-quoted "50–125 words" range comes from Boomerang's 2016 analysis and is considered dated. [SECONDARY] — [FullEnrich](https://www.fullenrich.com/content/how-long-should-a-cold-email-be)
- Saleshandy says it analysed 53 million cold emails (Jan–Jun 2026, 23,000+ users): average reply rate 3.7%, best campaigns 10%+. [SECONDARY] — [Saleshandy](https://saleshandy.com/blog/cold-email-statistics/)
- Woodpecker's platform median reply rate is 1.5% across 56,614 campaigns. [SECONDARY] — [Woodpecker benchmarks](https://woodpecker.co/cold-email-benchmarks/)
- Reply.io looked at 712K first-step emails: 31.69% open rate and 3.02% reply rate. Mentioning a referral or a request in the subject line raised replies "by up to 55.9%". [SECONDARY] — [Reply.io research](https://reply.io/reply-research-subject-lines/)
- LinkedIn's InMail analysis (reported by SHRM): InMails of 200–400 characters were 16% more likely to get a response than the average 800-character InMail. [SECONDARY] — [SHRM](https://www.shrm.org/topics-tools/news/talent-acquisition/analysis-short-personalized-inmails-work-best)
- Pin's 2026 benchmark covers 4M+ recruiting messages (recruiter to candidate): cold email 4.96% reply rate versus LinkedIn messages 17.08%. [SECONDARY] — [Pin](https://www.pin.com/blog/recruiting-outreach-benchmark-report)
- noon.ai's 2026 recruiter-email data shows ≤100 words at 14.9% reply and 151–200 words at 12.2% (the lowest band). The sample was self-submitted and not random. [SECONDARY] — [noon.ai](https://www.noon.ai/blog/articles/338-recruiting-email-length-reply-rate)
- Job-seeker-specific claims, all anecdotal or small samples [SECONDARY]:
  - 200 Indian job seekers over 3 months: 2–4% response from portal applications, 18–25% from referral-request emails, and 12–18% from targeted emails to hiring managers. The method is not described. — [jobrise.io](https://jobrise.io/en/blog/how-to-write-cold-email-recruiter/)
  - Sales-hiring guide: "15% to 25% vs 2% to 5%", with no source named. — [firstsales.io](https://firstsales.io/blog/cold-email-sales-job)

### Inferences
- Defaults for Shortlist's email writer:
  - under ~120 words, and ideally 50–100;
  - one specific hook tied to the posting;
  - a clear single request;
  - if a referral or mutual contact exists, mention it in the subject line.
- Make these defaults eval criteria (a length check plus an LLM judge for specificity) rather than treating them as proven truths.
- Because no job-seeker data is credible, Shortlist's own reply tracking (draft created, sent by the user, reply received) will become the best evidence for this user after a few dozen applications.

### Gaps
- No academic or controlled study of applicant-to-recruiter cold emails was found.
- Correspondence audit studies (e.g. callback rates by resume features) exist in labour economics, but I did not search them in this pass.
- I found no templates from a clearly reputable, non-vendor source, such as a university careers office.

## 6. Prompt sets and eval datasets (matching, cover-letter quality, hallucination against a profile)

### Takeaway
No ready-made open eval suite exists for "is this cover letter faithful to the candidate profile". Build Shortlist's evals with a general framework such as promptfoo (MIT) or DeepEval (Apache-2.0). Use the 2026 arXiv paper on resume-rewrite hallucinations for a failure taxonomy, and Vectara HHEM (Apache-2.0) as a cheap consistency checker. Public resume-to-job fit datasets exist but are weak, and several have no licence.

### Cited Findings
- Eval frameworks [V-API]:
  - **promptfoo/promptfoo**: ★25,990, **MIT**, last push 2026-10-14. A TypeScript/Node tool for testing prompts, agents and RAG. — [GitHub](https://github.com/promptfoo/promptfoo)
  - **confident-ai/deepeval**: ★18,846, **Apache-2.0**, last push 2026-10-12. Python. — [GitHub](https://github.com/confident-ai/deepeval)
  - **ragas**: the GitHub API resolves it to `vibrantlabsai/ragas` (★16,018, Apache-2.0). Its **last push was 2026-02-24**, so it is **possibly slowing** and the repo has moved owners. — [GitHub](https://github.com/vibrantlabsai/ragas)
- **vectara/hallucination_evaluation_model (HHEM)**: Hugging Face model, **Apache-2.0**, 133K downloads, modified 2026-10-06. It scores whether generated text is consistent with a source text. [V-API] — [HF](https://huggingface.co/vectara/hallucination_evaluation_model)
- **"Grounded Optimization: A Layered Engineering Framework for Reducing LLM Hallucination in Automated Personal Document Rewriting"** (arXiv 2607.01457, 2026):
  - Covers resume rewriting for ATS, with a taxonomy that includes content fabrication and "anachronistic technology injection".
  - Evaluated on 25 synthetic resumes. Undefended baselines produced 2.48–5.36 detected hallucinations per resume.
  - The authors say they release the taxonomy, eval code and raw data, but I could not find the repo URL.
  - [SECONDARY] — [arXiv](https://arxiv.org/pdf/2607.01457)
- General hallucination benchmarks: HaluEval (~35K samples) and Meta's HalluLens. [SECONDARY] — [HaluEval arXiv](https://arxiv.org/pdf/2305.11747); [HalluLens arXiv](https://arxiv.org/pdf/2504.17550)
- Resume and job datasets on Hugging Face [V-API]:
  - **cnamuangtoun/resume-job-description-fit**: 1K–10K rows, labels No/Potential/Good fit, 990 downloads, 81 likes, modified 2024-07-25, **NO LICENCE declared**. — [HF](https://huggingface.co/datasets/cnamuangtoun/resume-job-description-fit)
    - Models fine-tuned on it reach only ~0.39–0.43 macro-F1, and a TF-IDF baseline matched or beat them. This suggests the labels are noisy. [SECONDARY] — [HF model card](https://huggingface.co/domynom/resume-job-deberta)
  - netsol/resume-score-details: licence tag "cc" (variant unspecified), modified 2024-10-30. — [HF](https://huggingface.co/datasets/netsol/resume-score-details)
  - opensporks/resumes: **CC0**, 4.5K downloads. — [HF](https://huggingface.co/datasets/opensporks/resumes)
  - ShashiVish/cover-letter-dataset: 1K–10K rows, **NO LICENCE declared**, modified 2023-10-15. — [HF](https://huggingface.co/datasets/ShashiVish/cover-letter-dataset)
  - justinthelaw/Resume-Cover-Letter-SFT-Dataset: Apache-2.0, modified 2026-03-02. — [HF](https://huggingface.co/datasets/justinthelaw/Resume-Cover-Letter-SFT-Dataset)
  - akhan02/cultural-dimension-cover-letters: CC-BY-4.0 (attribution). — [HF](https://huggingface.co/datasets/akhan02/cultural-dimension-cover-letters)
  - lang-uk/recruitment-dataset-job-descriptions-english: MIT. — [HF](https://huggingface.co/datasets/lang-uk/recruitment-dataset-job-descriptions-english)
  - jacob-hugging-face/job-descriptions: **Llama 2 licence** (restrictive custom licence). — [HF](https://huggingface.co/datasets/jacob-hugging-face/job-descriptions)
  - tinixai/vietnamese-job-descriptions: **CC-BY-NC-4.0, which forbids commercial use**. — [HF](https://huggingface.co/datasets/tinixai/vietnamese-job-descriptions)
  - renhehuang/resume-job-fairness-eval: MIT. — [HF](https://huggingface.co/datasets/renhehuang/resume-job-fairness-eval)

### Inferences
- The best evals for Shortlist will be its own small golden set: 30–50 real postings labelled by the user for eligible yes/no, a fit score band, and pay over or under the floor. Run these through promptfoo, which fits a TypeScript stack, per model.
- Hallucination check for emails and form answers:
  1. Extract every factual claim about the candidate.
  2. Require each claim to cite a profile or answer-bank entry.
  3. Score unsupported claims with an LLM judge, HHEM, or both.
- Use the arXiv taxonomy (fabricated employer or skill, inflated metrics, anachronistic tech) as the categories for the rubric.
- Public fit datasets are mostly useful as smoke tests, not as ground truth for this user's criteria.

### Gaps
- I could not confirm the code or data repo for arXiv 2607.01457.
- I found no open prompt set specifically for scoring cover-letter quality.
- I did not verify whether DeepEval and promptfoo currently ship built-in "faithfulness" or "hallucination" assertions; read their docs before relying on that.

## 7. TypeScript tooling (Gmail drafts with attachments, PWA share target, Supabase Queues + Cron, LangGraph.js Postgres checkpointer)

### Takeaway
Every piece has a maintained, permissively licensed package as of October 2026:
- `@googleapis/gmail` or `googleapis` (Apache-2.0) to create drafts, with the MIME message built by nodemailer (MIT-0);
- `@serwist/next` (MIT) for the PWA (`next-pwa` is stale);
- Supabase Queues, which is pgmq (PostgreSQL licence);
- `@langchain/langgraph-checkpoint-postgres` (MIT, released 2026-10-12).

### Cited Findings
- Gmail drafts:
  - Create an RFC 2822 MIME message, base64url-encode it and POST it to `users/me/drafts` as `{"message":{"raw":...}}`.
  - Google's Java sample requests the `GMAIL_COMPOSE` scope for creating drafts.
  - Drafts "cannot be edited once created, but it can be replaced".
  - The guide has no Node.js sample, and attachment and size details sit on a separate "Upload attachments" page.
  - [V-DOC] — [Gmail API drafts guide](https://developers.google.com/workspace/gmail/api/guides/drafts)
- npm packages [V-API]:
  - `googleapis` 185.0.0 (2026-10-08, Apache-2.0); repo googleapis/google-api-nodejs-client, ★12,268, last push 2026-10-13. — [GitHub](https://github.com/googleapis/google-api-nodejs-client)
  - `@googleapis/gmail` 22.0.1 (2026-09-24, Apache-2.0) is the smaller package for Gmail only. — [npm](https://www.npmjs.com/package/@googleapis/gmail)
  - `nodemailer` 10.1.1 (released 2026-10-14). npm licence **MIT-0** (no attribution required); GitHub reports NOASSERTION. ★17,679. — [GitHub](https://github.com/nodemailer/nodemailer)
- Supabase Queues:
  - A "Postgres-native, durable message queue" built on the pgmq extension.
  - It offers "exactly-once delivery" within a visibility window, archival, and RLS-controlled client access.
  - The overview page does not cover the function APIs or the Cron integration; those are on the Quickstart and API Reference pages.
  - [V-DOC] — [Supabase Queues docs](https://supabase.com/docs/guides/queues)
- **pgmq/pgmq**: ★5,328, **PostgreSQL licence** (permissive), last push 2026-09-28. [V-API] — [GitHub](https://github.com/pgmq/pgmq)
- `@supabase/supabase-js` 2.117.3 (2026-10-07, MIT). [V-API] — [npm](https://www.npmjs.com/package/@supabase/supabase-js)
- LangGraph.js [V-API]:
  - `@langchain/langgraph` 1.5.0 and `@langchain/langgraph-checkpoint-postgres` 1.1.0, both MIT and both released 2026-10-12.
  - Repo langchain-ai/langgraphjs: ★3,354, last push 2026-10-14.
  - [GitHub](https://github.com/langchain-ai/langgraphjs)
- PostgresSaver usage:
  1. Create it with `PostgresSaver.fromConnString(...)` or by passing a `pg` Pool.
  2. Optionally pass a `schema` option (the default is `public`).
  3. Call `setup()` on first use.
  - [SECONDARY] — [LangChain JS reference](https://reference.langchain.com/javascript/classes/_langchain_langgraph-checkpoint-postgres.index.PostgresSaver.html)
- PWA:
  - `@serwist/next` 9.5.13 (2026-10-04, MIT); serwist/serwist ★1,494, last push 2026-10-04. — [GitHub](https://github.com/serwist/serwist)
  - **`next-pwa` is stale**: npm 5.6.0 was last released 2022-08-23, and shadowwalker/next-pwa was last pushed 2024-07-27. [V-API] — [GitHub](https://github.com/shadowwalker/next-pwa)
- Share target:
  - The manifest `share_target` takes `method: "POST"`, `enctype: "multipart/form-data"` and a `files` array for image types.
  - The POST can be handled on the server or intercepted in the service worker's fetch handler.
  - The app must be installed before it appears as a share target.
  - [SECONDARY] — [MDN share_target](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/share_target)
  - Workbox has a pattern for this: register a POST route, then `await event.request.formData()` and read the files field. — [web.dev](https://web.dev/articles/workbox-share-targets)
  - No Next.js-specific share-target example was found.

### Inferences
- Gmail draft flow:
  1. Build the MIME message with attachments (resume PDF) using nodemailer's MailComposer, in "build only" mode without sending.
  2. Base64url-encode it.
  3. Call `gmail.users.drafts.create` with only the `gmail.compose` scope.
  - For messages over a few MB, use the media-upload variant of `drafts.create`.
  - This is a standard pattern, but I did not verify it against a Node sample in this session.
- For the share target, the simplest route on Next.js is a Route Handler at the manifest `action` path that reads `request.formData()` and uploads the image to Supabase Storage. A service-worker handler is only needed if shares must work offline.
- Run LangGraph's PostgresSaver in its own schema (e.g. `langgraph`) on the same Supabase Postgres. Connect through the session pooler or a direct connection, because long-lived checkpointer connections can clash with the transaction pooler.

### Gaps
- I did not read the Supabase Queues Quickstart or API Reference, so the exact `pgmq_public` RPC names and the Cron-to-Edge-Function worker example were not confirmed.
- Gmail attachment size limits and the upload endpoint details were not read; they are on the "Upload attachments" page.
- I did not find an official example combining a LangGraph.js PostgresSaver with Supabase.
