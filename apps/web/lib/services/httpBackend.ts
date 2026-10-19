/**
 * The HTTP implementation of `Backend`.
 *
 * This is what makes the seam in `backend.ts` worth having: the screens import
 * `getBackend()`, and this class talks to `apps/api` instead of `localStorage`.
 * Nothing in the UI knows the difference.
 *
 * Selection is explicit, not magic: set `NEXT_PUBLIC_API_URL` and the app is
 * server-backed; leave it unset and the app runs entirely offline on the local
 * backend. There is no silent fallback, because a half-server, half-local
 * player state is worse than a clear error.
 */
import type {
  Backend,
  ProfileBundle,
  PurchaseResult,
  RecordOutcome,
  RecordRequest,
} from "./backend";
import type { LeaderboardCategory } from "./leaderboard";
import type { LeaderboardEntry, LeaderboardScope, PlayerProfile } from "../types";

const PLAYER_KEY = "matiks:v1:playerId";

/** Stable anonymous id, the same idea as the shipped app's anonymous session. */
export function localPlayerId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = window.localStorage.getItem(PLAYER_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(PLAYER_KEY, id);
  }
  return id;
}

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
}

export function apiBaseUrl(): string {
  return baseUrl();
}

export class HttpBackend implements Backend {
  private base: string;

  constructor(base: string) {
    this.base = base.replace(/\/$/, "");
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.base}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        "x-player-id": localPlayerId(),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
      let message = `${method} ${path} failed (${response.status})`;
      try {
        const payload = (await response.json()) as { error?: string };
        if (payload.error) message = payload.error;
      } catch {
        // The status line is enough when the body is not JSON.
      }
      throw new Error(message);
    }

    return (await response.json()) as T;
  }

  async load(): Promise<ProfileBundle> {
    return this.call<ProfileBundle>("GET", "/api/player");
  }

  async record(request: RecordRequest): Promise<RecordOutcome> {
    return this.call<RecordOutcome>("POST", "/api/plays", request);
  }

  async leaderboard(
    scope: LeaderboardScope,
    category: LeaderboardCategory,
  ): Promise<LeaderboardEntry[]> {
    const query = new URLSearchParams({ scope, category });
    return this.call<LeaderboardEntry[]>("GET", `/api/leaderboard?${query.toString()}`);
  }

  async purchase(itemId: string): Promise<PurchaseResult> {
    return this.call<PurchaseResult>("POST", `/api/store/${encodeURIComponent(itemId)}`);
  }

  async claimQuest(questId: string): Promise<ProfileBundle | null> {
    return this.call<ProfileBundle | null>(
      "POST",
      `/api/quests/${encodeURIComponent(questId)}/claim`,
    );
  }

  async updateProfile(patch: Partial<PlayerProfile>): Promise<PlayerProfile> {
    return this.call<PlayerProfile>("PATCH", "/api/player", patch);
  }

  async reset(): Promise<ProfileBundle> {
    return this.call<ProfileBundle>("POST", "/api/player/reset");
  }
}
