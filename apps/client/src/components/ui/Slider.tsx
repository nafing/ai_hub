import {
  forwardRef,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import classes from "./Slider.module.css";

export type SliderMark = {
  value: number;
  label?: ReactNode;
};

export type SliderProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "size" | "value" | "onChange" | "defaultValue"
> & {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  marks?: SliderMark[] | boolean;
};

function progressPercent(value: number, min: number, max: number) {
  if (max <= min) return 0;
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

function defaultMarks(min: number, max: number): SliderMark[] {
  const mid = min + (max - min) / 2;
  return [
    { value: min, label: String(min) },
    { value: mid, label: String(mid) },
    { value: max, label: String(max) },
  ];
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  function Slider(
    {
      value,
      onChange,
      min = 0,
      max = 100,
      step = 1,
      marks,
      disabled,
      className,
      style,
      ...props
    },
    ref,
  ) {
    const resolvedMarks =
      marks === true
        ? defaultMarks(min, max)
        : Array.isArray(marks)
          ? marks
          : null;
    const progress = progressPercent(value, min, max);

    return (
      <div
        className={[classes.root, className].filter(Boolean).join(" ")}
        data-disabled={disabled || undefined}
      >
        <input
          {...props}
          ref={ref}
          type="range"
          className={classes.slider}
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          style={
            {
              ...style,
              ["--slider-progress" as string]: `${progress}%`,
            } as CSSProperties
          }
          onChange={(event) => onChange(Number(event.currentTarget.value))}
        />
        {resolvedMarks ? (
          <div className={classes.marks}>
            {resolvedMarks.map((mark) => (
              <span key={String(mark.value)} className={classes.mark}>
                {mark.label ?? mark.value}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    );
  },
);
