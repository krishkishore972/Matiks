"use client";

import type { ReactNode } from "react";
import { cn } from "../../lib/utils/cn";
import { Icon } from "../icons";

/** Board container that keeps every grid square and centred. */
export function BoardFrame({
  children,
  className,
  footer,
}: {
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className={cn("rounded-[20px] border border-ink-700/70 bg-ink-900 p-2.5", className)}>
        {children}
      </div>
      {footer}
    </div>
  );
}

export function Grid({
  size,
  children,
  gap = 2,
  className,
}: {
  size: number;
  children: ReactNode;
  gap?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("grid w-full select-none", className)}
      style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, gap: `${gap}px` }}
    >
      {children}
    </div>
  );
}

export function Tile({
  children,
  onClick,
  disabled,
  className,
  style,
  ariaLabel,
}: {
  children?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={style}
      className={cn(
        "tabular relative flex aspect-square items-center justify-center rounded-[10px] text-lg font-bold transition active:scale-95 disabled:opacity-60",
        className,
      )}
    >
      {children}
    </button>
  );
}

const PAD_BASE =
  "tabular flex h-11 flex-1 items-center justify-center rounded-xl text-base font-bold transition active:scale-95";

export function NumberPad({
  max,
  onDigit,
  onBackspace,
  onClear,
  disabled,
  extra,
  className,
}: {
  max: number;
  onDigit: (digit: number) => void;
  onBackspace?: () => void;
  onClear?: () => void;
  disabled?: boolean;
  extra?: ReactNode;
  className?: string;
}) {
  const digits = Array.from({ length: max }, (_, i) => i + 1);
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap gap-2">
        {digits.map((digit) => (
          <button
            key={digit}
            type="button"
            disabled={disabled}
            onClick={() => onDigit(digit)}
            className={cn(PAD_BASE, "bg-ink-800 text-ink-50 hover:bg-ink-700 min-w-11")}
          >
            {digit}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        {onBackspace ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onBackspace}
            className={cn(PAD_BASE, "bg-ink-800 text-ink-200 hover:bg-ink-700")}
          >
            <Icon name="ArrowLeft" className="h-4 w-4" />
          </button>
        ) : null}
        {onClear ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onClear}
            className={cn(PAD_BASE, "bg-ink-800 text-ink-200 hover:bg-ink-700")}
          >
            Clear
          </button>
        ) : null}
        {extra}
      </div>
    </div>
  );
}

export function HintRow({ children, tone = "lime" }: { children: ReactNode; tone?: "lime" | "danger" | "gold" }) {
  const tones = {
    lime: "text-lime-brand",
    danger: "text-berry",
    gold: "text-gold",
  } as const;
  return (
    <p className={cn("tabular flex items-center gap-2 text-xs font-semibold", tones[tone])}>
      <Icon name="Info" className="h-3.5 w-3.5" />
      {children}
    </p>
  );
}
