import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import classes from "./Switch.module.css";

export type SwitchProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "type" | "onChange" | "role"
> & {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  /** Bordered surface row (forms). Default is bare. */
  variant?: "default" | "card";
};

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  function Switch(
    {
      checked,
      onChange,
      label,
      description,
      variant = "default",
      disabled,
      className,
      ...props
    },
    ref,
  ) {
    return (
      <button
        {...props}
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        data-disabled={disabled || undefined}
        className={[
          classes.root,
          variant === "card" ? classes.card : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={() => {
          if (disabled) return;
          onChange(!checked);
        }}
      >
        <span className={classes.track} data-checked={checked || undefined}>
          <span className={classes.thumb} />
        </span>
        {label || description ? (
          <span className={classes.body}>
            {label ? <span className={classes.label}>{label}</span> : null}
            {description ? (
              <span className={classes.description}>{description}</span>
            ) : null}
          </span>
        ) : null}
      </button>
    );
  },
);
