/**
 * Wire validation is the boundary the domain relies on, so it is worth testing
 * directly rather than only through a live socket.
 */
import { describe, expect, it } from "vitest";
import { parseClientMessage } from "../src/messages";

const parse = (value: unknown) => parseClientMessage(JSON.stringify(value));

describe("client messages", () => {
  it("accepts the documented vocabulary", () => {
    const hello = parse({ t: "hello", playerId: "browser-1234" });
    expect(hello.ok).toBe(true);

    const search = parse({ t: "search", gameId: "sprint" });
    expect(search.ok).toBe(true);

    const answer = parse({
      t: "answer",
      gameId: "8a1b",
      answer: { index: 3, answer: "42", elapsedMs: 812 },
    });
    expect(answer.ok).toBe(true);

    const replay = parse({ t: "replay", gameId: "8a1b", sinceStreamId: 0 });
    expect(replay.ok).toBe(true);
  });

  it("rejects a mode the server does not know", () => {
    const result = parse({ t: "search", gameId: "not-a-mode" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("gameId");
  });

  it("rejects an unsupported player id", () => {
    const result = parse({ t: "hello", playerId: "no spaces allowed" });
    expect(result.ok).toBe(false);
  });

  it("rejects negative answer indexes and missing fields", () => {
    const negative = parse({
      t: "answer",
      gameId: "8a1b",
      answer: { index: -1, answer: 4, elapsedMs: 10 },
    });
    expect(negative.ok).toBe(false);

    const missing = parse({ t: "answer", gameId: "8a1b" });
    expect(missing.ok).toBe(false);
  });

  it("rejects malformed JSON and unknown message types", () => {
    const malformed = parseClientMessage("{not json");
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) expect(malformed.error).toBe("malformed message");

    const unknown = parse({ t: "teleport" });
    expect(unknown.ok).toBe(false);
  });
});
