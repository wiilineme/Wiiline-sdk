# wiiline-sdk

Official TypeScript/JavaScript SDK for the Wiiline eSIM API - plans, eSIM management and webhooks. Works in Node.js (18+) and modern browsers.

## Install

```bash
npm install wiiline-sdk
```

## Quick start

```ts
import { WiilineClient } from 'wiiline-sdk';

const client = new WiilineClient({
  apiKey: 'wii_...', // from your dashboard's API Tokens page - see "Getting an account"
});

// List plans for a country
const { data: plans } = await client.plans.list({ plan_type: 'country' });

// Issue an eSIM
// Persist this key for the purchase; reuse it after any timeout.
const purchaseKey = crypto.randomUUID();
const order = await client.esim.issue({ plan_id: plans[0].plan_uuid, count: 1 }, purchaseKey);
if (order.pending) console.log('Check order:', order.order_uuid);
else console.log(order.data.response.esims[0].qrcode);
```

## Getting an account

You need a Wiiline partner account and an API key. Accounts are invite-only:

1. **Request access** at [wiiesim.me/register](https://wiiesim.me/register) - tell us about your business
   (company or individual, website, country, expected volume) and whether you need the API only or
   Whitelabel + API. Our team reviews the request and creates your account; you receive your sign-in
   details by email.
2. **Sign in** at [wiiesim.me/login](https://wiiesim.me/login) and **activate your account** with the one-time
   $200 activation fee - **$100 of it is credited to your balance** for your first orders.
3. **Sign the NDA** shown on your dashboard.
4. **Top up your balance** (Balance page). eSIM purchases, renewals and top-ups are paid from this
   prepaid balance.
5. **Create an API key** under **API Tokens** (keys start with `wii_` and are shown only once). Store it
   securely - e.g. as an environment variable on your server, never committed to source control or
   shipped in frontend/browser code. Optionally restrict it to your servers' IPs on the same page.
6. **(Optional) Set up webhooks** under **Webhooks** to receive order and eSIM events - see
   [Webhooks](#webhooks) below.

New accounts can start in **testing mode**, where calls return realistic mock data and nothing is
charged. Ask your account manager to switch you to live mode when you're ready. The interactive API
reference is in your dashboard under **API Documentation**.

## Configuration

```ts
new WiilineClient({
  apiKey: string;       // required
  baseUrl?: string;     // default: 'https://wiiesim.me'
  timeoutMs?: number;   // default: 30000 (30s)
});
```

## Plans

```ts
// List plans, with optional filters
const { data: plans, meta } = await client.plans.list({
  plan_type: 'country',   // 'country' | 'region' | 'global'
  filter: 'usa',          // substring match against name/countries
});

// Get one plan by plan_uuid or plan_code
const { data: plan } = await client.plans.get('plan_uuid_or_code');
```

Note: `plan.price` is the base price. The amount actually charged when you issue/renew/upgrade includes a commission on top  check `transaction.amount_charged` on those responses for the real total.

## eSIM management

```ts
// Issue a new eSIM
const issued = await client.esim.issue({
  plan_id: 'plan_uuid_or_code',
  count: 1,          // 1-10
}, 'unique-purchase-key');

// Get eSIM status/usage
const info = await client.esim.info('8948010010029178828' /* iccid */);

// Renew an existing eSIM
const renewed = await client.esim.renew({
  iccid: '8948010010029178828',
  plan_id: 'plan_uuid_or_code',
});

// Check available topups for an eSIM (`message` explains when none are available)
const topupCheck = await client.esim.checkTopup('8948010010029178828');

// Replace an eSIM (new ICCID + QR code; the old one stops working). Max 3 per account.
const replaced = await client.esim.change({ iccid: '8948010010029178828' });
console.log(replaced.data.esim.qrcode);

// List topup/upgrade products without purchasing
const topups = await client.esim.listTopups('8948010010029178828');

// Purchase a topup/upgrade
const upgraded = await client.esim.upgrade({
  iccid: '8948010010029178828',
  product_id: topups.data.available_topups[0].id,
});

// Look up a previous order
const order = await client.esim.getOrder('order_uuid_from_issue');
```

`issue` and `renew` both accept `count`/`iccid` combinations as documented in each method's JSDoc. All eSIM-issuing/renewing/upgrading calls are rate-limited to **10 requests/minute** per account.

### Activation dates

Until an eSIM is first used, `plan_activated_at` and `plan_expired_at` are `null`. On networks that set an activation deadline, `activate_before` holds it (typically 60 days after purchase):

```ts
const { data: esim } = await client.esim.info(iccid);
if (!esim.plan_activated_at && esim.activate_before) {
  console.log(`Not used yet - activate before ${esim.activate_before}`);
}
```

Plans with `activation_type: 'IMMEDIATE'` start at purchase instead.

### Orders that complete later

Some networks prepare eSIMs asynchronously. `issue()` waits up to ~25s; if the eSIM isn't ready yet it returns `status_qr: 'PENDING'` with an empty `qrcode` - fetch it later with `esim.getOrder(order_uuid)` or handle the `order.completed` webhook. Renewals on those networks behave the same way (`data.status: 'pending'`, followed by `renewal.completed` / `renewal.failed`). `checkTopup()` / `listTopups()` always return only plans that can be applied to that eSIM.

## Webhooks

Register an HTTPS endpoint in your dashboard under **Webhooks** to be notified instead of polling. Every request is signed - verify it with your endpoint's signing secret before trusting it:

```ts
import express from 'express';
import { constructWebhookEvent } from 'wiiline-sdk';

const app = express();

// The raw body is required for signature verification.
app.post('/webhooks/wiiline', express.raw({ type: 'application/json' }), async (req, res) => {
  let event;
  try {
    event = await constructWebhookEvent(req.body, req.headers, process.env.WIILINE_WEBHOOK_SECRET!);
  } catch {
    return res.status(400).send('invalid signature');
  }
  res.sendStatus(200); // answer within 10s, then process

  // Every event: event.data.order, event.data.esim, event.data.change
  switch (event.type) {
    case 'order.completed':
      console.log('eSIM ready:', event.data.esim?.qrcode);
      break;
    case 'esim.usage_threshold':
      console.log(`${event.data.esim?.iccid} used ${event.data.change.threshold}%`);
      break;
    case 'order.failed':
      console.log('Order failed, refunded:', event.data.change.refunded);
      break;
  }
});
```

Every event has the same `data` structure:

| Field | Content |
|---|---|
| `data.order` | The related order (`order_uuid`, `order_type`, `plan_id`, `status`) or `null` |
| `data.esim` | The full, current eSIM - same fields on every event, unified `status`, ISO dates, `null` when unknown |
| `data.change` | What happened (event-specific, typed per `event.type`) |

In frameworks with Web `Request` objects (Next.js route handlers, Hono, Cloudflare Workers):

```ts
const raw = await request.text();
const event = await constructWebhookEvent(raw, request.headers, secret);
```

| Event | Sent when |
|---|---|
| `order.completed` | An eSIM is ready (one event per eSIM, including orders completed later) |
| `order.failed` | An order failed at the network after it was placed (`refunded` tells you if your balance was credited back) |
| `renewal.completed` / `renewal.failed` | Renewal, top-up or upgrade result |
| `esim.replaced` | The eSIM was replaced via `esim.change()` - `esim` is the new eSIM, `change.replaced_iccid` the old one |
| `esim.status_changed` | eSIM status changed |
| `esim.installed` | Installed on a device (first install or reinstall) - device name, EID, install count - where the network reports the device |
| `esim.activated` | First use - real activation and expiry dates |
| `esim.usage_threshold` | Usage crossed 50%, 80% or 100% |
| `esim.expiring_soon` / `esim.expired` | Less than 24h left / plan expired |
| `webhook.test` | "Send test event" in the dashboard |

- Failed deliveries are retried up to 8 times over ~2 days; retries reuse the same `event.id` - use it to ignore duplicates.
- eSIM status/usage/expiry events come from network polling and can arrive up to ~1 hour after the change.
- `verifyWebhookSignature(rawBody, headers, secret)` returns a boolean if you only need the check.

## Error handling

Every failed call throws a `WiilineApiError`:

```ts
import { WiilineApiError } from 'wiiline-sdk';

try {
  await client.esim.issue({ plan_id: 'bad-id', count: 1 }, 'unique-purchase-key');
} catch (err) {
  if (err instanceof WiilineApiError) {
    console.error(err.status);      // HTTP status (0 for network/timeout errors)
    console.error(err.code);        // short error code from the API's `error` field
    console.error(err.message);     // human-readable message
    console.error(err.retryAfter);  // seconds to wait, present on rate-limit (429) errors
    console.error(err.details);     // extra structured detail, when the API provides it
  }
}
```

`plans.list()` can return HTTP 200 with a failed result if no plans are available for your account, so don't branch on status codes  catch `WiilineApiError` instead, it's thrown for any unsuccessful call regardless of status.

## Notes

- `esim.info()` returns the raw network status string (casing varies, e.g. `"Installed"`); `esim.issue()` returns a normalized uppercase status enum instead. Compare case-insensitively if you're matching against both.
- `esim.renew()` and `esim.upgrade()` refund automatically if the network call fails after the charge (`refunded: true`, `refund_amount`, `transaction` omitted). `esim.issue()` reserves available balance before contacting the network. Reuse the same required idempotency key on retries. HTTP 202 / `pending: true` keeps funds reserved while the provider outcome is verified; do not create a new purchase for that operation. If a network fails *later* (asynchronous orders), the charge is refunded automatically and you get an `order.failed` / `renewal.failed` webhook.
- Errors raised **before** charging: `Renewal not available` (with the reason, e.g. renewal deadline passed), `Renewal not supported`, `Upgrade not supported`, `Invalid plan` (plan not compatible with the eSIM). An ICCID from another account gives `eSIM not found` (404).
- `esim.checkTopup()`'s response is flat  `iccid`/`topup_available` at the top level, no `user` object  unlike every other method here.
- Testing-mode responses aren't shaped identically to live-mode responses for the same method.

## TypeScript

Full types are included and exported from the package root:

```ts
import type { Plan, EsimIssueResponse, EsimRecord, WebhookEvent } from 'wiiline-sdk';
```

## License

MIT
