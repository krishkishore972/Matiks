# Server protocol

This documents the live-game protocol: what the shipped app actually does (as
recovered from the Hermes bundle), and how `apps/api` (HTTP) and `apps/ws` (live
channel) implement the same shape.

The recreation is **JSON over HTTP + WebSocket** rather than GraphQL, but the
vocabulary, the field names and the ordering guarantees are the recovered ones,
so the two can be compared without a translation table.

## Evidence

The API client is not native code. The APK's Java layer contains only payments,
analytics and crash reporting (Razorpay, Amplitude, Firebase Analytics, Sentry);
there is no Retrofit/Volley/OkHttp service definition. The client lives in the
Hermes bundle (`assets/index.android.bundle`), and 493 GraphQL documents were
extracted from it.

Hosts recovered from the bundle:

| Host | Purpose |
| --- | --- |
| `https://play-games.matiks.com` | GraphQL API (games, search, stream) |
| `cdn0.matiks.org`, `cdn.matiks.com` | Static assets |
| `cdn0-dev.matiks.org` | Staging assets |
| `lr.matiks.org` | Login/reward surface |
| `api.sakshi.matiks.org` | Separate service |
| `matiks.com/auth/apple/callback` | OAuth return |

Operations that define the live flow:

| Operation | Shape |
| --- | --- |
| `searchOpponentV3(input)` | `{ waiting, ticketId, botEligibleAtMs, game }` |
| `pollSearchV3(input)` | `{ outcome, botEligibleAtMs, game }` |
| `abortSearchTicketV3(ticketId)` | `{ aborted, game }` |
| `startGameV3(gameId)` | game |
| `submitGameQuestionActions(input)` | answer acknowledgement |
| `getLiveGameV3(id)` | game snapshot |
| `replayGameStreamV3(gameId, sinceStreamId)` | `{ events { streamId, type, payload }, streamTip, resyncRequired, resyncReason }` |
| `resignGameV3` / `endGameV2` | terminal transitions |
| `syncServerTime` | server clock |
| `acceptChallengeV3` | async challenge accept |
| `mechanicsOpts.phased` | `{ perQuestionSeconds, gapSeconds }` |
| `categoryOpts.*` | `timeLimitSeconds`, `numOfQuestions` |

Two details are worth calling out because they change the design:

1. **`botEligibleAtMs` is an absolute server timestamp**, not a countdown. The
   client shows the remaining wait and the server seats an AlphaBot when the
   clock passes it. The bundle also contains the literal string `AlphaBot`.
2. **`replayGameStreamV3` is explicitly resumable.** Every event carries a
   monotonic `streamId`, a `streamTip` marks the end, and a client that has
   fallen outside the replay window is told `resyncRequired` with a reason
   instead of silently receiving a truncated stream. That is a real, deliberate
   protocol, and it is reproduced exactly.

## Implementation

### Transport split

| Concern | Transport |
| --- | --- |
| Player data, plays, leaderboard, store, quests | HTTP JSON, Express (`apps/api/src/routes.ts`) |
| Matchmaking, running duel, clock | raw WebSocket (`apps/ws/src/hub.ts`) |

The split is by latency requirement, not by domain: everything that benefits
from push is on the socket.

### The event stream

`game_events` is append-only and its primary key is `(game_id, stream_id)`.
The next id is allocated while the parent `games` row is locked, inside the same
transaction as the write it describes. `packages/server/src/domain/stream.ts`
owns three operations:

- `appendEvent(executor, gameId, type, payload, actor?)` — must run inside the
  caller's transaction, so a score change and the event describing it commit
  together or not at all.
- `readStream(db, gameId, sinceStreamId)` — returns events after a cursor plus
  `streamTip`, or `resyncRequired` when the cursor is ahead of the tip.
- `streamTip(db, gameId)` — the current high-water mark.

Event types: `game.created`, `player.joined`, `game.started`, `question.served`,
`answer.accepted`, `answer.rejected`, `player.finished`, `player.resigned`,
`game.ended`.

Each WebSocket session remembers the last `streamId` it was sent per game, so
delivery is at-least-once with an explicit cursor rather than fire-and-forget.
Reconnects call `replay` with the last seen id.

### Server-authoritative questions

For **Sprint**, **Fastest Finger** and **DMAS** the server generates the bank
from the game id (a seeded mulberry32 RNG, the same generator the client uses),
stores prompts *and* answers in `games.config`, and serves only:

```json
{ "index": 4, "prompt": "17 + 8 × 3", "choices": [24, 41, 48, 58] }
```

The answer is compared on the server. The `config` column is never serialised
to a client; `publicConfig()` strips `questions` before the game view is built.

The memory duels (Mind Snap, Flash Anzan, Pin Ball Recall) still generate their
boards on-device, so the server owns the clock, the stream and the settlement
but only compares the reported score. This is recorded per game as
`config.questionSource: "server" | "client"` instead of being glossed over.

### Scoring cannot be farmed

`game_players.cursor` is the index a player is allowed to answer next. Scoring
updates are guarded on it:

```sql
UPDATE game_players
   SET score = score + 1, correct = correct + 1, cursor = cursor + 1
 WHERE game_id = $1 AND player_id = $2 AND cursor = $3
```

A repeat submission, or one for a question that was never served, changes
nothing and returns `already-answered`. A wrong answer counts against accuracy
but does not advance the cursor, so retrying the same question is legitimate.

### Settlement

`settleGame` ranks the seats, then sends each human player through
`recordPlay` — the *same* function a solo play uses — with the opponent's score
and, for a tie, `isDraw: true`. XP, Pies, streak, quest counters, the `plays`
row and the Elo change therefore cannot drift between a duel and a solo play:
they are the same code path. A draw is zero rating change for both seats.

Bots never settle through `recordPlay`, so they cannot inflate XP or ratings.
They are ordinary `players` rows with `is_bot = true` and a seeded `bot_skill`,
and every API response marks them `simulated: true` so the UI keeps labelling
them.

### The AlphaBot

`searchOpponent` queues a ticket with `bot_eligible_at = now + BOT_ELIGIBLE_MS`
(default 6s). `pollSearch` seats a bot once that instant passes, picks the bot
whose `bot_skill` is closest to the player's rating band, and reports
`outcome: "bot"`. The bot then plays on real timers, appending the same
`answer.accepted` / `answer.rejected` events a human would, so the opponent's
score climbs live in the other seat.

### Clock

`syncServerTime`/`syncTime` returns `{ serverTime, clientRequestTime }`. The
client stores `serverTime - Date.now()` and computes the round countdown against
`game.endTime` (an absolute server epoch millisecond value), so a skewed device
clock cannot buy extra time.

## Endpoints

### HTTP (`http://localhost:4000`)

Every request body, query string, path id and the `x-player-id` header is parsed
by a Zod schema in `apps/api/src/validation.ts` before it reaches the domain; a
failure is a `400` naming the field, not a database error.

| Method | Path | Body / query | Returns |
| --- | --- | --- | --- |
| `GET` | `/api/health` | — | `{ ok, serverTime }` |
| `GET` | `/api/catalog` | — | games, store items, puzzle tabs |
| `GET` | `/api/player` | — | profile bundle |
| `POST` | `/api/player` | — | creates if missing, returns bundle |
| `PATCH` | `/api/player` | profile patch | profile |
| `POST` | `/api/player/reset` | — | fresh bundle |
| `POST` | `/api/plays` | `{ result, opponentScore?, isDraw? }` | record outcome |
| `GET` | `/api/leaderboard` | `?scope=&category=` | rows |
| `POST` | `/api/store/:itemId` | — | purchase result |
| `POST` | `/api/quests/:questId/claim` | — | bundle or `null` |

Every player endpoint requires `x-player-id`. The id is generated client-side
and kept in `localStorage`, mirroring the shipped app's anonymous session.

### WebSocket (`ws://localhost:4001/ws?playerId=…`)

The live channel is its own process (`apps/ws`) so a duel does not share an
event loop with the leaderboard. The socket URL comes from
`NEXT_PUBLIC_WS_URL`; the server also accepts `hello` as the first message, so
the id may be supplied either way. Every frame is JSON parsed with a Zod
discriminated union (`apps/ws/src/messages.ts`); anything else gets an `error`
frame and is otherwise ignored.

Client → server: `hello`, `search`, `poll`, `abort`, `start`, `answer`, `finish`,
`resign`, `replay`, `syncTime`.

Server → client: `welcome`, `ticket`, `search`, `game`, `question`, `answer`,
`events`, `resyncRequired`, `ended`, `syncTime`, `error`.

The message types live in `packages/core/src/protocol.ts` and are imported by
both sides, so a field rename is a compile error rather than a runtime surprise.

## What this is not

- Not the real Matiks server. It is a clean implementation of the recovered
  contract against our own Postgres.
- No authentication. An anonymous id is not an identity; production would need
  the app's auth flow (the bundle references Apple/Google callbacks, which were
  not reverse engineered).
- No friend graph. `friends` scope returns the player plus other real accounts
  and never dresses a bot up as a friend.
- No contests or bracket play. The protocol for those was not recovered.
