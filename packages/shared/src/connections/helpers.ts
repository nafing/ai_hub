import type { ConnectionKind } from "./constants";

export function connectionKind(input: { kind?: ConnectionKind }): ConnectionKind {
  return input.kind ?? "llm";
}

export function filterConnectionsByKind<T extends { kind?: ConnectionKind }>(
  connections: T[],
  kind: ConnectionKind,
): T[] {
  return connections.filter((item) => connectionKind(item) === kind);
}

type ConnectionPick = {
  id: string;
  name: string;
  is_default?: boolean;
  kind?: ConnectionKind;
};

export function connectionOptionLabel(connection: ConnectionPick): string {
  const name = connection.name?.trim() || "Unnamed";
  return connection.is_default ? `${name} (default)` : name;
}

export function buildConnectionSelectOptions(
  connections: ConnectionPick[] | undefined,
  kind?: ConnectionKind,
): Array<{ value: string; label: string }> {
  const list = kind
    ? filterConnectionsByKind(connections ?? [], kind)
    : [...(connections ?? [])];
  return list.map((connection) => ({
    value: connection.id,
    label: connectionOptionLabel(connection),
  }));
}

export function resolveDefaultConnectionId(
  connections: ConnectionPick[] | undefined,
  kind?: ConnectionKind,
): string {
  const list = kind
    ? filterConnectionsByKind(connections ?? [], kind)
    : [...(connections ?? [])];
  return (
    list.find((connection) => connection.is_default)?.id ?? list[0]?.id ?? ""
  );
}
