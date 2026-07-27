import {
  forwardRef,
  useRef,
  type ChangeEvent,
  type FocusEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type Ref,
} from "react";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import classes from "./NumberInput.module.css";

export type NumberInputValue = number | "";

export type NumberInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "size" | "type" | "value" | "onChange" | "defaultValue"
> & {
  value: number | "" | null | undefined;
  onChange: (value: NumberInputValue) => void;
  error?: boolean;
  /** Clamp to min/max when the field blurs. Default true when min/max set. */
  clampOnBlur?: boolean;
};

function mergeRefs<T>(...refs: Array<Ref<T> | undefined>) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") ref(node);
      else ref.current = node;
    }
  };
}

function toDisplay(value: number | "" | null | undefined): string {
  if (value === "" || value === null || value === undefined) return "";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function parseInput(raw: string): NumberInputValue {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : "";
}

function resolveStep(step: number | string | undefined): number {
  const stepValue =
    typeof step === "number" ? step : typeof step === "string" ? Number(step) : 1;
  return Number.isFinite(stepValue) && stepValue !== 0 ? stepValue : 1;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  function NumberInput(
    {
      value,
      onChange,
      error = false,
      className,
      min,
      max,
      step,
      clampOnBlur,
      onBlur,
      onKeyDown,
      disabled,
      readOnly,
      ...props
    },
    ref,
  ) {
    const inputRef = useRef<HTMLInputElement>(null);
    const shouldClamp = clampOnBlur ?? (min != null || max != null);
    const stepAmount = resolveStep(step);
    const numericValue =
      typeof value === "number" && Number.isFinite(value) ? value : null;
    const atMin =
      numericValue != null &&
      typeof min === "number" &&
      Number.isFinite(min) &&
      numericValue <= min;
    const atMax =
      numericValue != null &&
      typeof max === "number" &&
      Number.isFinite(max) &&
      numericValue >= max;
    const steppersDisabled = Boolean(disabled || readOnly);

    function clamp(n: number): number {
      let next = n;
      if (typeof min === "number" && Number.isFinite(min) && next < min) {
        next = min;
      }
      if (typeof max === "number" && Number.isFinite(max) && next > max) {
        next = max;
      }
      return next;
    }

    function bump(direction: 1 | -1) {
      if (steppersDisabled) return;
      const base =
        numericValue ??
        (typeof min === "number" && Number.isFinite(min) ? min : 0);
      onChange(clamp(base + direction * stepAmount));
      inputRef.current?.focus();
    }

    function handleChange(event: ChangeEvent<HTMLInputElement>) {
      onChange(parseInput(event.currentTarget.value));
    }

    function handleBlur(event: FocusEvent<HTMLInputElement>) {
      if (shouldClamp) {
        const parsed = parseInput(event.currentTarget.value);
        if (parsed !== "") {
          const next = clamp(parsed);
          if (next !== parsed) onChange(next);
        }
      }
      onBlur?.(event);
    }

    function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        if (steppersDisabled) {
          onKeyDown?.(event);
          return;
        }
        const parsed = parseInput(event.currentTarget.value);
        const base =
          parsed === ""
            ? typeof min === "number" && Number.isFinite(min)
              ? min
              : 0
            : parsed;
        event.preventDefault();
        onChange(
          clamp(base + (event.key === "ArrowUp" ? 1 : -1) * stepAmount),
        );
        return;
      }
      onKeyDown?.(event);
    }

    return (
      <div
        className={[classes.wrap, className].filter(Boolean).join(" ")}
        data-error={error || undefined}
        data-disabled={steppersDisabled || undefined}
        data-glass-surface
      >
        <input
          {...props}
          ref={mergeRefs(inputRef, ref)}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          readOnly={readOnly}
          value={toDisplay(value)}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={classes.input}
        />
        <div className={classes.controls} aria-hidden={steppersDisabled}>
          <button
            type="button"
            className={classes.step}
            tabIndex={-1}
            aria-label="Increment"
            disabled={steppersDisabled || atMax}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => bump(1)}
          >
            <IconChevronUp size={12} stroke={2.25} />
          </button>
          <button
            type="button"
            className={classes.step}
            tabIndex={-1}
            aria-label="Decrement"
            disabled={steppersDisabled || atMin}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => bump(-1)}
          >
            <IconChevronDown size={12} stroke={2.25} />
          </button>
        </div>
      </div>
    );
  },
);
