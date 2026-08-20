const API_KEY_PATTERN = /^yj_live_([a-f0-9]{8})_([A-Za-z0-9_-]{32,})$/;

export type ParsedApiKey = {
  readonly prefix: string;
};

export type GeneratedApiKey = ParsedApiKey & {
  readonly value: string;
};

export function parseApiKey(value: string): ParsedApiKey | null {
  const match = API_KEY_PATTERN.exec(value.trim());
  return match?.[1] ? { prefix: match[1] } : null;
}

export async function hashApiKey(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function generateApiKey(): GeneratedApiKey {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const prefix = Array.from(
    bytes.slice(0, 4),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  const secret = btoa(binary).replaceAll("+", "-").replaceAll("/", "_")
    .replaceAll("=", "");
  return { prefix, value: `yj_live_${prefix}_${secret}` };
}
