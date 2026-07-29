import { useState } from "react";
import { motion } from "motion/react";
import {
  IconAiAgent,
  IconArrowRight,
  IconBook,
  IconBrandTwitter,
  IconConnection,
  IconFunction,
  IconMessages,
  IconPresentation,
  IconRegex,
  IconSettings,
  IconUser,
  IconUsers,
} from "@tabler/icons-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui";
import { CreateChatModal, useChats } from "@/features/chats/shared";
import classes from "./index.module.css";

export const Route = createFileRoute("/_app/")({
  component: RouteComponent,
});

type FeatureItem = {
  to: string;
  label: string;
  blurb: string;
  icon: typeof IconMessages;
};

type FeatureGroup = {
  id: string;
  title: string;
  lede: string;
  items: FeatureItem[];
};

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    id: "play",
    title: "Play",
    lede: "Jump into a scene or scroll the feed.",
    items: [
      {
        to: "/chats",
        label: "Chats",
        blurb: "Roleplay threads with your cast.",
        icon: IconMessages,
      },
      {
        to: "/twatter",
        label: "Twatter",
        blurb: "Social timeline for personas and characters.",
        icon: IconBrandTwitter,
      },
    ],
  },
  {
    id: "user-data",
    title: "User data",
    lede: "Profiles, cards, and world facts you reuse everywhere.",
    items: [
      {
        to: "/personas",
        label: "Personas",
        blurb: "Your voice across chats and Twatter.",
        icon: IconUser,
      },
      {
        to: "/characters",
        label: "Characters",
        blurb: "Cards, greetings, and generation.",
        icon: IconUsers,
      },
      {
        to: "/lorebooks",
        label: "Lorebooks",
        blurb: "World facts that stay in play.",
        icon: IconBook,
      },
    ],
  },
  {
    id: "llm-settings",
    title: "LLM settings",
    lede: "Wire models, shape prompts, and extend what the model can do.",
    items: [
      {
        to: "/connections",
        label: "Connections",
        blurb: "API keys and model providers.",
        icon: IconConnection,
      },
      {
        to: "/presets",
        label: "Presets",
        blurb: "Prompt stacks for every mode.",
        icon: IconPresentation,
      },
      {
        to: "/regexes",
        label: "Regexes",
        blurb: "Find-and-replace rules for output.",
        icon: IconRegex,
      },
      {
        to: "/tools",
        label: "Tools",
        blurb: "Custom functions the model can call.",
        icon: IconFunction,
      },
      {
        to: "/agents",
        label: "Agents",
        blurb: "Autonomous helpers inside chats.",
        icon: IconAiAgent,
      },
    ],
  },
  {
    id: "settings",
    title: "App",
    lede: "Theme, sounds, and global preferences.",
    items: [
      {
        to: "/settings",
        label: "Settings",
        blurb: "Appearance, audio, and app defaults.",
        icon: IconSettings,
      },
    ],
  },
];

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
            Everything in one place — chats, social feed, presets, and model
            wiring.
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
            <Link to="/twatter" className={classes.ctaGhost}>
              Open Twatter
              <IconArrowRight size={16} stroke={1.75} />
            </Link>
          </motion.div>
        </div>
      </section>

      {FEATURE_GROUPS.map((group, groupIndex) => (
        <section
          key={group.id}
          className={classes.section}
          aria-labelledby={`home-${group.id}`}
        >
          <div className={classes.sectionIntro}>
            <h2 id={`home-${group.id}`} className={classes.sectionTitle}>
              {group.title}
            </h2>
            <p className={classes.sectionLede}>{group.lede}</p>
          </div>

          <ul className={classes.featureGrid}>
            {group.items.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.li
                  key={item.to}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.35,
                    delay: 0.2 + groupIndex * 0.06 + index * 0.04,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <Link to={item.to} className={classes.featureCard}>
                    <span className={classes.featureIcon} aria-hidden>
                      <Icon size={20} stroke={1.6} />
                    </span>
                    <span className={classes.featureCopy}>
                      <span className={classes.featureLabel}>{item.label}</span>
                      <span className={classes.featureBlurb}>{item.blurb}</span>
                    </span>
                    <IconArrowRight
                      className={classes.featureArrow}
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
      ))}

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
