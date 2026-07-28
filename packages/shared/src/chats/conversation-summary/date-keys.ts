export function parseConversationDateKey(dateKey: string): Date {
  const [dd, mm, yyyy] = dateKey.split(".");
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
}

export function formatConversationDateKey(date: Date): string {
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
}

export function getConversationWeekMonday(date: Date): Date {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + diff);
}

export function weekRangeLabel(mondayKey: string): string {
  const monday = parseConversationDateKey(mondayKey);
  const sunday = new Date(
    monday.getFullYear(),
    monday.getMonth(),
    monday.getDate() + 6,
  );
  return `Week of ${mondayKey} – ${formatConversationDateKey(sunday)}`;
}
