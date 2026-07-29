import { IconArrowLeft } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import classes from "./TwatterShell.module.css";

export function TwatterAppBackButton() {
  return (
    <Link
      to="/"
      className={classes.appBackBtn}
      aria-label="Back to app home"
    >
      <IconArrowLeft size={20} />
    </Link>
  );
}
