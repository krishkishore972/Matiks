/**
 * Tiny typed persistence layer.
 *
 * The web build keeps its state in `localStorage` so the app is fully playable
 * without a backend. Everything goes through this module so the real API can
 * replace it later without touching feature code.
 */

const memory = new Map<string, string>();

function hasLocalStorage(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = hasLocalStorage() ? window.localStorage.getItem(key) : memory.get(key) ?? null;
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T): void {
  try {
    const raw = JSON.stringify(value);
    if (hasLocalStorage()) window.localStorage.setItem(key, raw);
    else memory.set(key, raw);
  } catch {
    // Storage can be full or blocked (private mode). The app keeps working in
    // memory for this session.
    memory.set(key, JSON.stringify(value));
  }
}

export function remove(key: string): void {
  try {
    if (hasLocalStorage()) window.localStorage.removeItem(key);
    memory.delete(key);
  } catch {
    memory.delete(key);
  }
}
