import { useState } from "react";
import { motion } from "motion/react";
import {
  IconArrowRight,
  IconBook,
  IconMessages,
  IconPresentation,
  IconUsers,
} from "@tabler/icons-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui";
import { CreateChatModal } from "@/features/chats/CreateChatModal";
import { useChats } from "@/features/chats/queries";
import classes from "./index.module.css";

export const Route = createFileRoute("/_app/")({
  component: RouteComponent,
});

const DESTINATIONS = [
  {
    to: "/characters",
    label: "Characters",
    blurb: "Cards, greetings, and generation.",
    icon: IconUsers,
  },
  {
    to: "/presets",
    label: "Presets",
    blurb: "Prompt stacks for every mode.",
    icon: IconPresentation,
  },
  {
    to: "/lorebooks",
    label: "Lorebooks",
    blurb: "World facts that stay in play.",
    icon: IconBook,
  },
  {
    to: "/chats",
    label: "Chats",
    blurb: "Pick up a scene mid-thread.",
    icon: IconMessages,
  },
] as const;

function RouteComponent() {
  const [createOpen, setCreateOpen] = useState(false);
  const chatsQuery = useChats();
  const recent = (chatsQuery.data ?? []).slice(0, 4);

  return (
    <div className={classes.page}>
      <section className={classes.hero} aria-label="Home">
        <div className={classes.heroAtmosphere} aria-hidden>
          <div className={classes.heroGlow} />
          <div className={classes.heroGrain} />
          <div className={classes.heroPlane} />
        </div>

        <div className={classes.heroInner}>
          <motion.p
            className={classes.brand}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            AI Hub
          </motion.p>

          <motion.h1
            className={classes.headline}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.5,
              delay: 0.08,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            Your private stage for characters, lore, and long-form play.
          </motion.h1>

          <motion.p
            className={classes.lede}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.45,
              delay: 0.16,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            Wire models, shape presets, and keep every scene under your roof.
          </motion.p>

          <motion.div
            className={classes.ctaRow}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.4,
              delay: 0.24,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <Button
              type="button"
              variant="primary"
              onClick={() => setCreateOpen(true)}
            >
              Start a chat
            </Button>
            <Link to="/characters" className={classes.ctaGhost}>
              Browse characters
              <IconArrowRight size={16} stroke={1.75} />
            </Link>
          </motion.div>
        </div>
      </section>

      <section className={classes.section} aria-labelledby="home-destinations">
        <div className={classes.sectionIntro}>
          <h2 id="home-destinations" className={classes.sectionTitle}>
            Open a workshop
          </h2>
          <p className={classes.sectionLede}>
            Jump straight into the piece you need next.
          </p>
        </div>

        <ul className={classes.destList}>
          {DESTINATIONS.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.li
                key={item.to}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.35,
                  delay: 0.28 + index * 0.05,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <Link to={item.to} className={classes.destLink}>
                  <span className={classes.destIcon} aria-hidden>
                    <Icon size={18} stroke={1.6} />
                  </span>
                  <span className={classes.destCopy}>
                    <span className={classes.destLabel}>{item.label}</span>
                    <span className={classes.destBlurb}>{item.blurb}</span>
                  </span>
                  <IconArrowRight
                    className={classes.destArrow}
                    size={16}
                    stroke={1.75}
                    aria-hidden
                  />
                </Link>
              </motion.li>
            );
          })}
        </ul>
      </section>

      {recent.length > 0 ? (
        <section className={classes.section} aria-labelledby="home-recent">
          <div className={classes.sectionIntro}>
            <h2 id="home-recent" className={classes.sectionTitle}>
              Recent chats
            </h2>
            <p className={classes.sectionLede}>
              Pick up where the last reply left off.
            </p>
          </div>
          <ul className={classes.recentList}>
            {recent.map((chat) => (
              <li key={chat.id}>
                <Link
                  to="/chats/$chatId"
                  params={{ chatId: chat.id }}
                  className={classes.recentLink}
                >
                  <span className={classes.recentTitle}>
                    {chat.title?.trim() || "Untitled chat"}
                  </span>
                  <span className={classes.recentMeta}>
                    {chat.message_count} messages
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <CreateChatModal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
}
