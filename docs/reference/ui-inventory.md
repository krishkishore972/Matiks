# UI inventory (recovered)

Everything here comes from the shipped `com.matiks.app` 1.51.0 build: the Android
manifest, the sampled launcher/splash assets and the 193,292 strings extracted
from `assets/index.android.bundle` (Hermes HBC v98). Where a value is a design
decision rather than a recovered constant it is marked **(inferred)**.

## Navigation model

The reference app has a deep bottom bar. This build keeps the five destinations
that carry real functionality and folds the rest into them.

| Reference destination | Web route | Notes |
| --- | --- | --- |
| Arena | `/` | Home: streak, Daily Challenge, quick duels, insights, XP board |
| Puzzles | `/puzzles` | Daily set + infinite ladder + skill duels |
| Compete | `/compete` | Duels, rating ladder, contests |
| Quests | `/quests` | Daily objectives and rewards |
| Snacc | `/store` | Pies store: shields, skips, XP booster |
| Feed, Nets | — | Named in the reference app; content not recoverable. Folded into Home/More. |
| More | `/more` | Profile, leaderboards, store, about, reset |

Secondary routes: `/daily` (Daily Challenge), `/leaderboard`, `/profile`,
`/play/[gameId]` (`?daily=1` for the daily board).

## Screen inventory and core copy

Verbatim strings from the bundle that the web UI reuses:

- Daily Challenge — "Finish all five puzzles to bank the day…" ; types: Sudoku,
  KenKen, Cross Math, Math Maze, Hectoc; divisions 1st 2000+, 2nd 1200+, 3rd
  800+.
- Infinite ladder — Queens, Tango, Zip, Patches, Pipes, Flip Match, Wend
  (this build ships Queens, Tango, Zip, Pipes and Wend).
- Streaks — "Play a duel, finish the Daily Challenge or join a contest to keep it
  alive." Streak Shield 200 Pies, maximum 2.
- Store — Pies, Pi Coins, Statik Coins, Snacc Skips, XP Booster, Streak Shields.
- Leaderboards — scopes Global / Friends / College; categories Blitz /
  Classical / Memory / Puzzle / XP.
- Quality bands — ZAP, FLOW, GRIND, CHOKE, FREEZE; "Wrong answers sit outside
  this scale."
- Blitz shapes — Dominator, Comeback, Clutch, Almost, Close Call (win) and
  Slip up, Blunder, Crushed (loss), from the lead across three 20-second
  windows.
- Contests — 80 in 8; Survival Saturday (+3s correct, −20s mistake); Speed Run;
  Road to Kolkata.

## Design tokens

Sampled from the shipped assets (launcher plate, foreground mark, splash, logo
vectors) and mirrored in `app/globals.css` as Tailwind v4 `@theme` tokens:

| Token | Value | Source |
| --- | --- | --- |
| Ink plate | `#171717` | launcher icon background |
| Brand lime | `#b1fa63` | launcher mark |
| Lime veil | `rgba(195,250,99,0.2)` | in-bundle highlight |
| Pro violet | `#7c5cff` | Pro badge |
| Win gold | `#ffc300` | reward/streak accents |
| Loss red | `#ff3b30` | error/negative states |
| Surface ramp | `#0b0b0b → #f2f2f2` | dark shell + light-mode logo |

Typography: the app bundles Montserrat (primary), Nunito Sans, Bebas Neue,
Chakra Petch, Roboto Mono and Space Mono. The web build keeps the Next default
Geist stack for body text to avoid redistributing fonts, and uses heavy weights
plus tabular numerals (`tabular`) where the reference uses them for scores and
timers.

Layout: the reference is a phone app. The web build is a centred 520px column
with a sticky top bar and a fixed bottom nav, so it reads as the same product in
a browser without pretending to be native.

Motion **(inferred)**: `animate-rise` for section entry, `animate-pop` for
flash-anzan digits, `active:scale-[0.98]` on buttons, and
`prefers-reduced-motion` support in `globals.css`.

## State surfaces the UI must handle

Every route implements loading, empty, error and success states — for example the
give-up path on a board records a below-minimum result and explains why it does
not count, and the leaderboard/duel screens state plainly that non-player rows
are simulated.
