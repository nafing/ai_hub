import { useEffect, useId, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { IconX } from "@tabler/icons-react";
import { createPortal } from "react-dom";
import classes from "./Modal.module.css";

export type ModalSize = "sm" | "md" | "lg" | "xl";

export type ModalProps = {
  opened: boolean;
  onClose: () => void;
  title?: ReactNode;
  children?: ReactNode;
  size?: ModalSize;
  centered?: boolean;
  closeOnClickOutside?: boolean;
  closeOnEscape?: boolean;
  withCloseButton?: boolean;
  className?: string;
  bodyClassName?: string;
};

export function Modal({
  opened,
  onClose,
  title,
  children,
  size = "md",
  closeOnClickOutside = false,
  closeOnEscape = true,
  withCloseButton = true,
  className,
  bodyClassName,
}: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!opened || !closeOnEscape) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [opened, closeOnEscape, onClose]);

  useEffect(() => {
    if (!opened) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [opened]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {opened ? (
        <motion.div
          className={classes.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={closeOnClickOutside ? onClose : undefined}
        >
          <motion.div
            className={[classes.panel, classes[size], className]
              .filter(Boolean)
              .join(" ")}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            data-glass-surface
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18 }}
            onClick={(event) => event.stopPropagation()}
          >
            {title || withCloseButton ? (
              <div className={classes.header}>
                {title ? (
                  <h3 id={titleId} className={classes.title}>
                    {title}
                  </h3>
                ) : (
                  <span />
                )}
                {withCloseButton ? (
                  <button
                    type="button"
                    className={classes.close}
                    aria-label="Close"
                    onClick={onClose}
                  >
                    <IconX size={16} />
                  </button>
                ) : null}
              </div>
            ) : null}
            <div
              className={[classes.body, bodyClassName].filter(Boolean).join(" ")}
            >
              {children}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
