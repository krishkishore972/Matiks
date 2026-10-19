import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware className join used by every component in the app. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${`${seconds}`.padStart(2, "0")}`;
}

export function formatClock(ms: number): string {
  const tenths = Math.floor((Math.max(0, ms) % 1000) / 100);
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0
    ? `${minutes}:${`${seconds}`.padStart(2, "0")}`
    : `${seconds}.${tenths}`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
