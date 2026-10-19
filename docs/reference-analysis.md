# Matiks — reference analysis

This document records how the Matiks Android app was analysed, what was actually
recovered from the shipped artifact, and — just as importantly — what had to be
inferred. The web app in `apps/web` is built from this evidence.

**Target:** `com.matiks.app` 1.51.0 (XAPK), analysed from
`~/Downloads/com.matiks.app_1.51.0/` on 2026-10-19.

## 1. Method

| Step | Tool | Result |
| --- | --- | --- |
| Package + manifest | REA `inspect_android_package` on `com.matiks.app.apk` | Package id, version, activities, permissions. Manifest evidence retained as `ev_0498145c…`. |
| Resources | Direct asset reads (apktool launcher was unavailable: `decode_android_resources` reported no apktool command) | Launcher icons, splash art and logo vectors sampled directly from the archive. |
| Native code | REA + Ghidra 12.1.4 on `lib/arm64-v8a/*.so` extracted from `config.arm64_v8a.apk` | Confirmed the native library set; the app has no meaningful game logic in native code. |
| Java/Kotlin | REA + JADX (JDK 21) | Confirmed the Android shell is a thin host for a JS app. |
| Application logic | `assets/index.android.bundle` (Hermes bytecode, HBC v98) | Disassembled with `hermes-dec` 0.1.8 (extracted from the PyPI wheel; no pip in the environment) to a full string table. |
| Design tokens | Pixel sampling of the shipped icons/splash assets | Colours below. |

The bundle is Hermes bytecode, so Ghidra and JADX cannot read it directly and no
standalone Hermes disassembler was installed; `hermes-dec` was used instead. In
total **193,292 strings** were extracted, which is the primary evidence source
for copy, rule text, scoring names and UI labels quoted throughout the app.

## 2. What is evidenced vs inferred

This distinction is maintained everywhere in the codebase and UI.

**Evidenced directly from the artifact**

- Navigation model and screen names: Arena, Compete, Feed, Puzzles, Quests,
  Nets, **Snacc**, More. Two of these are easy to misread and the bundle settles
  both: **Snacc is the Infinite Puzzle ladder** ("Solve an endless stream of
  puzzles at your own pace. No timers, no pressure."), and **Nets is Practice**
  (`nets.*`, `LearnPracticeSession`). The shop is the **Pi Store**, not Snacc.
- Daily Challenge puzzle set (Sudoku, KenKen, Cross Math, Math Maze, Hectoc) and
  the league divisions (1st 2000+, 2nd 1200+, 3rd 800+).
- Infinite Puzzle ladder (Snacc): Queens, Tango, Zip, Patches, Pipes, Flip
  Match, Wend. Skips are a daily-limited currency (`snaccSkips`).
- Per-mode how-to-play copy, quoted verbatim in `lib/catalog.ts` and shipped in
  the game "how to play" panels (e.g. KenKen cages, Cross Math's "No BODMAS
  here", Hectoc's "six given digits … equal to 100", Zip's checkpoint rule,
  Pipes' rotation/leak/connectivity rules, Wend's drag/keyboard controls,
  Sprint's "board position 1", Fastest Finger's "1-min", Flash Anzan's
  "3 rounds", Mind Snap's preset notation `25G(9S)` and its +1/−1 tap rule,
  Pin Ball Recall's "auto-hide after 5 seconds" and exact-1/adjacent-0.5 rule,
  Ability Duels' "squares … give the target number" and "space to separate").
- Duels run 60 seconds in three 20-second windows.
- Contests by name: 80 in 8, Survival Saturday (+3s for a correct answer, −20s
  for a mistake), **Sumday Showdown**, Speed Run, Road to Kolkata, and the Pro
  **75 Smart** habit ladder. Formats: 1v1 Duels, Daily Challenges, Weekly
  Contests, across four categories — **Math, Memory, Puzzle, Classical**.
- Minimum score for a play to count: Mind Snap 60, Flash Anzan 90, Sprint 10,
  Ability Duels (Sum of Squares) 8, Fastest Finger 5, Cross Math 4, Math Maze 4,
  KenKen 2, Sudoku 2.
- Accuracy is redefined to count every wrong attempt, backspace, clear and
  retry — not just whether the board was eventually solved.
- Streak triggers: play a duel, finish the Daily Challenge, or join a contest.
  Streak Shield costs 200 Pies, maximum 2.
- Currencies/items: Pies, Pi Coins, Statik Coins, Snacc Skips, XP Booster,
  Streak Shields.
- Quality bands by name: ZAP, FLOW, GRIND, CHOKE, FREEZE ("wrong answers sit
  outside this scale").
- Blitz shape names: Dominator, Comeback, Clutch, Almost, Close Call, Slip up,
  Blunder, Crushed (5 winning, 3 losing).
- Leaderboard scopes and categories: global/friends/college × blitz/classical/
  memory/puzzle/XP.
- Fonts bundled with the app: Montserrat (primary), Nunito Sans, Bebas Neue,
  Chakra Petch, Roboto Mono, Space Mono.
- Brand colours, by pixel sampling: plate `#171717`, brand lime `#b1fa63`, lime
  veil `rgba(195,250,99,0.2)`, Pro violet `#7c5cff`, win gold `#ffc300`, loss red
  `#ff3b30`.

**Inferred (documented, never presented as recovered)**

| Area | Inference | Where |
| --- | --- | --- |
| Solve-quality cut-offs | Ratio of solve time to a per-difficulty par time: ≤0.5 ZAP, ≤0.9 FLOW, ≤1.4 GRIND, ≤2.2 CHOKE, else FREEZE | `lib/scoring.ts` |
| Blitz shape decision tree | Lead profile across the three 20-second windows | `lib/scoring.ts` |
| Puzzle score formula | Difficulty-weighted 1000 base × accuracy × speed, 0 when unsolved | `lib/scoring.ts` |
| Elo-style rating | K shrinks with games played; expected-score curve | `lib/scoring.ts` |
| XP curve | Level *n* costs 250·n XP | `lib/services/backend.ts` |
| Quest objectives | Five daily objectives built from the evidenced counters | `lib/services/quests.ts` |
| Flash Anzan points | `terms × 10` per correct round, which reconciles with the min score of 90 | `components/games/FlashAnzanDuel.tsx` |
| Board-size/difficulty ladders | Sudoku 9×9; KenKen 4–6; Cross Math 3/5; Math Maze rows by difficulty; Queens/Tango/Zip/Pipes/Wend from their generators | `lib/games/*` |
| Streak-shield consumption | A held shield absorbs one missed day | `lib/services/backend.ts` |
| Pies payout | Only paid when a play beats the mode minimum, matching the store copy | `lib/services/backend.ts` |
| Snacc skip price | 120 Pies each, with a fresh set of free skips daily | `lib/services/backend.ts` |

## 3. Architecture of the web build

```
apps/web
├── lib/games/          pure, seeded engines (no React, no DOM, no Math.random)
├── lib/scoring.ts      minimum scores, scoring, bands, shapes, rating, XP
├── lib/services/       the backend seam: storage, leaderboard, quests, backend
├── lib/state/player.tsx React context over the backend seam
├── lib/hooks/          game session stopwatch + accuracy ledger
├── components/         shell, UI primitives, GameHost, one component per board
└── app/                routes: /, /puzzles, /daily, /compete, /quests,
                        /leaderboard, /store, /profile, /more, /play/[gameId]
```

Two design decisions matter:

1. **Everything deterministic is seeded.** Boards come from `lib/rng.ts`
   (mulberry32 + an FNV-1a string hash). `Math.random()` is never used for board
   generation, so today's Daily Challenge is identical for every player and every
   engine is reproducible in tests.
2. **The backend is a seam, not a mock sprinkled through the UI.** `Backend` in
   `lib/services/backend.ts` is an interface; `LocalBackend` implements it over
   `localStorage`. Swapping in an HTTP implementation would not change a single
   component.

## 4. Honest limits of this build

- **There is no server.** Duels, leaderboards and contests are *simulated* and
  are labelled as such in the UI ("bot" rows, "simulated rival", a
  "Needs server" pill on contests). Nothing pretends to be live multiplayer.
- **Contests are not playable.** They require scheduled matchmaking, so the app
  shows the interface, the format and an offline practice link instead.
- **Statik Coins (hard currency) are not purchasable** — monetisation is out of
  scope and was deliberately not recreated.
- **Puzzle ladder sizes and the exact criteria that unlock harder presets** are
  not recoverable from the strings, so difficulty is user-selected for the five
  daily puzzle types and fixed for the infinite ladder.
- **Feed and Nets** exist as named destinations in the reference app, but Feed's
  content is not recoverable and Nets is a practice preset builder; the web build
  folds both into Home/More rather than inventing a social graph or a second
  practice engine. Snacc, by contrast, *is* recovered — it is the endless puzzle
  ladder, so it lives under Puzzles with its skips.
- **Original assets are not redistributed.** The wordmark is set in type, icons
  come from Lucide, and colours were sampled from the artifact.
