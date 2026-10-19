/**
 * End-to-end duel smoke test.
 *
 * Drives the WebSocket exactly like the web client does:
 *
 *   1. two players search the same mode and must be matched to each other;
 *   2. a lone player must be given an AlphaBot after the grace window;
 *   3. both duels are played to the end, answering from the server's prompts.
 *
 * Run it with both servers up (`pnpm dev:api` and `pnpm dev:ws`):
 *
 *   pnpm --filter @repo/ws smoke
 */
import { WebSocket } from "ws";

const URL = process.env.API_WS ?? "ws://localhost:4001/ws";
const HTTP = process.env.API_HTTP ?? "http://localhost:4000";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Solve a served prompt. The generators only emit these shapes. */
function solve(prompt) {
  const expression = prompt
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/\s+/g, "");
  if (!/^[0-9+\-*/()]+$/.test(expression)) return null;
  const value = Function(`"use strict"; return (${expression});`)();
  return Number.isFinite(value) ? Math.round(value) : null;
}

class Client {
  constructor(playerId) {
    this.playerId = playerId;
    this.log = [];
    this.question = null;
    this.answered = new Set();
    this.game = null;
    this.ended = null;
    this.ticket = null;
    this.socket = new WebSocket(`${URL}?playerId=${playerId}`);
    this.socket.on("message", (data) => this.onMessage(JSON.parse(String(data))));
    this.ready = new Promise((resolve) => this.socket.on("open", resolve));
  }

  send(message) {
    this.socket.send(JSON.stringify(message));
  }

  onMessage(message) {
    this.log.push(message.t);
    switch (message.t) {
      case "welcome":
        this.serverTime = message.serverTime;
        break;
      case "ticket":
        this.ticket = message.ticket;
        if (message.ticket.game) this.setGame(message.ticket.game);
        break;
      case "search":
        this.outcome = message.outcome;
        if (message.outcome.game) this.setGame(message.outcome.game);
        break;
      case "game":
        this.setGame(message.game);
        break;
      case "question":
        this.ask(message.question);
        break;
      case "events":
        for (const event of message.events) {
          if (event.type === "question.served") this.ask(event.payload);
        }
        break;
      case "ended":
        this.ended = message.game;
        break;
      case "error":
        console.error(`  [${this.playerId}] server error: ${message.message}`);
        break;
    }
  }

  setGame(game) {
    this.game = game;
    if (game.status === "ended") this.ended = game;
  }

  ask(question) {
    if (!question || this.answered.has(question.index)) return;
    this.answered.add(question.index);
    this.question = question;
    const answer = solve(question.prompt);
    if (answer === null) return;
    this.send({
      t: "answer",
      gameId: this.game.id,
      answer: { index: question.index, answer, elapsedMs: 400 },
    });
  }

  close() {
    this.socket.close();
  }
}

async function play(prefix, gameId, waitForMatchMs) {
  const a = new Client(`${prefix}-a-${Date.now()}`);
  const b = new Client(`${prefix}-b-${Date.now()}`);
  await Promise.all([a.ready, b.ready]);
  a.send({ t: "hello", playerId: a.playerId });
  b.send({ t: "hello", playerId: b.playerId });

  a.send({ t: "search", gameId });
  await sleep(300);
  b.send({ t: "search", gameId });

  const deadline = Date.now() + waitForMatchMs;
  while (Date.now() < deadline) {
    for (const client of [a, b]) {
      if (!client.game && client.ticket && client.ticket.waiting) {
        client.send({ t: "poll", ticketId: client.ticket.ticketId });
      }
    }
    if (a.game && b.game && a.game.id === b.game.id) break;
    await sleep(400);
  }

  if (!a.game || !b.game) throw new Error("matchmaking never produced a game");
  if (a.game.id !== b.game.id) throw new Error("the two players were put in different games");

  const seats = a.game.players.map((player) => (player.isBot ? "bot" : "human")).join("+");
  console.log(`  matched game ${a.game.id.slice(0, 8)} seats=${seats} source=${a.game.config.questionSource}`);

  for (const client of [a, b]) client.send({ t: "start", gameId: client.game.id });

  // Answers are sent from the message handler as prompts arrive; this loop only
  // waits for the server to settle the game.
  const end = Date.now() + 90_000;
  while (Date.now() < end) {
    if (a.ended && b.ended) break;
    await sleep(500);
  }

  const final = a.ended ?? b.ended;
  if (!final) throw new Error("the duel never ended");
  if (!final.result) throw new Error("the duel ended without a result");
  const board = final.result.leaderboard
    .map((row) => `${row.rank}.${row.points}(${row.correct}/${row.incorrect})`)
    .join("  ");
  console.log(`  ended status=${final.status} tie=${final.result.isTie} winner=${final.result.winnerId ? "set" : "none"}`);
  console.log(`  leaderboard ${board}`);
  console.log(
    `  rating changes ${final.result.ratingChanges.map((c) => `${c.before}->${c.after} (${c.delta >= 0 ? "+" : ""}${c.delta})`).join(", ") || "(bots only)"}`,
  );

  a.close();
  b.close();
  return { a, b, final };
}

async function soloBot(prefix, gameId) {
  const a = new Client(`${prefix}-solo-${Date.now()}`);
  await a.ready;
  a.send({ t: "hello", playerId: a.playerId });
  a.send({ t: "search", gameId });

  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline && !a.game) {
    if (a.ticket) a.send({ t: "poll", ticketId: a.ticket.ticketId });
    await sleep(600);
  }
  if (!a.game) throw new Error(`${prefix}: no AlphaBot fallback within the window`);
  const hasBot = a.game.players.some((player) => player.isBot);
  console.log(`  outcome=${a.outcome?.outcome} game=${a.game.id.slice(0, 8)} alphaBot=${hasBot}`);
  if (!hasBot) throw new Error("expected an AlphaBot seat");
  a.close();
  return hasBot;
}

console.log("duel smoke test against", URL);
const health = await fetch(`${HTTP}/api/health`).then((res) => res.json());
console.log("health", JSON.stringify(health));

console.log("\n1. two players, one game (sprint)");
await play("duo", "sprint", 12_000);

console.log("\n2. lone player gets an AlphaBot (dmas)");
await soloBot("solo", "dmas");

console.log("\nduel smoke test passed");
process.exit(0);
