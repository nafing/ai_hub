import { TwatterAppBackButton } from "./TwatterAppBackButton";
import { TwatterPageHeader } from "./TwatterPageHeader";
import classes from "./TwatterShell.module.css";

type TwatterSubpageHeaderProps = {
  title: string;
};

export function TwatterSubpageHeader({ title }: TwatterSubpageHeaderProps) {
  return (
    <TwatterPageHeader
      title={title}
      className={classes.subpageHeader}
      leading={
        <span className={classes.desktopOnly}>
          <TwatterAppBackButton />
        </span>
      }
      trailing={<span className={classes.headerSpacer} aria-hidden />}
    />
  );
}
