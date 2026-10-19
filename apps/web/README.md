# web

The Matiks web recreation: a Next.js App Router front end with pure, seeded
puzzle engines and a pluggable local backend.

See the [repository README](../../README.md) for the full overview, how to run
it, and the reverse-engineering notes.

```bash
pnpm --filter web dev          # http://localhost:3000
pnpm --filter web test         # engines, scoring and rule tests
pnpm --filter web check-types  # next typegen && tsc --noEmit
pnpm --filter web lint
```

Key directories:

- `lib/games/` — pure engines (no React, no DOM, no `Math.random`)
- `lib/scoring.ts` — minimum scores, bands, blitz shapes, rating, XP
- `lib/services/` — storage, leaderboards, quests and the `Backend` seam
- `lib/state/` — React context over that seam
- `components/` — shell, UI primitives, `GameHost`, one component per board
- `app/` — routes
