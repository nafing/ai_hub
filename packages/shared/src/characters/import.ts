import {
  CHARA_CARD_SPEC,
  CHARA_CARD_SPEC_VERSION,
  type CharacterCardData,
  type CharacterCardV2,
} from "./types";
import { normalizeCharacterCardData } from "./defaults";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Preferred text-chunk keywords (V3 first, then classic V1/V2). */
const CARD_CHUNK_KEYS = ["ccv3", "chara"] as const;

export type ParsedCharacterImport = {
  /** Always normalized to chara_card_v2 shape. */
  card: CharacterCardV2;
  /** Source format hint. */
  source: "json" | "png";
};

export class CharacterImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CharacterImportError";
  }
}

/**
 * Parse a character card from a JSON string or already-parsed object.
 * Accepts V2 (`spec` + `data`), flat V1, or a bare `data` object.
 */
export function parseCharacterCardJson(input: unknown): CharacterCardV2 {
  let value: unknown = input;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new CharacterImportError("JSON is empty");
    }
    try {
      value = JSON.parse(trimmed);
    } catch {
      // Some exporters store base64(JSON) as the whole file contents.
      try {
        value = JSON.parse(decodeBase64Utf8(trimmed));
      } catch {
        throw new CharacterImportError("Invalid JSON");
      }
    }
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new CharacterImportError("Character card must be a JSON object");
  }

  const root = value as Record<string, unknown>;

  // Unwrap common envelopes
  const unwrapped =
    (isPlainObject(root.card) ? root.card : null) ??
    (isPlainObject(root.character) ? root.character : null) ??
    root;

  if (typeof unwrapped.spec === "string" && unwrapped.spec !== CHARA_CARD_SPEC) {
    // ccv3 and other specs: if they nest V2-compatible `data`, still accept data fields.
    if (!isPlainObject(unwrapped.data)) {
      throw new CharacterImportError(
        `Unsupported card spec "${unwrapped.spec}" (expected ${CHARA_CARD_SPEC})`,
      );
    }
  }

  const rawData = isPlainObject(unwrapped.data)
    ? (unwrapped.data as Partial<CharacterCardData> & Record<string, unknown>)
    : (unwrapped as Partial<CharacterCardData> & Record<string, unknown>);

  return {
    spec: CHARA_CARD_SPEC,
    spec_version: CHARA_CARD_SPEC_VERSION,
    data: normalizeCharacterCardData(rawData),
  };
}

/**
 * Extract and parse a character card embedded in a PNG (`tEXt` / `zTXt` chunk).
 * Looks for `ccv3` then `chara` (base64 JSON or raw JSON).
 */
export async function parseCharacterCardPng(
  bytes: ArrayBuffer | Uint8Array,
): Promise<CharacterCardV2> {
  const buffer = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  assertPngSignature(buffer);

  const texts = await readPngTextChunks(buffer);
  for (const key of CARD_CHUNK_KEYS) {
    const chunk = texts.find((entry) => entry.keyword === key);
    if (!chunk) continue;
    return parseCharacterCardJson(decodeCharaPayload(chunk.text));
  }

  throw new CharacterImportError(
    'PNG has no character card metadata (missing "chara" / "ccv3" tEXt chunk)',
  );
}

/**
 * Parse an imported file by extension / MIME / content sniffing.
 */
export async function parseCharacterImportFile(
  file: Pick<File, "name" | "type">,
  bytes: ArrayBuffer,
): Promise<ParsedCharacterImport> {
  const name = file.name.toLowerCase();
  const isPng =
    name.endsWith(".png") ||
    file.type === "image/png" ||
    hasPngSignature(new Uint8Array(bytes));
  const isJson =
    name.endsWith(".json") ||
    file.type === "application/json" ||
    file.type === "text/json";

  if (isPng) {
    const card = await parseCharacterCardPng(bytes);
    return { card, source: "png" };
  }

  if (isJson || looksLikeJsonText(bytes)) {
    const text = new TextDecoder("utf-8").decode(bytes);
    return { card: parseCharacterCardJson(text), source: "json" };
  }

  throw new CharacterImportError(
    "Unsupported file type — use a .json card or a .png character card",
  );
}

function looksLikeJsonText(bytes: ArrayBuffer): boolean {
  const sample = new TextDecoder("utf-8")
    .decode(bytes.slice(0, 64))
    .trimStart();
  return sample.startsWith("{") || sample.startsWith("[");
}

function decodeCharaPayload(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new CharacterImportError("Character chunk is empty");
  }
  // Prefer base64 → JSON (SillyTavern / Tavern standard)
  try {
    return JSON.parse(decodeBase64Utf8(trimmed));
  } catch {
    // Fall back to raw JSON in the chunk
    return JSON.parse(trimmed);
  }
}

function decodeBase64Utf8(value: string): string {
  const cleaned = value.replace(/\s+/g, "");
  if (typeof atob !== "function") {
    throw new CharacterImportError("Base64 decoding is not available in this environment");
  }
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder("utf-8").decode(bytes);
}

function assertPngSignature(buffer: Uint8Array) {
  if (!hasPngSignature(buffer)) {
    throw new CharacterImportError("File is not a valid PNG");
  }
}

function hasPngSignature(buffer: Uint8Array): boolean {
  if (buffer.length < 8) return false;
  return PNG_SIGNATURE.every((byte, index) => buffer[index] === byte);
}

type PngTextChunk = {
  keyword: string;
  text: string;
  compressed: boolean;
};

async function readPngTextChunks(buffer: Uint8Array): Promise<PngTextChunk[]> {
  const chunks: PngTextChunk[] = [];
  let offset = 8;

  while (offset + 8 <= buffer.length) {
    const length = readUint32(buffer, offset);
    const type = String.fromCharCode(
      buffer[offset + 4]!,
      buffer[offset + 5]!,
      buffer[offset + 6]!,
      buffer[offset + 7]!,
    );
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > buffer.length) {
      break;
    }
    const data = buffer.subarray(dataStart, dataEnd);

    if (type === "tEXt") {
      const parsed = parseTextChunk(data, false);
      if (parsed) chunks.push(parsed);
    } else if (type === "zTXt") {
      const parsed = await parseZtxtChunk(data);
      if (parsed) chunks.push(parsed);
    } else if (type === "IEND") {
      break;
    }

    offset = dataEnd + 4; // skip CRC
  }

  return chunks;
}

function parseTextChunk(
  data: Uint8Array,
  compressed: boolean,
): PngTextChunk | null {
  const sep = data.indexOf(0);
  if (sep <= 0) return null;
  const keyword = latin1Decode(data.subarray(0, sep));
  const text = latin1Decode(data.subarray(sep + 1));
  return { keyword, text, compressed };
}

async function parseZtxtChunk(data: Uint8Array): Promise<PngTextChunk | null> {
  const sep = data.indexOf(0);
  if (sep <= 0 || sep + 2 > data.length) return null;
  const keyword = latin1Decode(data.subarray(0, sep));
  const method = data[sep + 1];
  if (method !== 0) return null;
  const compressed = data.subarray(sep + 2);
  const inflated = await inflateZlib(compressed);
  const text = latin1Decode(inflated);
  return { keyword, text, compressed: true };
}

async function inflateZlib(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new CharacterImportError(
      "Compressed PNG text chunks (zTXt) require DecompressionStream",
    );
  }
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate"));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

function readUint32(buffer: Uint8Array, offset: number): number {
  return (
    ((buffer[offset]! << 24) |
      (buffer[offset + 1]! << 16) |
      (buffer[offset + 2]! << 8) |
      buffer[offset + 3]!) >>>
    0
  );
}

function latin1Decode(bytes: Uint8Array): string {
  let result = "";
  for (let i = 0; i < bytes.length; i += 1) {
    result += String.fromCharCode(bytes[i]!);
  }
  return result;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
