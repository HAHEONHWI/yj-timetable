import { z } from "npm:zod@4.1.5";

const applicationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().min(9).max(24),
});

export type ApiApplication = {
  readonly name: string;
  readonly email: string;
  readonly phone: string;
};

export function normalizeKoreanPhone(value: string): string | null {
  const compact = value.trim().replaceAll(/[^\d+]/g, "");
  const domestic = compact.startsWith("+82")
    ? `0${compact.slice(3)}`
    : compact;
  return /^0(?:1[016789]\d{7,8}|2\d{7,8}|[3-6][1-5]\d{7,8}|70\d{8})$/.test(
      domestic,
    )
    ? domestic
    : null;
}

export function parseApiApplication(value: unknown): ApiApplication | null {
  const parsed = applicationSchema.safeParse(value);
  if (!parsed.success) return null;
  const phone = normalizeKoreanPhone(parsed.data.phone);
  if (!phone) return null;
  return { ...parsed.data, phone };
}

export function generateEmailCode(): string {
  const value = crypto.getRandomValues(new Uint32Array(1))[0];
  return String((value ?? 0) % 1_000_000).padStart(6, "0");
}

export async function hmacHex(
  secret: string,
  value: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return Array.from(
    new Uint8Array(signature),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}
