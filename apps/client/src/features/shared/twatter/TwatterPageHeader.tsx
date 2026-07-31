import type { ReactNode } from "react";
import classes from "./TwatterShell.module.css";

type TwatterPageHeaderProps = {
  title?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
  tabs?: Array<{
    id: string;
    label: string;
    active: boolean;
    onClick: () => void;
  }>;
};

export function TwatterPageHeader({
  title,
  leading,
  trailing,
  className,
  tabs,
}: TwatterPageHeaderProps) {
  const showTitleRow = Boolean(title || leading || trailing);

  return (
    <header
      className={[classes.pageHeader, className].filter(Boolean).join(" ")}
      data-glass-surface
    >
      {showTitleRow ? (
        <div className={classes.pageHeaderRow}>
          {leading ? <div className={classes.pageHeaderLeading}>{leading}</div> : null}
          {title ? <h1 className={classes.pageHeaderTitle}>{title}</h1> : null}
          {trailing ? (
            <div className={classes.pageHeaderTrailing}>{trailing}</div>
          ) : null}
        </div>
      ) : null}
      {tabs && tabs.length > 0 ? (
        <div className={classes.pageTabs} role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={tab.active}
              className={tab.active ? classes.pageTabActive : classes.pageTab}
              onClick={tab.onClick}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}
    </header>
  );
}
