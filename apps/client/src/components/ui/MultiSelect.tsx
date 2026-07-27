import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { IconCheck, IconChevronDown, IconX } from "@tabler/icons-react";
import { createPortal } from "react-dom";
import classes from "./MultiSelect.module.css";

export type MultiSelectOption = {
  value: string;
  label: string;
};

export type MultiSelectProps = {
  data: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  searchable?: boolean;
  clearable?: boolean;
  disabled?: boolean;
  error?: boolean;
  nothingFoundMessage?: string;
  searchPlaceholder?: string;
  className?: string;
};

type DropdownCoords = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: "bottom" | "top";
};

function measureDropdown(trigger: HTMLElement): DropdownCoords {
  const rect = trigger.getBoundingClientRect();
  const gap = 6;
  const preferredMax = 18 * 16;
  const spaceBelow = window.innerHeight - rect.bottom - gap - 8;
  const spaceAbove = rect.top - gap - 8;
  const placement =
    spaceBelow < 120 && spaceAbove > spaceBelow ? "top" : "bottom";
  const available = placement === "bottom" ? spaceBelow : spaceAbove;

  if (placement === "top") {
    return {
      bottom: window.innerHeight - rect.top + gap,
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(96, Math.min(preferredMax, available)),
      placement,
    };
  }

  return {
    top: rect.bottom + gap,
    left: rect.left,
    width: rect.width,
    maxHeight: Math.max(96, Math.min(preferredMax, available)),
    placement,
  };
}

export function MultiSelect({
  data,
  value,
  onChange,
  placeholder = "Select…",
  searchable = false,
  clearable = false,
  disabled = false,
  error = false,
  nothingFoundMessage = "Nothing found",
  searchPlaceholder = "Search…",
  className,
}: MultiSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [coords, setCoords] = useState<DropdownCoords | null>(null);

  const selectedLabels = useMemo(
    () =>
      value
        .map((v) => data.find((option) => option.value === v)?.label ?? v)
        .filter(Boolean),
    [data, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (option) =>
        option.label.toLowerCase().includes(q) ||
        option.value.toLowerCase().includes(q),
    );
  }, [data, query]);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) {
      setCoords(null);
      return;
    }

    function update() {
      if (!rootRef.current) return;
      setCoords(measureDropdown(rootRef.current));
    }

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, value.length]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
      setQuery("");
    }

    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
    if (searchable) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open, searchable]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  function toggle(next: string) {
    if (value.includes(next)) {
      onChange(value.filter((v) => v !== next));
    } else {
      onChange([...value, next]);
    }
  }

  function remove(next: string) {
    onChange(value.filter((v) => v !== next));
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) =>
        filtered.length === 0 ? 0 : Math.min(index + 1, filtered.length - 1),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[activeIndex];
      if (option) toggle(option.value);
    }
  }

  const display =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length <= 2
        ? selectedLabels.join(", ")
        : `${selectedLabels.length} selected`;

  const dropdownStyle: CSSProperties | undefined = coords
    ? {
        top: coords.top,
        bottom: coords.bottom,
        left: coords.left,
        width: coords.width,
        maxHeight: coords.maxHeight,
      }
    : undefined;

  const dropdown =
    typeof document === "undefined"
      ? null
      : createPortal(
          <AnimatePresence>
            {open && coords ? (
              <motion.div
                ref={dropdownRef}
                id={listId}
                className={classes.dropdown}
                role="listbox"
                aria-multiselectable
                data-glass-surface
                style={dropdownStyle}
                initial={{
                  opacity: 0,
                  y: coords.placement === "top" ? 4 : -4,
                  scale: 0.98,
                }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{
                  opacity: 0,
                  y: coords.placement === "top" ? 4 : -4,
                  scale: 0.98,
                }}
                transition={{ duration: 0.14 }}
                onKeyDown={onListKeyDown}
              >
                {searchable ? (
                  <div className={classes.search}>
                    <input
                      ref={searchRef}
                      className={classes.searchInput}
                      placeholder={searchPlaceholder}
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </div>
                ) : null}

                <div className={classes.options}>
                  {filtered.length === 0 ? (
                    <div className={classes.empty}>{nothingFoundMessage}</div>
                  ) : (
                    filtered.map((option, index) => {
                      const selectedOption = value.includes(option.value);
                      const active = index === activeIndex;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="option"
                          aria-selected={selectedOption}
                          className={[
                            classes.option,
                            selectedOption ? classes.optionSelected : "",
                            active ? classes.optionActive : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => toggle(option.value)}
                        >
                          <span className={classes.optionLabel}>
                            {option.label}
                          </span>
                          {selectedOption ? (
                            <IconCheck size={14} className={classes.check} />
                          ) : null}
                        </button>
                      );
                    })
                  )}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>,
          document.body,
        );

  return (
    <div
      ref={rootRef}
      className={[classes.root, className].filter(Boolean).join(" ")}
    >
      <button
        type="button"
        className={[
          classes.trigger,
          open ? classes.triggerOpen : "",
          error ? classes.triggerError : "",
        ]
          .filter(Boolean)
          .join(" ")}
        data-glass-surface
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <span
          className={[
            classes.value,
            selectedLabels.length === 0 ? classes.placeholder : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {display}
        </span>
        {clearable && value.length > 0 ? (
          <span
            role="button"
            tabIndex={-1}
            className={classes.clear}
            aria-label="Clear"
            onClick={(event) => {
              event.stopPropagation();
              onChange([]);
            }}
          >
            <IconX size={14} />
          </span>
        ) : null}
        <span className={classes.chevron}>
          <IconChevronDown size={16} />
        </span>
      </button>

      {value.length > 0 ? (
        <div className={classes.pills}>
          {value.map((v) => {
            const label = data.find((option) => option.value === v)?.label ?? v;
            return (
              <span key={v} className={classes.pill}>
                {label}
                <button
                  type="button"
                  className={classes.pillRemove}
                  aria-label={`Remove ${label}`}
                  disabled={disabled}
                  onClick={() => remove(v)}
                >
                  <IconX size={12} />
                </button>
              </span>
            );
          })}
        </div>
      ) : null}

      {dropdown}
    </div>
  );
}
