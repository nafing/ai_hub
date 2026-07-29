/**
 * Player persona — substitutes `{{user}}` in prompts.
 * `avatar` is an API path to the stored PNG (e.g. `/personas/{id}/avatar`), or null.
 */
export type Persona = {
  id: string;
  /** Public API path for the avatar image, or null when none. */
  avatar: string | null;
  /** Display name used for `{{user}}`. */
  name: string;
  /** Background, role, and durable facts. */
  description: string;
  /** Physical look / visual presentation (useful for image prompts). */
  appearance: string;
  /** Trait / personality block. */
  personality: string;
  /** Conversation About Me bio. */
  about_me: string;
  /** Optional user-facing notes (not injected into prompts). */
  notes: string;
  /** When true, this is the active default persona for new chats. */
  is_default: boolean;
};
