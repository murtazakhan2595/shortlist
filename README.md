# Shortlist

A personal system that finds job opportunities daily, matches them to its owner's profile, and prepares each application for review. Nothing is sent automatically.

- What is being built: [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)
- How it is built: [docs/PLAN.md](docs/PLAN.md)
- Rules for contributors and coding agents: [AGENTS.md](AGENTS.md)

## Layout

- `frontend/`: the Next.js app
- `supabase/`: database migrations, database tests and configuration
- `docs/`: requirements, plan and research

## Development

Requires Node 24 and pnpm.

```bash
cd frontend
pnpm install
pnpm dev
pnpm test
```
