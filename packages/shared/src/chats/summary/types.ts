export type ChatSummaryEntryKind = "rolling";
export type ChatSummaryEntryOrigin = "manual" | "automated" | "legacy";
export type ChatSummaryEntrySource = "last" | "range" | "agent";

export type ChatSummaryEntry = {
  id: string;
  kind: ChatSummaryEntryKind;
  origin: ChatSummaryEntryOrigin;
  title: string;
  content: string;
  enabled: boolean;
  source_mode: ChatSummaryEntrySource;
  token_estimate: number;
  created_at: string;
  updated_at: string;
  message_count?: number;
  range_start_index?: number;
  range_end_index?: number;
  message_ids?: string[];
  hidden_message_ids?: string[];
  prompt_template_id?: string | null;
};

export type ChatSummaryEntryInput = Partial<ChatSummaryEntry> & {
  content: string;
};

export type SummaryEntriesPatchBody =
  | {
      operation: "replace";
      entry: Partial<ChatSummaryEntry> & { id: string; content: string };
    }
  | { operation: "delete"; entry_id: string }
  | { operation: "toggle"; entry_id: string; enabled: boolean };

export type GenerateChatSummaryInput = {
  context_size?: number;
  range_start_message_id?: string | null;
  range_end_message_id?: string | null;
  range_start_index?: number | null;
  range_end_index?: number | null;
};
