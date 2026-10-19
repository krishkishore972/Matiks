"use client";

import type { GameSession } from "../../lib/hooks/useGameSession";

/** Shared contract for every playable board. */
export interface BoardProps {
  session: GameSession;
  /** Called once the board is complete; the host scores and records it. */
  onSolved: (detail?: Record<string, number | string | boolean>) => void;
}
