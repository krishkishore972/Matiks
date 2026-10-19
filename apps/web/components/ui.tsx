"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "../lib/utils/cn";
import { Icon } from "./icons";

export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return (
    <Tag
      className={cn(
        "rounded-[20px] border border-ink-700/70 bg-ink-900/80 p-4 shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function SectionTitle({
  title,
  action,
  href,
  actionLabel,
}: {
  title: string;
  action?: () => void;
  href?: string;
  actionLabel?: string;
}) {
  return (
    <div className="mb-2 flex items-baseline justify-between">
      <h2 className="text-sm font-semibold tracking-wide text-ink-100 uppercase">{title}</h2>
      {href ? (
        <Link href={href} className="text-xs font-medium text-lime-brand hover:underline">
          {actionLabel ?? "See all"}
        </Link>
      ) : action ? (
        <button type="button" onClick={action} className="text-xs font-medium text-lime-brand">
          {actionLabel ?? "See all"}
        </button>
      ) : null}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-lime-brand text-lime-ink hover:bg-lime-soft",
  secondary: "bg-ink-700 text-ink-50 hover:bg-ink-600",
  ghost: "bg-transparent text-ink-200 hover:bg-ink-800",
  danger: "bg-berry/90 text-white hover:bg-berry",
};

export function Button({
  children,
  onClick,
  variant = "primary",
  className,
  disabled,
  type = "button",
  fullWidth,
  icon,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  fullWidth?: boolean;
  icon?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45",
        BUTTON_STYLES[variant],
        fullWidth && "w-full",
        className,
      )}
    >
      {icon ? <Icon name={icon} className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

export function Pill({
  children,
  icon,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  icon?: string;
  tone?: "neutral" | "lime" | "gold" | "violet" | "danger" | "sky";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-ink-800 text-ink-100",
    lime: "bg-lime-brand/15 text-lime-brand",
    gold: "bg-gold/15 text-gold",
    violet: "bg-violet/15 text-violet",
    danger: "bg-berry/15 text-berry",
    sky: "bg-sky/15 text-sky",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        tones[tone],
        className,
      )}
    >
      {icon ? <Icon name={icon} className="h-3.5 w-3.5" /> : null}
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  tone = "lime",
  className,
  label,
}: {
  value: number;
  tone?: "lime" | "gold" | "violet" | "sky";
  className?: string;
  label?: string;
}) {
  const tones: Record<string, string> = {
    lime: "bg-lime-brand",
    gold: "bg-gold",
    violet: "bg-violet",
    sky: "bg-sky",
  };
  return (
    <div className={cn("w-full", className)}>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-ink-700"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        aria-label={label}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", tones[tone])}
          style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
        />
      </div>
    </div>
  );
}

export function GameTile({ href, icon, title, meta, accent, locked }: {
  href: string;
  icon: string;
  title: string;
  meta: string;
  accent: string;
  locked?: boolean;
}) {
  const body = (
    <div className="flex h-full flex-col justify-between gap-3">
      <span
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${accent}22`, color: accent }}
      >
        <Icon name={locked ? "Lock" : icon} className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-sm font-semibold text-ink-50">{title}</span>
        <span className="block text-xs text-ink-300">{meta}</span>
      </span>
    </div>
  );

  if (locked) {
    return (
      <div className="rounded-[18px] border border-ink-800 bg-ink-900/60 p-3 opacity-70">{body}</div>
    );
  }

  return (
    <Link
      href={href}
      className="rounded-[18px] border border-ink-700/70 bg-ink-900 p-3 transition hover:border-lime-brand/50 active:scale-[0.98]"
    >
      {body}
    </Link>
  );
}

export function StatBlock({ label, value, hint, icon, tone }: {
  label: string;
  value: string;
  hint?: string;
  icon?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl border border-ink-700/70 bg-ink-900/70 p-3">
      <div className="flex items-center gap-1.5 text-xs text-ink-300">
        {icon ? <Icon name={icon} className="h-3.5 w-3.5" /> : null}
        {label}
      </div>
      <div className="tabular mt-1 text-lg font-bold" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-[11px] text-ink-400">{hint}</div> : null}
    </div>
  );
}

export function StateBlock({
  state,
  title,
  message,
  action,
}: {
  state: "loading" | "empty" | "error";
  title?: string;
  message?: string;
  action?: { label: string; onClick: () => void };
}) {
  const icon = state === "loading" ? "Loader2" : state === "error" ? "CircleAlert" : "Sparkles";
  const fallbackTitle =
    state === "loading" ? "Loading" : state === "error" ? "Something went wrong" : "Nothing here yet";

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-ink-800 bg-ink-900/60 px-4 py-8 text-center">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-ink-800 text-lime-brand">
        <Icon
          name={icon}
          className={cn("h-5 w-5", state === "loading" && "animate-spin")}
        />
      </span>
      <div>
        <p className="text-sm font-semibold text-ink-50">{title ?? fallbackTitle}</p>
        {message ? <p className="mt-1 text-xs text-ink-300">{message}</p> : null}
      </div>
      {action ? (
        <Button variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

export function InfoNote({ children, icon = "Info" }: { children: ReactNode; icon?: string }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-ink-800/60 px-3 py-2 text-[11px] leading-relaxed text-ink-300">
      <Icon name={icon} className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lime-brand" />
      <span>{children}</span>
    </p>
  );
}

export function Modal({
  open,
  onClose,
  children,
  title,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div
        className="animate-rise w-full max-w-[520px] rounded-t-[24px] border border-ink-700 bg-ink-900 p-4 sm:rounded-[24px]"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-ink-50">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-ink-300 hover:bg-ink-800"
          >
            <Icon name="X" className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
