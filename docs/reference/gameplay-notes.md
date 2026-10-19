# Matiks — gameplay notes (from the shipped Android artifact)

Evidence base: `com.matiks.app` 1.51.0 Hermes bundle string table (193,292
strings). Quotes below are **verbatim string literals** from that table; i18n
keys are named where they are known. Numeric parameters that never appear in
strings are listed under "Unknowns" — they are *not* guessed at in code.

## 1. Formats

> "…across all four categories (Math, Memory, Puzzle, Classical) and all formats
> **(1v1 Duels, Daily Challenges, and Weekly Contests including 80 in 8,
> Survival Saturday and Sumday Showdown**)."

> "“Duel” — a 1v1 rated match. “Daily Challenge” — a best-score mode.
> “Contest” — a weekly competition (e.g., 80 in 8, Survival Saturday,
> Sumday Showdown)."

| Format | Evidence |
|---|---|
| 1v1 Duels | `gameV2`/`gameV3`, `gameType.*`, `PlayVsBot`, `MemoryDuel` |
| Daily Challenge | `dailyChallenge.*`, `DailyChallengeType`, `ChallengeDivision` |
| Weekly contests | `speedRun*`, `survivalSaturday*`, `SUMDAY_SHOWDOWN`, `80_in_8`, `roadToKolkata*` |
| Infinite Puzzle ("Snacc") | `infinitePuzzle.*`, `snaccSkips`, `InfiniteLevelsPage` |
| Practice ("Nets") | `nets.*`, `LearnPracticeSession`, `PracticeSessionStatus` |
| Arena hub | `arena.*`, `HubPhase`, `deriveHubPhase` |
| Showdown / group play | `showdown*`, `BrumblePhaseKind`, `groupPlayPhase` |
| AlphaBot | `alphaBot*`, `isAlphaBotGameType` |

Categories: `Math`, `Memory`, `Puzzle`, `Classical`/`Logic` (the two words both
appear; their relationship is **unknown**).

## 2. Ratings, quality bands and game shapes

- Elo-style per-puzzle ratings: `getRatingByGameType`, `perPuzzleRatingSection`.
  Named ratings: `puzzleRating`, `globalRating`, `memoryRating`,
  `classicalRating`, `blitzRating`, `flashAnzanRating`, `abilityDuelsRating`.
- Memory Rating = average of Mind Snap and Pin Ball Recall ratings. Flash Anzan
  was **removed from Memory** and moved to Math.
- Solve-quality bands (5): **ZAP, FLOW, GRIND, CHOKE, FREEZE**
  (`InsightsQuality.speedBands`). Verbatim: *"Wrong answers sit outside this
  scale. It only tracks correct solves and how sharp they were. A win with PACEs
  is a warning; a loss with 6 ZAPs still has a silver lining."*
- Blitz duel shapes (8; 5 winning, 3 losing): **Dominator, Comeback, Clutch,
  Almost, Close Call** / **Slip up, Blunder, Crushed**. Verbatim: *"Every Blitz
  duel ends with one of 8 shapes… based on how the lead moved across the 60
  seconds."*

## 3. Mode rules (verbatim)

### Blitz
> "Every 60-second duel, split into three 20-second windows."

### Sprint / Sprint Duel
> "In a 60-second sprint you play boards back to back. Your first board is board
> position 1, your second is position 2, and so on."

Sprint is configurable (`{minutes} MIN SPRINT`; a "15-second math sprint with 30
questions" string also exists). A KenKen preset sprint is "a fixed 120-second
run". Rating applies to Sprint & Fastest Finger.

### Fastest Finger / Tap First
> "PLAY 1-MIN FASTEST FINGER DUEL"; "race to solve the most in 1 minute"

### Flash Anzan
> "Flash Anzan has 3 rounds of fast mental addition."

Preset knobs named in the bundle: numbers flashing (count), number of digits,
time interval, include subtraction, scoring, rounds overview, prep arena, prep
timer, answer phase.

### Mind Snap
> "Memorise and Tap the correct pattern as fast as you can."
> "You have to remember the tiles were flashing and tap the same tiles as soon
> as they vanish."
> "**Each correct tap +1, each wrong –1. You get only as many taps as
> highlighted tiles.**"
> Preset format: *"a is the grid dimension (`25G = 5×5 grid with 25 cells`), b is
> how many squares light up as targets (`9S = 9 squares to memorise`)."*

### Pin Ball Recall
> "Track the ball through the bumpers, then recall its exit."
> "Statistics row: PinBall points earned — an exact exit is 1, an adjacent tap
> 0.5."
> bumpers auto hide after 5 seconds (`BUMPER_FADE_MS`)

### DMAS
> "Solve DMAS problems at the top and enter your answer below. Difficulty scales
> with your rating."

Variants: `dmas`, `dmasAbility`, `dmasTimeBank`.

### Cross Math
> "Each row and column is a math equation that must be solved using BODMAS."
> Alternate preset: *"No BODMAS here, do calculations as you move. Always left
> to right."*

Presets: operations grid + hidden cells; "grid size must be a perfect square".
Variants: `crossMathPuzzle`, `crossMathPuzzleDuel`,
`crossMathPuzzleWithFriend`, `endlessCrossMathPuzzle`.

### KenKen
> "You'll see heavily outlined areas called \"cages.\" These contain one or more
> squares."
> "Each cage has a \"clue\" in the corner: a target number and a mathematical
> operation (+, -, ×, ÷)."
> "Each number must appear exactly once in each row/column."

Worked examples: `+10` in three squares could be 1,4,5; `-5` in two squares is a
difference of 5; `÷2` two squares → {4,2} or {2,1}; "Order does not matter for
subtraction and division!". Overtime tiebreaker when both finish with the same
score.

### Sudoku / Mini Sudoku
> "Fill in the numbers 1 to 6 so that no number repeats in any row, any column,
> or any box."
> "For an N×N grid (like 4x4), you'll use the numbers 1 to N."

Presets: size (`nine`, `six`, Mini 4×4/6×6) × difficulty (easy/medium/hard).
Helpers: `SUDOKU_DIFFICULTY_META`, `sudokuBandForBlanks`,
`sudokuDifficultyFromClues`.

### Math Maze
> "Solve the maze so your path equals this total."

Steps named verbatim: **"Make a Path", "Left to Right", "Finish Strong"**.

### Hectoc
> "It's a fun logic puzzle that combines arithmetic with Sudoku-like rules."

Puzzle string carries 6 digits (`validateHectocSolution`,
`HectocBackspaceButton`).

### Ability Duels / Sum of Squares
> "Numbers when squared and added give the target number"
> "But Sum of Squares can have multiple solutions"
> "💡 Use space to separate multiple numbers"
> "`{sumOfSquares} is more than the target number of {target}`" (overshoot)

### Infinite Puzzle (Snacc)
> "Solve an endless stream of puzzles at your own pace. No timers, no pressure."
> "Don't feel like solving the puzzle? You can always skip by swiping up."
> "You can skip only {limit} puzzles per day. Your free skips reset tomorrow."

Level map with tiers (`LEVEL_MAP_TIERS`, `InfiniteLevelsPage`), new puzzle games
unlock at levels, hints bought with Pies (`FIRST_HINT_UNLOCK_MS`,
`NEXT_HINT_UNLOCK_MS`).

### Daily Challenge
> "There is only one such challenge per day and it will be renewed every day
> after the expiration of the previous one."
> "You have already attempted today's Daily Challenge, Try again tomorrow."

Types: `sudoku`, `kenKen`, `crossMath`, `mathMaze`, `hectoc`, `open`; categories
math / puzzle / memory. Divisions: 1st 2000+, 2nd 1200+, 3rd 800+, plus Open.
"Daily Challenge Blitz" is a 60-second variant.

### Weekly contests
- **80 in 8**: *"arithmetic questions (add, subtract, multiply, divide) will
  appear one by one. Your goal is to finish all 80 as fast as you can."* …
  *"You get three attempts. The first attempt is free, second and third attempt
  will cost you 50 and 100 pies respectively"* … *"Your best time out of the
  three attempts is what counts on the leaderboard."*
- **Survival Saturday**: *"You start with 2 mins. Each correct answer adds +3s,
  each wrong answer deducts -20s. Survive the longest to win! You get 3 attempts,
  and your best time counts on the leaderboard."*
- **Speed Run campaign**: *"The player who completes all 80 questions in the
  least time ranks highest"*; sections with percentile standings
  (*"Percentile per section, out of 100"*); MindSnap sets are ranked on
  **accuracy** (*"Runs are ranked on accuracy — your score out of that set's
  total"*).
- **Road to Kolkata (WSPC)**: *"Round 1, the Qualifier: Solve {puzzles} across
  {types, plural, =4 {four types}…}. Every puzzle counts toward your leaderboard
  rank."* … *"The top {count} on the leaderboard move to the Finale. You have 2
  attempts to record your best time."* Puzzle types are Sudoku, KenKen, Cross
  Math, Math Maze; 2500+ rated or WSPC players skip the Qualifier.
- **75 Smart** (Pro): *"Complete five small tasks each day for 75 days"*,
  checkpoints on days 7, 25, 50, 75.

### Streaks & shields
> "To earn today's streak, just do any one: Play a Duel, finish the Daily
> Challenge, or join a Contest."
> "You can get it from the Store for 200 Pies. You can hold a maximum of 2
> Streak Shields at a time."
> "1 Streak shield only protects 1 day."

## 4. Cross-cutting duel rules

- **Minimum score for a play to count** (from the quest-rules string):
  Mind Snap 60, Flash Anzan 90, Sprint 10, Ability 8, Fastest Finger 5,
  Cross Math 4, Math Maze 4, KenKen 2, Sudoku 2.
- Exiting mid-game below that minimum counts as no progress; only normal
  matchmaking duels count for quests (friend games do not).
- **Accuracy redefined**: *"We're now counting every wrong attempt. Earlier, only
  your final submission counted toward accuracy. Now we track every backspace,
  clear and retry."*
- **Overtime**: *"An OT (Overtime) Tiebreaker occurs when both players finish a
  duel with the same score."* / *"Instead of ending in a tie, the game enters
  overtime to determine a winner."*

## 5. Unknowns (deliberately not implemented as if known)

- Numeric cut-offs for the ZAP/FLOW/GRIND/CHOKE/FREEZE bands; the exact scoring
  formulas per mode; board-size ranges and timers for KenKen/Sudoku/Math
  Maze/Hectoc/Cross Math/DMAS/SOS.
- Speed Run section count and per-section time limits; Sumday Showdown scoring.
- Whether the 3-attempt rule (free/50/100 pies) applies to the Daily Challenge or
  only contests — the only evidence sits inside a contest how-to string.
- Infinite Puzzle level sizes / XP curve / daily free-skip cap.
- Whether "Logic" and "Classical" are the same category.

## 6. What this build implements

The evidence above is what the app is modelled on. This table is the honest
mapping between that evidence and the shipped code — including where the web
build deliberately reduces scope.

| Recovered | Implemented | Where |
|---|---|---|
| 1v1 Duels, 60s in three 20s windows | Yes, against a clearly-labelled simulated rival | `GameHost.tsx`, `components/games/*Duel.tsx` |
| Daily Challenge (Sudoku, KenKen, Cross Math, Math Maze, Hectoc) | Yes, seeded from the date so everyone gets the same five | `lib/games/*`, `app/daily` |
| Snacc — endless ladder, no timers | Yes (Queens, Tango, Zip, Pipes, Wend) with skips | `app/puzzles`, `app/play/[gameId]` |
| Pi Store (Pies, Skips, XP Booster, Streak Shields) | Yes; Statik Coins deliberately not sold | `app/store` |
| Streaks + Streak Shields (200 Pies, max 2) | Yes | `lib/services/backend.ts` |
| League divisions 1st 2000+ / 2nd 1200+ / 3rd 800+ | Shown on Puzzles | `app/puzzles` |
| Weekly contests | Interface only, marked **Needs server** — no fake brackets | `app/compete` |
| Nets (practice preset builder) | Not built; folded into Home/More | `components/AppShell.tsx` |
| Feed, Friends, Chat, Jelo, Societies, Showdown, AlphaBot | Not built | — |
| Per-puzzle ratings, memory rating = mean(Mind Snap, Pin Ball) | Per-mode Elo-style rating | `lib/scoring.ts` |
| Quality bands, blitz shapes | Yes | `lib/scoring.ts` |

## 7. Inferred maths (not recoverable from the artifact)

Every constant here is an invention that satisfies the evidenced rules; none of
it is presented in the UI as recovered fact.

- **Puzzle score:** `1000 × difficultyWeight × (0.5 + 0.5·accuracy) × (0.7 + 0.3·speed)`,
  floored at 0 when unsolved. Weights: easy 1, medium 1.35, hard 1.75, expert 2.2.
- **Par times:** easy 90s, medium 150s, hard 240s, expert 360s.
- **Quality bands:** solve-time ratio to par — ≤0.5 ZAP, ≤0.9 FLOW, ≤1.4 GRIND,
  ≤2.2 CHOKE, else FREEZE.
- **Blitz shape:** decided by the lead profile across the three 20-second windows.
- **Rating:** Elo-style; K shrinks as games pile up.
- **XP:** `score/10 + 25` when solved, doubled while an XP Booster runs. A level
  costs `250 × level` XP.
- **Pies:** paid only when a play beats the mode minimum (the store copy ties
  Pies to finishing boards above the minimum score).
- **Snacc skips:** a flat 120 Pies per skip; a fresh set of free skips each day.
