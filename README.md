# wiiline-sdk

Official TypeScript/JavaScript SDK for the Wiiline eSIM API. Works in Node.js (18+) and modern browsers.

## Install

```bash
npm install wiiline-sdk
```

## Quick start

```ts
import { WiilineClient } from 'wiiline-sdk';

const client = new WiilineClient({
  apiKey: 'wii_...', // from your dashboard's API Tokens page
});

// List plans for a country
const { data: plans } = await client.plans.list({ plan_type: 'country' });

// Issue an eSIM
const order = await client.esim.issue({ plan_id: plans[0].plan_uuid, count: 1 });
console.log(order.data.response.esims[0].qrcode);
```

Getting an API key: sign in to your Wiiline dashboard, go to **API Tokens**, and create one. Keys are shown only once at creation — store it securely (e.g. as an environment variable, never committed to source control or shipped in frontend/browser code).

## Configuration

```ts
new WiilineClient({
  apiKey: string;       // required
  baseUrl?: string;     // defaults to the production API
  timeoutMs?: number;   // defaults to 30000
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

Note: `plan.price` is the provider's base price. The amount actually charged when you issue/renew/upgrade includes a commission on top — check `transaction.amount_charged` on those responses for the real total.

## eSIM management

```ts
// Issue a new eSIM
const issued = await client.esim.issue({
  plan_id: 'plan_uuid_or_code',
  count: 1,          // 1-10
});

// Get eSIM status/usage
const info = await client.esim.info('8948010010029178828' /* iccid */);

// Renew an existing eSIM
const renewed = await client.esim.renew({
  iccid: '8948010010029178828',
  plan_id: 'plan_uuid_or_code',
});

// Check available topups for an eSIM
const topupCheck = await client.esim.checkTopup('8948010010029178828');

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

## Error handling

Every failed call throws a `WiilineApiError`:

```ts
import { WiilineApiError } from 'wiiline-sdk';

try {
  await client.esim.issue({ plan_id: 'bad-id', count: 1 });
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

> The API is not perfectly consistent about HTTP status codes for every logical failure (for example, `plans.list()` can return HTTP 200 with a failed result if your account has no providers configured). The SDK normalizes this: **any unsuccessful call throws `WiilineApiError`, regardless of status code** — don't branch on status codes yourself, catch the error instead.

## Known API quirks (worth knowing)

These aren't SDK bugs — they reflect real inconsistencies in the underlying API that the TypeScript types are written to accommodate:

- `esim.info()` returns the raw provider status string (casing varies, e.g. `"Installed"`); `esim.issue()`'s response instead returns a normalized uppercase status enum. Compare case-insensitively if you need to match against both.
- `esim.renew()` and `esim.upgrade()` refund automatically on provider failure (`refunded: true`, `refund_amount`, and `transaction` omitted from the response in that case) — `esim.issue()` has no refund path since it only deducts balance after the provider confirms success.
- `esim.checkTopup()`'s success response is flat (`iccid`/`provider`/`topup_available` at the top level, no `user` object) — every other method nests these under `data` and includes `user`.
- Testing-mode responses (when API testing mode is enabled on your account) aren't uniformly shaped compared to live-mode responses for the same method.

## TypeScript

Full types are included and exported from the package root:

```ts
import type { Plan, EsimIssueResponse, EsimRecord } from 'wiiline-sdk';
```

## License

MIT
