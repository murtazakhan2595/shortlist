# Shortlist: Requirements

Version 2.5, 14 October 2026. Agreed.

This document says **what** is being built and how success is judged. **How** it gets built is in [PLAN.md](PLAN.md).

Anything marked **(Q1)**, **(Q2)** and so on refers to a decision recorded in [section 10](#10-decisions).

## 1. Goal

Shortlist is a personal system that finds job opportunities every day, matches them to its owner's profile, and prepares each application so that reviewing and sending takes minutes instead of hours.

It serves two purposes:

1. **Be usable every day by its one owner**, for local and international roles.
2. **Be the owner's portfolio project**, showing agent design, evaluation, production deployment, cost control and security.

## 2. The owner and the search

- One user: a full-stack developer in Pakistan.
- Role priority: full-stack, AI engineer, AI full-stack, then other software engineering roles.
- Acceptable arrangements: remote, or relocation where the employer sponsors a visa.
- Countries: any, except India. The owner does not apply to jobs in India.
- Local jobs come from recruiter posts on LinkedIn, which give either an email address or a link to a form.
- International jobs come from job boards and company career pages.

## 3. Success criteria

**The product works** when:

1. Reviewing a day's prepared applications takes the owner minutes, not hours.
2. A captured post produces a Gmail draft or form answers within one minute.
3. All five quality checks in [section 7](#7-quality-checks) pass.
4. Model spending stays within the monthly cap.
5. Nothing has ever been sent or submitted without the owner doing it.

**The job search works** when the system shows, per source, how many applications led to a reply and to an interview. No target number is set until two weeks of real data exist **(Q11)**.

**The portfolio works** when the repository can be shown to an employer: a clear README, an architecture diagram, a results table for the quality checks across models, a cost report and a short demo video.

## 4. Principles

These hold at every stage and override any individual requirement.

1. **Nothing is sent or submitted automatically.** The system prepares; the owner reviews and sends.
2. **Only true claims.** Every statement about the owner must be supported by the stored profile or answer bank. Where they are silent, the system asks; it never guesses.
3. **Only permitted sources.** Automated reading happens only where the source's terms allow it. Each source's terms and rate limits are written into configuration and checked by tests.
4. **Job posts and forms are untrusted input.** Text from them can never cause an action. The language model has no access to Gmail; ordinary code creates drafts.
5. **Single user.** Built for one owner, non-commercial, no sign-up, no billing.
6. **Private by default.** No secrets and no personal data in the repository at any time. No code, prompts or data from any employer. Open-source code and prompts may be reused only under permissive licences (MIT, MIT-0, Apache-2.0, ISC, BSD, CC0, PostgreSQL), with credit kept in `THIRD_PARTY_NOTICES.md`; nothing under AGPL, GPL, Commons Clause, ODbL or with no licence.

## 5. What it must do

### 5.1 Profile

| ID | Requirement | Stage |
|---|---|---|
| P1 | Store a master profile: every job and project, what was done, the stack, and any numbers. | 1 |
| P2 | Store several CV versions (full-stack, AI engineer, AI full-stack) and choose one per job. | 1 |
| P3 | Store past application emails as examples of the owner's writing voice. | 1 |
| P4 | Choose the job title and seniority to present per job, from the profile. Never present a level the profile does not support. | 1 |
| P5 | Keep an answer bank: the owner's standard answers to recurring questions (notice period, expected salary, location, years with a technology, links), and reusable assets such as an introduction video. | 1 |
| P6 | Let the owner edit the profile and answer bank in the app, as plain documents **(Q8)**. | 1 |
| P7 | Store a small set of email patterns, taken from research into application emails that work and from the owner's own writing. Record which pattern each draft used **(Q9)**. | 1 |

### 5.2 Manual capture

| ID | Requirement | Stage |
|---|---|---|
| C1 | Accept a post as a screenshot or as pasted text, from a phone or a desktop browser. | 1 |
| C2 | Appear in the Android share menu, so a screenshot can be shared straight to the app **(Q6)**. | 1 |
| C3 | Extract role, company, contact email or form link, and the poster's name. | 1 |
| C4 | For screenshots, show the extracted email address for confirmation before drafting. | 1 |
| C5 | Recognise a post that has already been captured, including reshares of the same post. | 1 |
| C6 | Produce the result within one minute: of capture for pasted text, of confirmation for screenshots. | 1 |
| C7 | Treat every captured post as wanted; no relevance scoring. | 1 |
| C8 | Keep the post's link if the owner supplies it, for reference only. The system never opens a LinkedIn link. | 1 |

### 5.3 Automated discovery

| ID | Requirement | Stage |
|---|---|---|
| D1 | Run once a day on a schedule, with no action from the owner. | 1 |
| D2 | Convert listings from every source into one common format and remove duplicates across sources. | 1 |
| D3 | Before any model call, drop listings that clearly exclude the owner: a country list without Pakistan, a citizenship or security-clearance requirement, pay stated below the owner's floor, or seniority outside the owner's range **(Q2, Q3, Q4)**. | 1 |
| D3a | Drop listings for an excluded country: the job is located there, is restricted to candidates there, or the listing shows the employer is based there. India is the one excluded country. | 1 |
| D4 | Keep listings whose eligibility is unclear, flagged and ranked lower. | 1 |
| D5 | Score remaining listings against the profile and keep the top N, where N is the daily target **(Q1)**. Reply rates may show that fewer, better applications work better, so N can go down as well as up. | 1 |
| D6 | Tag each kept job where the listing says so: remote, contractor-friendly, visa-sponsoring. | 1 |
| D7 | Keep the source link for every listing, for attribution and for applying. | 1 |
| D8 | Add a company to the watchlist when a matched job is hosted on Greenhouse, Lever or Ashby. | 2 |

### 5.4 Preparing applications

| ID | Requirement | Stage |
|---|---|---|
| X1 | Where a contact email exists, create a draft in the owner's existing Gmail with the chosen CV attached. | 1 |
| X2 | Where the job has only an apply link, choose the CV and write a short tailored note the owner can paste **(Q5)**. | 1 |
| X3 | Where the owner supplies the application form, answer it as in 5.5. | 1 |
| X4 | Check every draft, note and answer against the profile and block any unsupported claim. | 1 |
| X5 | Use the narrowest Gmail permission that can create drafts. That permission also allows sending, so the code must contain no send call, and a test must enforce this. | 1 |
| X6 | Never prepare a second application for a job that already has one, whichever path it arrived by. | 1 |
| X7 | For portals that publish their questions (Greenhouse), fetch the questions and prepare the answers without screenshots. | 2 |

### 5.5 Application forms

Many recruiter posts link to a form, often a Google Form, instead of giving an email address.

| ID | Requirement | Stage |
|---|---|---|
| F1 | Accept a form as one or more full-page screenshots, or as pasted text, and list its questions. The system does not read forms from their links. | 1 |
| F2 | Show the questions it found before answering, so a missed one is obvious. | 1 |
| F3 | Let the owner add further screenshots to the same form, for forms that show later pages only after earlier ones are filled. | 1 |
| F4 | Answer each question from the profile and the answer bank, and show each answer beside its question with a copy button. | 1 |
| F5 | Where there is no supported answer, mark the question "needs your input". Save the owner's answer to the answer bank for next time. | 1 |
| F6 | List what the form needs that the system cannot write, such as a video, a file upload or a portfolio, and say whether a stored asset already covers it. | 1 |
| F7 | Never open, fill or submit the form. | 1 |

### 5.6 Review app

| ID | Requirement | Stage |
|---|---|---|
| U1 | Show each day's jobs with score, tags, source and what was prepared. | 1 |
| U2 | Let the owner mark each job as sent, skipped, replied or interview, with one tap **(Q7)**. | 1 |
| U3 | Provide the capture page and the form page. | 1 |
| U4 | Provide settings: daily target, monthly spending cap, model per step, excluded countries. | 1 |
| U5 | Show spending per run and per month, and reply and interview rates per source and per email pattern. | 1 |
| U6 | Restrict access to the owner. | 1 |
| U7 | Let the owner mark automated listings as apply or skip, to build the test set for match quality. | 1 |

### 5.7 Cost control

| ID | Requirement | Stage |
|---|---|---|
| B1 | Record model cost for every run and every step. | 1 |
| B2 | Stop automated runs when the monthly cap is reached, and say so in the app. Manual captures still work. | 1 |
| B3 | Name the provider and model for each step in configuration, so they can be swapped without code changes. | 1 |

### 5.8 Later

| ID | Requirement |
|---|---|
| L1 | Draft up to two follow-ups per application, stopping when a reply arrives. Reply detection is done by ordinary code on threads the system started. |
| L2 | A browser extension that fills a form on a page the owner has opened; the owner submits. Deferred: Huntr's or Simplify's free autofill covers this for job-site forms; revisit only if they fail on Google Forms. |
| L3 | Outreach drafts to founders of newly launched startups. |
| L4 | Detect automatically that a draft was sent. |

## 6. Sources

| Source | How it is read | Stage |
|---|---|---|
| LinkedIn feed posts | Owner supplies a screenshot or pasted text | 1 |
| Himalayas | Public jobs API, once a day | 1 |
| Hacker News: monthly hiring thread and jobs feed | Official API | 2 |
| Company career pages on Greenhouse, Lever, Ashby | Public job-board endpoints, driven by a company watchlist | 2 |
| Job-alert emails (Wellfound, LinkedIn job alerts, country job portals) | Read from a dedicated alerts mailbox | 2 |
| Jobicy, RemoteOK | Public APIs, with attribution | Later |
| Product Hunt launches | Official API, non-commercial use | Later |

**Never read automatically:** LinkedIn, Wellfound, Y Combinator's Work at a Startup, Workday career sites. Jobs from these enter only by manual capture or by the alert emails those sites send.

**Checked on 13 October 2026:**

- **Himalayas.** Free, no key. Its data refreshes every 24 hours, so one run a day is enough. It can filter by country, worldwide, seniority and time zone, and each job carries location restrictions, salary and an application link. Its terms ask for a link back and a mention of Himalayas, and forbid submitting its jobs to other job sites.
- **Wellfound.** Its help centre says a saved search can send daily or weekly email alerts. The article dates from February 2023.
- **Y Combinator's Work at a Startup.** No official mention of job-alert emails was found. Its jobs are covered by the Hacker News jobs feed, the company watchlist and manual capture.

The rest of the list comes from a research report that relied partly on secondary pages. Each source's own terms page must be read before its connector is built.

## 7. Quality checks

A check must pass before the system is trusted in daily use.

| ID | What is measured | Test data | Pass bar |
|---|---|---|---|
| E1 | Extraction from captured posts | Saved LinkedIn posts | Email address exactly right on every pasted-text post; 95% on screenshots before confirmation |
| E2 | Match quality | Automated listings marked apply or skip by the owner | At least 70% of each day's top N are ones the owner would apply to |
| E3 | Truthfulness of drafts | A sample of 50 drafts checked by hand | No unsupported claims |
| E4 | Draft correctness | Same sample | Right recipient, right role, right CV on every draft |
| E5 | Form answers | 20 saved forms | Every question found; no answer given that the profile and answer bank do not support |

Results are recorded per model, so a cheaper model can replace a dearer one only when it passes the same bars.

## 8. Limits

- Model spending within the monthly cap. The planning figure is about 50 USD a month.
- Hosting on free plans, so models are the only running cost.
- No dependence on the host. The application uses nothing specific to the service that hosts it; queue, schedule and triggers live in Supabase Postgres. Moving it, for example to AWS Amplify, must need only configuration changes.
- Every draft can be explained afterwards: which listing or post, which model, what it cost.

## 9. Out of scope

- Sending emails or submitting forms automatically.
- Reading LinkedIn, Wellfound, Y Combinator's job board or Workday sites automatically.
- Working around CAPTCHAs, bot detection or login walls.
- Multiple users, sign-up, payments.
- Reading the owner's personal inbox with a language model.

## 10. Decisions

No questions are open. All were decided on 13 October 2026.

| # | Question | Decision |
|---|---|---|
| Q1 | What the daily target counts | Only jobs the system finds. Captured posts are unlimited. |
| Q2 | Seniority range | Mid-level and senior, up to five years required. Lead, staff and principal roles are dropped. |
| Q3 | Pay below the floor | A listing that states pay below the owner's pay floor (a setting, in USD a month) is dropped. A listing that states no pay is kept. |
| Q4 | Listings that do not say whether contractors or visa sponsorship are possible | Kept. Only listings that clearly exclude the owner are dropped. Pay at or above the floor is what matters. |
| Q5 | What stage 1 prepares for job-board listings, which have an apply link and no email | The chosen CV and a short tailored note. Form answers on demand, from screenshots. |
| Q6 | Capturing posts on the phone | By screenshot, and by copying and pasting the post's text. Both are supported. |
| Q7 | How the system learns that an application was sent | One tap in the app. Automatic detection later (L4). |
| Q8 | How the profile and answer bank are edited | As plain documents in the app, not structured forms. |
| Q9 | Email language and length | Set by research into application emails that work, combined with the owner's own writing (P7). Reply rate per pattern then shows which one holds up. |
| Q10 | Models | Chosen from provider prices and Artificial Analysis benchmarks (PLAN.md section 4). The build starts on `gpt-6-luna` for scoring and `gpt-6.1-sol` for reading screenshots, writing and checking, with `claude-haiku-5-5` as first challenger. The final model per step is chosen by weighing cost against results on the quality checks. |
| Q11 | What job-search result counts as success | Reply and interview rates per source are recorded from day one. A target is set after two weeks of data. |
| Q12 | Repository | A private repository named `shortlist` on the owner's personal GitHub account. |
| Q13 | Where everything runs | TypeScript throughout, as one Next.js application. Database, files, sign-in, queue, schedule and triggers on Supabase. Hosted on Vercel's free plan to start, with nothing specific to Vercel used, so it can move to AWS Amplify (PLAN.md section 3). |
