import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import classes from "./ActionIcon.module.css";

export type ActionIconVariant =
  | "default"
  | "primary"
  | "ghost"
  | "ghostDanger"
  | "subtle"
  | "light";

export type ActionIconSize = "sm" | "md";

export type ActionIconProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ActionIconVariant;
  size?: ActionIconSize;
  loading?: boolean;
  children?: ReactNode;
};

const variantClass: Record<ActionIconVariant, string> = {
  default: classes.default,
  primary: classes.primary,
  ghost: classes.ghost,
  ghostDanger: classes.ghostDanger,
  subtle: classes.subtle,
  light: classes.light,
};

const sizeClass: Record<ActionIconSize, string> = {
  sm: classes.sm,
  md: classes.md,
};

export const ActionIcon = forwardRef<HTMLButtonElement, ActionIconProps>(
  function ActionIcon(
    {
      variant = "default",
      size = "md",
      loading = false,
      disabled,
      className,
      children,
      type = "button",
      ...props
    },
    ref,
  ) {
    return (
      <button
        {...props}
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={[
          classes.root,
          variantClass[variant],
          sizeClass[size],
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {loading ? (
          <span className={classes.spinner} aria-hidden />
        ) : (
          children
        )}
      </button>
    );
  },
);
