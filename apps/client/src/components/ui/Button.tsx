import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import classes from "./Button.module.css";

export type ButtonVariant =
  | "primary"
  | "default"
  | "danger"
  | "dangerSolid"
  | "subtle"
  | "ghost"
  | "ghostDanger"
  | "light";

export type ButtonSize = "sm" | "md";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftSection?: ReactNode;
  rightSection?: ReactNode;
  loading?: boolean;
};

const variantClass: Record<ButtonVariant, string> = {
  primary: classes.primary,
  default: classes.default,
  danger: classes.danger,
  dangerSolid: classes.dangerSolid,
  subtle: classes.subtle,
  ghost: classes.ghost,
  ghostDanger: classes.ghostDanger,
  light: classes.light,
};

const sizeClass: Record<ButtonSize, string> = {
  sm: classes.sm,
  md: classes.md,
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "default",
      size = "md",
      leftSection,
      rightSection,
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
        ) : leftSection ? (
          <span className={classes.section}>{leftSection}</span>
        ) : null}
        {children != null && children !== false ? (
          <span className={classes.label}>{children}</span>
        ) : null}
        {!loading && rightSection ? (
          <span className={classes.section}>{rightSection}</span>
        ) : null}
      </button>
    );
  },
);
