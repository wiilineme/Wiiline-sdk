# Changelog

## 0.2.0

### Added
- **Webhooks**: `verifyWebhookSignature()` and `constructWebhookEvent()` to verify
  the `X-Webhook-Signature` header and get a typed `WebhookEvent`. Events:
  `order.completed`, `order.failed`, `renewal.completed`, `renewal.failed`,
  `esim.status_changed`, `esim.activated`, `esim.usage_threshold`,
  `esim.expiring_soon`, `esim.expired`, `webhook.test`. Uses WebCrypto, so it runs
  in Node.js 18+, Deno, Bun and edge runtimes.
- **New provider** support: added to `ProviderName` / `EsimIssueParams.provider`;
  compatible renewal plans from `checkTopup()` / `listTopups()` (with `plan_code`,
  `is_current_plan`); `upgrade()` on its eSIMs (returns the `renew()` shape).
- `EsimRecord.activate_before` - activation deadline for eSIMs that haven't been
  used yet - and `EsimRecord.renew_before` (`info()`, where supported).
- `ActivationType` (`'PDP' | 'IMMEDIATE'`) and `KnownApiErrorCode`.
- Asynchronous renewal fields on `EsimRenewResponse` (provider order number,
  dates, `renew_expiration_time`).

### Changed
- `plan_activated_at` / `plan_expired_at` are now `null` until an eSIM is first
  used (previously some providers' placeholder dates leaked through); use
  `activate_before` for the deadline.
- `activation_type: 'SCHEDULED'` is replaced by `'IMMEDIATE'` for plans that start
  at purchase.
- `upgrade()` return type is `EsimUpgradeResponse | EsimRenewResponse`.
- `EsimTopupProduct` fields that only some providers return are now optional.

### API behavior worth knowing
- Some providers complete orders and renewals asynchronously: the response can
  come back `PENDING` / `pending`, followed by an `order.completed` /
  `renewal.completed` (or `*.failed`, refunded automatically) webhook.
- Renew / upgrade / info / topup-check reject an ICCID that belongs to another
  account with `eSIM not found` (404).
- Renewing with a plan from a different provider than the eSIM fails with
  `Invalid plan`; ineligible renewals fail with `Renewal not available` - both
  **before** your balance is charged.

## 0.1.0
- Initial release: plans and eSIM management.
