import type { ReactNode } from "react";
import { findTwatterTextMentions, type TwatterAccount } from "@ai-hub/shared";
import classes from "./TwatterFeed.module.css";

type TwatterMentionTextProps = {
  text: string;
  accounts: TwatterAccount[];
  onMentionClick?: (accountId: string) => void;
};

export function TwatterMentionText({
  text,
  accounts,
  onMentionClick,
}: TwatterMentionTextProps) {
  const mentions = findTwatterTextMentions(text);
  if (mentions.length === 0) {
    return <>{text}</>;
  }

  const handleToAccount = new Map(
    accounts.map((account) => [
      account.handle.replace(/^@+/u, "").toLowerCase(),
      account,
    ]),
  );

  const parts: Array<{ key: string; node: ReactNode }> = [];
  let cursor = 0;

  mentions.forEach((mention, index) => {
    if (mention.start > cursor) {
      parts.push({
        key: `text-${index}`,
        node: text.slice(cursor, mention.start),
      });
    }

    const account = handleToAccount.get(mention.handle);
    const label = text.slice(mention.start, mention.end);
    parts.push({
      key: `mention-${index}`,
      node: account ? (
        <button
          type="button"
          className={classes.mentionLink}
          onClick={() => onMentionClick?.(account.id)}
        >
          {label}
        </button>
      ) : (
        <span className={classes.mentionUnknown}>{label}</span>
      ),
    });
    cursor = mention.end;
  });

  if (cursor < text.length) {
    parts.push({
      key: "tail",
      node: text.slice(cursor),
    });
  }

  return (
    <>
      {parts.map((part) => (
        <span key={part.key}>{part.node}</span>
      ))}
    </>
  );
}
