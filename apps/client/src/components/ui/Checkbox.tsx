import {
  forwardRef,
  useEffect,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
} from "react";
import { IconCheck, IconMinus } from "@tabler/icons-react";
import classes from "./Checkbox.module.css";

export type CheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "size" | "onChange"
> & {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  indeterminate?: boolean;
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

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox(
    {
      checked,
      onChange,
      label,
      indeterminate = false,
      disabled,
      className,
      id,
      ...props
    },
    ref,
  ) {
    const localRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (localRef.current) {
        localRef.current.indeterminate = indeterminate;
      }
    }, [indeterminate]);

    const control = (
      <span className={classes.control}>
        <input
          {...props}
          ref={mergeRefs(localRef, ref)}
          id={id}
          type="checkbox"
          className={classes.input}
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.checked)}
        />
        <span className={classes.box} aria-hidden>
          {indeterminate ? (
            <IconMinus size={11} stroke={2.5} />
          ) : (
            <IconCheck size={11} stroke={2.5} />
          )}
        </span>
      </span>
    );

    if (!label) {
      return (
        <span
          className={[classes.root, className].filter(Boolean).join(" ")}
          data-disabled={disabled || undefined}
        >
          {control}
        </span>
      );
    }

    return (
      <label
        className={[classes.root, className].filter(Boolean).join(" ")}
        data-disabled={disabled || undefined}
      >
        {control}
        <span className={classes.label}>{label}</span>
      </label>
    );
  },
);
