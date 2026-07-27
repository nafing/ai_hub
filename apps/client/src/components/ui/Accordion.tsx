import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { IconChevronDown } from "@tabler/icons-react";
import classes from "./Accordion.module.css";

type AccordionContextValue = {
  multiple: boolean;
  isOpen: (value: string) => boolean;
  toggle: (value: string) => void;
};

const AccordionContext = createContext<AccordionContextValue | null>(null);
const ItemContext = createContext<string | null>(null);

function useAccordion() {
  const ctx = useContext(AccordionContext);
  if (!ctx) throw new Error("Accordion parts must be used within Accordion");
  return ctx;
}

export type AccordionProps = {
  children: ReactNode;
  multiple?: boolean;
  value?: string | string[];
  defaultValue?: string | string[] | null;
  onChange?: (value: string | string[]) => void;
  className?: string;
};

export function Accordion({
  children,
  multiple = false,
  value: controlled,
  defaultValue = multiple ? [] : null,
  onChange,
  className,
}: AccordionProps) {
  const [uncontrolled, setUncontrolled] = useState<string | string[] | null>(
    defaultValue,
  );
  const current = controlled ?? uncontrolled;

  function isOpen(itemValue: string) {
    if (multiple) {
      return Array.isArray(current) && current.includes(itemValue);
    }
    return current === itemValue;
  }

  function toggle(itemValue: string) {
    let next: string | string[] | null;
    if (multiple) {
      const list = Array.isArray(current) ? current : [];
      next = list.includes(itemValue)
        ? list.filter((v) => v !== itemValue)
        : [...list, itemValue];
    } else {
      next = current === itemValue ? null : itemValue;
    }

    if (controlled === undefined) setUncontrolled(next);
    if (multiple) {
      onChange?.((next as string[]) ?? []);
    } else {
      onChange?.((next as string) ?? "");
    }
  }

  return (
    <AccordionContext.Provider value={{ multiple, isOpen, toggle }}>
      <div className={[classes.root, className].filter(Boolean).join(" ")}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

function Item({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const { isOpen } = useAccordion();
  const open = isOpen(value);

  return (
    <ItemContext.Provider value={value}>
      <div
        className={[
          classes.item,
          open ? classes.itemOpen : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        data-open={open || undefined}
        data-glass-surface
      >
        {children}
      </div>
    </ItemContext.Provider>
  );
}

function Control({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { isOpen, toggle } = useAccordion();
  const value = useContext(ItemContext);
  if (!value) throw new Error("Accordion.Control must be inside Accordion.Item");
  const open = isOpen(value);

  return (
    <button
      type="button"
      className={[classes.control, className].filter(Boolean).join(" ")}
      aria-expanded={open}
      onClick={() => toggle(value)}
    >
      <span className={classes.controlContent}>{children}</span>
      <span
        className={[classes.chevron, open ? classes.chevronOpen : ""]
          .filter(Boolean)
          .join(" ")}
      >
        <IconChevronDown size={16} />
      </span>
    </button>
  );
}

function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { isOpen } = useAccordion();
  const value = useContext(ItemContext);
  if (!value) throw new Error("Accordion.Panel must be inside Accordion.Item");
  if (!isOpen(value)) return null;

  return (
    <div className={[classes.panel, className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}

Accordion.Item = Item;
Accordion.Control = Control;
Accordion.Panel = Panel;
