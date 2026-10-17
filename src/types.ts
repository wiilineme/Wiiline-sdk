/**
 * How a plan activates (`Plan.activation_type`):
 * - `PDP`       - activates when the first byte of data is used. Some plans must
 *                 be activated within a deadline - see `activation_type_description`
 *                 / `other_info`, and `EsimRecord.activate_before` once bought.
 * - `IMMEDIATE` - the plan starts at purchase; the usage period counts from the
 *                 order time.
 */
export type ActivationType = 'PDP' | 'IMMEDIATE';

/** The authenticated account context, echoed back by most endpoints. */
export interface ApiUser {
  uuid: string;
  username: string;
  email: string;
}

/**
 * A country covered by a plan.
 */
export interface PlanCountry {
  code: string;
  name: string;
  image_url: string;
  network_coverage: { network_name: string; speed: string }[];
}

/**
 * A plan/package as returned by `plans.list()` and `plans.get()`.
 *
 * `price` is the base price. Issuing, renewing, or upgrading adds a
 * commission on top (max of $1.00 or 5%, flat $1.00 for renew/upgrade) 
 * use `transaction.amount_charged` on those responses for the real total.
 */
export interface Plan {
  plan_uuid: string;
  plan_code: string;
  name: string;
  days: number;
  price: number;
  data: string;
  data_unit: string;
  package_validity: number;
  package_validity_unit: string;
  max_speed_per_day: string;
  voice: string;
  sms: string;
  package_type: string;
  activation_type: ActivationType | string;
  activation_type_description: string;
  countries_included: string;
  countryIso2: string;
  region_name: string;
  unthrottle_data: string;
  throttle_speed: string;
  plan_type: 'country' | 'region' | 'global' | string;
  operators: string;
  speed: string;
  description: string;
  image: string;
  apn: string;
  currency: string;
  tether: boolean;
  can_renew: boolean;
  other_info: string;
  connectivity: string;
  unlimited_speed: string;
  imsi_profile: string;
  countries: PlanCountry[];
  /** "fixed" | "unlimited" | "unlimited_per_day" */
  data_type: string;
}

export interface PlansListParams {
  /** Filter to a single plan by plan_uuid or plan_code. */
  plan_id?: string;
  /** Substring match against plan name/countries. */
  filter?: string;
  plan_type?: 'country' | 'region' | 'global';
  /** Package group. Defaults to the API's current group. */
  group?: string;
  /** Filter by country id. */
  country_id?: string;
  /** Filter by continent id. */
  continent_id?: string;
}

export interface PlansListResponse {
  data: Plan[];
  meta: { total: number; returned: number };
  /** Present only when the account has API testing mode enabled. */
  testing_mode?: boolean;
}

export interface PlanDetailsResponse {
  data: Plan;
  user: ApiUser;
  testing_mode?: boolean;
}

/**
 * Normalized eSIM status returned by `esim.issue()`. `esim.info()` returns
 * the raw network status string instead (casing varies, e.g. "Installed")  compare
 * case-insensitively if you need to match against both.
 */
export type UnifiedEsimStatus =
  | 'RELEASED'
  | 'INSTALLED'
  | 'ACTIVE'
  | 'PENDING'
  | 'EXPIRED'
  | 'SUSPENDED'
  | 'INACTIVE'
  | 'DELETED'
  | 'ERROR'
  | 'UNKNOWN';

export interface EsimRecord {
  id: string;
  iccid: string;
  user_uuid: string;
  created_at: string;
  active_plan_id: string | null;
  /** When the plan actually started. `null` until the eSIM is first used. */
  plan_activated_at: string | null;
  /** When the plan ends. `null` until the eSIM is first used. */
  plan_expired_at: string | null;
  /**
   * Latest date the eSIM can still be activated (networks with an activation deadline, eSIMs that
   * haven't been used yet - typically 60 days after purchase). `null` once
   * activated, and always `null` on networks without a deadline.
   */
  activate_before?: string | null;
  /** Some networks only (`esim.info()`): last date the eSIM can still be renewed. */
  renew_before?: string | null;
  qrcode: string;
  status_qr: string;
  imsi: string | null;
  msisdn: string | null;
  is_deleted: string;
  data_left_mb: number;
  data_package_mb: number;
  data_used_mb: number;
  unlimited: boolean;
  package_name: string | null;
  apn: string | null;
  puk_code: string | null;
  topup_available: boolean | null;
  img: string | null;
  ios_tap_link: string | null;
  android_tap_link: string | null;
  sim_applied?: boolean;
  /**
   * Device the eSIM is installed on - `esim.info()`, only on networks that
   * report it (otherwise absent). Each reinstall increases `install_count`;
   * installs per eSIM are limited by the network.
   */
  install_device?: string | null;
  install_count?: number | null;
  installed_at?: string | null;
  /** The device's eSIM chip identifier (EID). */
  eid?: string | null;
}

/** Cost breakdown for a completed purchase. */
export interface Transaction {
  plan_cost: number;
  service_fee: number;
  amount_charged: number;
  balance_before: number;
  balance_after: number;
  plan_name: string;
  /** Only present on `esim.issue()` responses. */
  quantity?: number;
}

export interface EsimIssueParams {
  /** plan_uuid or plan_code from `plans.list()`. */
  plan_id: string;
  /** Number of eSIMs to issue. 1-10. Must be 1 if `iccid` is given. */
  count: number;
  /** Add the plan to this existing eSIM instead of issuing a new one (plans that support it - see `esim.checkTopup()`). */
  iccid?: string;
}

/**
 * Note: some networks provision asynchronously. If the eSIM isn't ready
 * within ~25 seconds the response still succeeds, but the eSIM comes back with
 * `status_qr: 'PENDING'` and an empty `qrcode`. Get it later with
 * `esim.getOrder(order_uuid)`, or listen for the `order.completed` webhook.
 */
export interface EsimIssueCompletedResponse {
  pending?: false;
  order_uuid: string;
  message: string;
  data: {
    plan_id: string;
    plan_code: string;
    count: number;
    response: { esims: EsimRecord[] };
  };
  transaction: Transaction;
  user: ApiUser;
  testing_mode?: boolean;
}

/** A 202 response retains funds while the provider outcome is verified. */
export interface EsimIssuePendingResponse {
  success: true;
  pending: true;
  order_uuid: string;
  message: string;
}
export type EsimIssueResponse = EsimIssueCompletedResponse | EsimIssuePendingResponse;

export interface EsimRenewParams {
  iccid: string;
  /** plan_uuid or plan_code - one returned by `esim.checkTopup()` for this eSIM. */
  plan_id: string;
  payment_id?: string;
}

/**
 * Some networks confirm renewals asynchronously: `data.status` is `'completed'` when the network
 * confirmed within ~20 seconds (with the new dates), otherwise `'pending'` -
 * the `renewal.completed` / `renewal.failed` webhook follows, and a failed
 * renewal is refunded automatically.
 */
export interface EsimRenewResponse {
  order_uuid: string;
  message: string;
  data: {
    iccid: string;
    plan_id: string;
    order_id?: string | null;
    status: string | null;
    /** Asynchronous networks only, once confirmed. */
    plan_activated_at?: string | null;
    plan_expired_at?: string | null;
    activate_before?: string | null;
    renew_expiration_time?: string | null;
    /** Present on some networks. */
    qr_code?: string | null;
    apn?: string | null;
    esim_status?: string | null;
    subscription?: unknown;
  };
  /**
   * Omitted if the network call failed after the balance was deducted 
   * in that case the charge is refunded and `refunded`/`refund_amount` are
   * set instead. Also omitted in testing-mode responses.
   */
  transaction?: Transaction;
  refunded?: boolean;
  refund_amount?: number;
  user: ApiUser;
  testing_mode?: boolean;
}

/**
 * A product that can be applied to an existing eSIM. Pass `id` to
 * `esim.upgrade()` (or `esim.renew()` as `plan_id`).
 *
 * On some networks products are renewal plans of the same card type and
 * coverage as the eSIM (anything else is rejected); they carry `plan_code` and
 * `is_current_plan`, and `price` is the total you'll be charged.
 */
export interface EsimTopupProduct {
  id: string;
  name: string;
  days: number | null;
  data: string;
  voice?: string;
  sms?: string;
  /** Total charged when you apply this product (plan_price + service_fee). */
  price: number;
  /** The plan's own price, before the service fee. */
  plan_price?: number;
  /** Fee added when applying it (flat for renewals, max($1, 5%) for eSIM top-ups via `esim.issue()`). */
  service_fee?: number;
  currency: string;
  package_type?: string;
  /** country | region | global */
  plan_type?: string;
  region_name?: string;
  unlimited?: boolean;
  unlimited_speed?: string | null;
  countries_included?: string;
  operators?: string;
  speed?: string;
  /** Some networks only. */
  plan_code?: string;
  /** Some networks only: the plan currently on the eSIM. */
  is_current_plan?: boolean;
}

export interface EsimListTopupsResponse {
  data: {
    iccid: string;
    available_topups: EsimTopupProduct[];
    count: number;
    /** Why the list is empty, when the eSIM can't be renewed. */
    message?: string;
  };
}

export interface EsimUpgradeParams {
  iccid: string;
  product_id: string;
}

export interface EsimUpgradeResponse {
  order_uuid: string;
  message: string;
  data: {
    iccid: string;
    product_id: string;
    order_id: string;
    status: string;
    qr_code: string | null;
    apn: string | null;
    esim_status: string | null;
    subscription: unknown;
  };
  transaction?: Transaction;
  refunded?: boolean;
  refund_amount?: number;
  user: ApiUser;
  testing_mode?: boolean;
}

export interface EsimInfoResponse {
  data: EsimRecord;
  user: ApiUser;
  testing_mode?: boolean;
}

/**
 * `iccid`/`topup_available` sit at the top level here (not under
 * `data`, and no `user` object), unlike the other eSIM response shapes.
 */
export interface EsimTopupCheckResponse {
  iccid: string;
  topup_available: boolean;
  /** Human-readable result; explains why when `topup_available` is false. */
  message: string;
  data: {
    can_topup: boolean;
    available_packages: EsimTopupProduct[];
  };
  testing_mode?: boolean;
}

export interface EsimChangeParams {
  /** ICCID of the eSIM to replace (one of your own eSIMs). */
  iccid: string;
}

/**
 * Result of `esim.change()`: the replacement eSIM (new ICCID and QR code) in
 * the same normalized shape as webhook payloads. The old eSIM stops working.
 */
export interface EsimChangeResponse {
  message: string;
  data: {
    replaced_iccid: string;
    /** `null` in testing mode. */
    order_uuid: string | null;
    esim: import('./webhooks').WebhookEsim;
  };
}

export interface EsimOrderResponse {
  order_uuid: string;
  esims: EsimRecord[];
  user: ApiUser;
  [key: string]: unknown;
}

/**
 * Common `WiilineApiError.code` values (the API's `error` field). Errors marked
 * "before charging" mean nothing was deducted from your balance.
 * - `Insufficient balance`   (402)
 * - `Invalid plan`           (400) - unknown plan, or a plan that isn't
 *                             compatible with the eSIM being renewed
 * - `eSIM not found`         (404) - the ICCID isn't in your account
 * - `Renewal not available`  (400, before charging) - e.g. renewal deadline
 *                             passed, eSIM cancelled, incompatible plan
 * - `Renewal not supported` / `Upgrade not supported` (400, before charging)
 * - `Too many requests`      (429) - see `retryAfter`
 */
export type KnownApiErrorCode =
  | 'Insufficient balance'
  | 'Invalid plan'
  | 'eSIM not found'
  | 'Renewal not available'
  | 'Renewal not supported'
  | 'Upgrade not supported';

/** Shape of every error response body from the API. */
export interface WiilineApiErrorBody {
  success: false;
  error: string;
  message?: string;
  hint?: string;
  details?: unknown;
  retryAfter?: number;
  /** Present on esim.issue() insufficient-balance errors. */
  required_amount?: number;
  current_balance?: number;
  shortage?: number;
  [key: string]: unknown;
}
