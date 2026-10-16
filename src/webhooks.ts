/**
 * Verifying and typing the webhook events Wiiline sends to your endpoint
 * (configured in your dashboard under Webhooks).
 *
 * Each request carries:
 *   X-Webhook-Id:        event id (stable across retries - use it to dedupe)
 *   X-Webhook-Event:     event type
 *   X-Webhook-Timestamp: unix seconds
 *   X-Webhook-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, "<t>.<raw body>")>
 *
 * Uses the WebCrypto API, so it runs in Node.js 18+, Deno, Bun and edge
 * runtimes without pulling Node's `crypto` into browser bundles. Verify on
 * your server only - never ship the signing secret to a browser.
 */
import type { UnifiedEsimStatus } from './types';
import { WiilineApiError } from './errors';

// ── Event types ─────────────────────────────────────────────────────────────
//
// Every event has the same shape:
//   { id, type, api_version, created_at, data: { order, esim, change } }
// `order` and `esim` are the same structures for every event type; only
// `change` differs (WebhookChangeMap).

/** The order an event relates to. */
export interface WebhookOrder {
  order_uuid: string;
  order_type: 'issue' | 'topup' | 'renew' | 'upgrade' | string | null;
  plan_id: string | null;
  status: 'completed' | 'pending' | 'failed' | 'refunded' | string | null;
}

/**
 * The full, current eSIM. Every field is always present (`null` when unknown);
 * `status` is always a unified status value and dates are ISO 8601 UTC.
 */
export interface WebhookEsim {
  iccid: string | null;
  status: UnifiedEsimStatus;
  qrcode: string | null;
  ios_tap_link: string | null;
  android_tap_link: string | null;
  plan_activated_at: string | null;
  plan_expired_at: string | null;
  activate_before: string | null;
  renew_before: string | null;
  data_used_mb: number | null;
  data_left_mb: number | null;
  data_package_mb: number | null;
  unlimited: boolean | null;
  package_name: string | null;
  apn: string | null;
  /** Device fields - only on networks that report the device, otherwise null. */
  install_device: string | null;
  install_count: number | null;
  installed_at: string | null;
  /** The phone's eSIM chip identifier (EID). */
  eid: string | null;
}

/** What happened - the only part of `data` that differs per event type. */
export interface WebhookChangeMap {
  'order.completed': Record<string, never>;
  'order.failed': { reason: string; refunded: boolean; refund_amount?: number };
  'renewal.completed': Record<string, never>;
  'renewal.failed': { reason: string; refunded: boolean };
  /** The eSIM was replaced (`esim.change()`); `esim` is the NEW eSIM. */
  'esim.replaced': { replaced_iccid: string; new_iccid: string };
  'esim.status_changed': { previous_status: UnifiedEsimStatus; status: UnifiedEsimStatus };
  /** Installed on a device (first install or reinstall). Only on networks that report the device. */
  'esim.installed': {
    device: string | null;
    previous_device: string | null;
    eid: string | null;
    install_count: number | null;
    installed_at: string | null;
  };
  'esim.activated': { activated_at: string; expires_at: string | null };
  'esim.usage_threshold': { threshold: 50 | 80 | 100; data_used_mb: number; data_left_mb: number; data_package_mb: number };
  'esim.expiring_soon': { expires_at: string };
  'esim.expired': { expired_at: string | null };
  'webhook.test': { message: string };
}

export type WebhookEventType = keyof WebhookChangeMap;

/** `data` of an event: same structure for every type, typed `change`. */
export interface WebhookEventData<T extends WebhookEventType = WebhookEventType> {
  /** The related order, or null (e.g. webhook.test). */
  order: WebhookOrder | null;
  /** The eSIM, or null when the event isn't about one eSIM (e.g. an order that failed before issuing). */
  esim: WebhookEsim | null;
  change: WebhookChangeMap[T];
}

/** A verified webhook event. Narrow on `type` to get the typed `data.change`. */
export type WebhookEvent = {
  [T in WebhookEventType]: {
    /** Event id - identical across retries of the same event. */
    id: string;
    type: T;
    /** Payload schema version, e.g. "2026-10-13". */
    api_version: string;
    created_at: string;
    data: WebhookEventData<T>;
  };
}[WebhookEventType];

// ── Verification ────────────────────────────────────────────────────────────

export interface VerifyWebhookOptions {
  /** Max age of the signature timestamp in seconds. Default 300 (5 minutes). */
  toleranceSeconds?: number;
  /** Override "now" (unix seconds) - for tests. */
  now?: number;
}

type HeaderSource = string | null | undefined | Headers | Record<string, string | string[] | undefined>;

function readSignatureHeader(headers: HeaderSource): string | null {
  if (!headers) return null;
  if (typeof headers === 'string') return headers;
  if (typeof (headers as Headers).get === 'function') return (headers as Headers).get('x-webhook-signature');
  const record = headers as Record<string, string | string[] | undefined>;
  const key = Object.keys(record).find((k) => k.toLowerCase() === 'x-webhook-signature');
  const value = key ? record[key] : undefined;
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

async function getSubtle(): Promise<SubtleCrypto> {
  const subtle = (globalThis as any).crypto?.subtle as SubtleCrypto | undefined;
  if (subtle) return subtle;
  // Node 18 doesn't expose WebCrypto as a global by default.
  const nodeCrypto = await import('node:crypto' as string);
  return (nodeCrypto as any).webcrypto.subtle as SubtleCrypto;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const subtle = await getSubtle();
  const enc = new TextEncoder();
  const key = await subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function toText(rawBody: string | Uint8Array | ArrayBuffer): string {
  if (typeof rawBody === 'string') return rawBody;
  return new TextDecoder().decode(rawBody instanceof ArrayBuffer ? new Uint8Array(rawBody) : rawBody);
}

/**
 * Check a webhook request's signature. Returns `true` only if it was signed
 * with your secret and isn't older than `toleranceSeconds`.
 *
 * Pass the RAW request body exactly as received - not a re-serialized
 * `JSON.stringify(req.body)`, which changes the bytes and fails verification.
 */
export async function verifyWebhookSignature(
  rawBody: string | Uint8Array | ArrayBuffer,
  signatureHeader: HeaderSource,
  secret: string,
  options: VerifyWebhookOptions = {},
): Promise<boolean> {
  const header = readSignatureHeader(signatureHeader);
  if (!header || !secret) return false;

  const parts: Record<string, string> = {};
  for (const piece of header.split(',')) {
    const i = piece.indexOf('=');
    if (i > 0) parts[piece.slice(0, i).trim()] = piece.slice(i + 1).trim();
  }
  const timestamp = Number(parts.t);
  if (!parts.v1 || !Number.isFinite(timestamp)) return false;

  const now = options.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > (options.toleranceSeconds ?? 300)) return false;

  const expected = await hmacSha256Hex(secret, `${parts.t}.${toText(rawBody)}`);
  return timingSafeEqualHex(expected, parts.v1.toLowerCase());
}

/**
 * Verify a webhook request and return the parsed, typed event. Throws a
 * `WiilineApiError` (code `invalid_signature` / `invalid_payload`) if the
 * request can't be trusted - respond 400 in that case.
 *
 * @example
 * // Express - the route needs the raw body
 * app.post('/webhooks/wiiline', express.raw({ type: 'application/json' }), async (req, res) => {
 *   let event;
 *   try {
 *     event = await constructWebhookEvent(req.body, req.headers, process.env.WIILINE_WEBHOOK_SECRET!);
 *   } catch {
 *     return res.status(400).send('invalid signature');
 *   }
 *   res.sendStatus(200); // answer fast, then process
 *   if (event.type === 'order.completed') {
 *     console.log(event.data.esim?.qrcode);
 *   }
 * });
 */
export async function constructWebhookEvent(
  rawBody: string | Uint8Array | ArrayBuffer,
  signatureHeader: HeaderSource,
  secret: string,
  options: VerifyWebhookOptions = {},
): Promise<WebhookEvent> {
  if (!(await verifyWebhookSignature(rawBody, signatureHeader, secret, options))) {
    throw new WiilineApiError('Webhook signature verification failed', { status: 400, code: 'invalid_signature' });
  }
  let event: any;
  try {
    event = JSON.parse(toText(rawBody));
  } catch {
    throw new WiilineApiError('Webhook payload is not valid JSON', { status: 400, code: 'invalid_payload' });
  }
  if (!event || typeof event.type !== 'string' || typeof event.id !== 'string') {
    throw new WiilineApiError('Webhook payload is missing id/type', { status: 400, code: 'invalid_payload' });
  }
  return event as WebhookEvent;
}
