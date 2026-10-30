"use client";

import { useEffect, useRef } from "react";
import { t } from "@/lib/i18n";

const HOLD_DELAY_MS = 420;
const REPEAT_MS = 70;

interface StepperProps {
  readonly id: string;
  readonly label: string;
  readonly unit: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly disabled?: boolean;
  readonly onChange: (next: number) => void;
}

/** Big +/− stepper, step 1, long-press repeats. No keypad typing (spec §4.1). */
export function Stepper({ id, label, unit, value, min, max, disabled = false, onChange }: StepperProps) {
  const latest = useRef(value);
  const timers = useRef<{ hold?: ReturnType<typeof setTimeout>; repeat?: ReturnType<typeof setInterval> }>({});
  latest.current = value;

  const stop = () => {
    clearTimeout(timers.current.hold);
    clearInterval(timers.current.repeat);
    timers.current = {};
  };
  useEffect(() => stop, []);

  const step = (dir: 1 | -1) => {
    const next = Math.min(max, Math.max(min, latest.current + dir));
    if (next === latest.current) return stop();
    latest.current = next;
    onChange(next);
  };

  const start = (dir: 1 | -1) => {
    stop();
    step(dir);
    timers.current.hold = setTimeout(() => {
      timers.current.repeat = setInterval(() => step(dir), REPEAT_MS);
    }, HOLD_DELAY_MS);
  };

  const button = (dir: 1 | -1) => (
    <button
      type="button"
      className="stepper__btn"
      disabled={disabled}
      aria-label={t(dir > 0 ? "add.increase" : "add.decrease", { label })}
      aria-controls={id}
      onPointerDown={(e) => {
        e.preventDefault();
        start(dir);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        if (e.detail === 0) step(dir); // keyboard activation (Enter/Space)
      }}
    >
      {dir > 0 ? "+" : "−"}
    </button>
  );

  return (
    <div className="stepper" role="group" aria-label={label} data-disabled={disabled || undefined}>
      {button(-1)}
      <div>
        <div className="stepper__label">{label}</div>
        <output id={id} className="stepper__value" aria-live="polite">
          {value}
        </output>
        <div className="stepper__label">{unit}</div>
      </div>
      {button(1)}
    </div>
  );
}
