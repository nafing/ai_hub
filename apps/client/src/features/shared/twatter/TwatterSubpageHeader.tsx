import { TwatterPageHeader } from "./TwatterPageHeader";

type TwatterSubpageHeaderProps = {
  title: string;
};

/** @deprecated Shell header already shows the page title. Kept for call-site compatibility. */
export function TwatterSubpageHeader(_props: TwatterSubpageHeaderProps) {
  return null;
}

export { TwatterPageHeader };
