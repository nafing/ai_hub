import {
  forwardRef,
  useLayoutEffect,
  useRef,
  type TextareaHTMLAttributes,
  type Ref,
} from "react";
import classes from "./Textarea.module.css";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  error?: boolean;
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

function autosize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    { onInput, style, value, defaultValue, error = false, className, ...props },
    ref,
  ) {
    const localRef = useRef<HTMLTextAreaElement>(null);

    useLayoutEffect(() => {
      autosize(localRef.current);
    }, [value, defaultValue]);

    useLayoutEffect(() => {
      const el = localRef.current;
      if (!el) return;
      const onResize = () => autosize(el);
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }, []);

    return (
      <textarea
        {...props}
        ref={mergeRefs(localRef, ref)}
        value={value}
        defaultValue={defaultValue}
        className={[classes.root, error ? classes.error : "", className]
          .filter(Boolean)
          .join(" ")}
        style={{ resize: "none", overflow: "hidden", ...style }}
        onInput={(event) => {
          autosize(event.currentTarget);
          onInput?.(event);
        }}
      />
    );
  },
);
