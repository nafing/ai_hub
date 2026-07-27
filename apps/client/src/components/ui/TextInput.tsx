import {
  forwardRef,
  type InputHTMLAttributes,
} from "react";
import classes from "./TextInput.module.css";

export type TextInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "size"
> & {
  error?: boolean;
};

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput(
    { error = false, className, type = "text", ...props },
    ref,
  ) {
    return (
      <input
        {...props}
        ref={ref}
        type={type}
        className={[classes.root, error ? classes.error : "", className]
          .filter(Boolean)
          .join(" ")}
      />
    );
  },
);
