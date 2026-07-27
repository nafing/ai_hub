import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import classes from "./Tabs.module.css";

type TabsContextValue = {
  value: string;
  setValue: (value: string) => void;
};

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Tabs components must be used within Tabs");
  return ctx;
}

export type TabsProps = {
  children: ReactNode;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
};

export function Tabs({
  children,
  defaultValue = "",
  value: controlledValue,
  onChange,
  className,
}: TabsProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const value = controlledValue ?? uncontrolled;

  function setValue(next: string) {
    if (controlledValue === undefined) setUncontrolled(next);
    onChange?.(next);
  }

  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div className={[classes.root, className].filter(Boolean).join(" ")}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

function List({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[classes.list, className].filter(Boolean).join(" ")}
      role="tablist"
    >
      {children}
    </div>
  );
}

function Tab({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const { value: active, setValue } = useTabsContext();
  const selected = active === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      className={[
        classes.tab,
        selected ? classes.tabActive : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={() => setValue(value)}
    >
      {children}
    </button>
  );
}

function Panel({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const { value: active } = useTabsContext();
  if (active !== value) return null;

  return (
    <div
      role="tabpanel"
      className={[classes.panel, className].filter(Boolean).join(" ")}
    >
      {children}
    </div>
  );
}

Tabs.List = List;
Tabs.Tab = Tab;
Tabs.Panel = Panel;
