"use client";

/**
 * Client-side player state.
 *
 * Wraps the `Backend` seam in a React context so screens can read the profile,
 * wallet, streak and quests and write results without knowing how they are
 * stored. Everything is loaded in an effect, so server rendering stays neutral.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getBackend,
  type ProfileBundle,
  type PurchaseResult,
  type RecordOutcome,
  type RecordRequest,
} from "../services/backend";
import type { PlayerProfile } from "../types";

interface PlayerContextValue {
  bundle: ProfileBundle | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  record: (request: RecordRequest) => Promise<RecordOutcome>;
  purchase: (itemId: string) => Promise<PurchaseResult>;
  claimQuest: (questId: string) => Promise<void>;
  updateProfile: (patch: Partial<PlayerProfile>) => Promise<void>;
  reset: () => Promise<void>;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [bundle, setBundle] = useState<ProfileBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const next = await getBackend().load();
      setBundle(next);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load player data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const record = useCallback(async (request: RecordRequest) => {
    const outcome = await getBackend().record(request);
    setBundle(await getBackend().load());
    return outcome;
  }, []);

  const purchase = useCallback(async (itemId: string) => {
    const result = await getBackend().purchase(itemId);
    setBundle(await getBackend().load());
    return result;
  }, []);

  const claimQuest = useCallback(async (questId: string) => {
    const next = await getBackend().claimQuest(questId);
    if (next) setBundle(next);
    else setBundle(await getBackend().load());
  }, []);

  const updateProfile = useCallback(async (patch: Partial<PlayerProfile>) => {
    await getBackend().updateProfile(patch);
    setBundle(await getBackend().load());
  }, []);

  const reset = useCallback(async () => {
    setBundle(await getBackend().reset());
  }, []);

  const value = useMemo<PlayerContextValue>(
    () => ({ bundle, loading, error, reload, record, purchase, claimQuest, updateProfile, reset }),
    [bundle, loading, error, reload, record, purchase, claimQuest, updateProfile, reset],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const context = useContext(PlayerContext);
  if (!context) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return context;
}
