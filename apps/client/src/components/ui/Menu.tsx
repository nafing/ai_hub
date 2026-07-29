import {
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import classes from "./Menu.module.css";

type MenuContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  menuId: string;
};

const MenuContext = createContext<MenuContextValue | null>(null);

function useMenu() {
  const ctx = useContext(MenuContext);
  if (!ctx) throw new Error("Menu parts must be used within Menu");
  return ctx;
}

export type MenuProps = {
  children: ReactNode;
  className?: string;
};

export function Menu({ children, className }: MenuProps) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <MenuContext.Provider value={{ open, setOpen, menuId }}>
      <div
        ref={rootRef}
        className={[classes.root, className].filter(Boolean).join(" ")}
      >
        {children}
      </div>
    </MenuContext.Provider>
  );
}

function Target({ children }: { children: ReactElement }) {
  const { open, setOpen, menuId } = useMenu();

  if (!isValidElement(children)) return children;

  return cloneElement(children, {
    "aria-haspopup": "menu",
    "aria-expanded": open,
    "aria-controls": menuId,
    onClick: (event: MouseEvent) => {
      const original = (
        children.props as { onClick?: (e: MouseEvent) => void }
      ).onClick;
      original?.(event);
      setOpen(!open);
    },
  } as Record<string, unknown>);
}

function Dropdown({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { open, menuId } = useMenu();

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          id={menuId}
          role="menu"
          className={[classes.dropdown, className].filter(Boolean).join(" ")}
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.14 }}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Item({
  children,
  onClick,
  leftSection,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  leftSection?: ReactNode;
  className?: string;
}) {
  const { setOpen } = useMenu();

  return (
    <button
      type="button"
      role="menuitem"
      className={[classes.item, className].filter(Boolean).join(" ")}
      onClick={() => {
        onClick?.();
        setOpen(false);
      }}
    >
      {leftSection ? (
        <span className={classes.itemIcon}>{leftSection}</span>
      ) : null}
      <span className={classes.itemLabel}>{children}</span>
    </button>
  );
}

function Label({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={[classes.label, className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}

function Divider({ className }: { className?: string }) {
  return (
    <div
      role="separator"
      className={[classes.divider, className].filter(Boolean).join(" ")}
    />
  );
}

Menu.Target = Target;
Menu.Dropdown = Dropdown;
Menu.Item = Item;
Menu.Label = Label;
Menu.Divider = Divider;
