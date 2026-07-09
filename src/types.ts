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
 * Note: `price` is the provider's base price only. The actual amount charged
 * at `esim.issue()` / `esim.renew()` / `esim.upgrade()` time includes a
 * commission on top (the greater of $1.00 or 5% of the base price, or a flat
 * $1.00 for renew/upgrade) — see `transaction.amount_charged` on those
 * responses for the real total.
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
  activation_type: string;
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
  provider: 'esimfx' | 'esimcard' | 'yesim' | string;
  /** "fixed" | "unlimited" | "unlimited_per_day" */
  data_type: string;
}

export interface PlansListParams {
  /** Filter to a single plan by plan_uuid or plan_code. */
  plan_id?: string;
  /** Substring match against plan name/countries. */
  filter?: string;
  plan_type?: 'country' | 'region' | 'global';
  /** eSimCard package group. Defaults to the API's current group. */
  group?: string;
  /** eSimCard-specific filter. */
  country_id?: string;
  /** eSimCard-specific filter. */
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
 * Normalized eSIM status, as returned by `esim.issue()`.
 *
 * IMPORTANT: this normalization is only applied by `esim.issue()`.
 * `esim.info()` returns the raw provider string instead (e.g. "Installed"
 * with mixed casing) - don't assume every endpoint's `status_qr` uses this
 * enum. Compare case-insensitively if you need to match against both.
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
  plan_activated_at: string | null;
  plan_expired_at: string | null;
  qrcode: string;
  status_qr: string;
  provider_status_qr?: string;
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
  provider?: string;
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
  /** plan_uuid (internal) or plan_code (provider ID). */
  plan_id: string;
  /** Number of eSIMs to issue. 1-10. Must be 1 if `iccid` is given. */
  count: number;
  /** eSimCard only: top up an existing eSIM instead of issuing a new one. */
  iccid?: string;
  /** Force a specific provider instead of auto-detecting. */
  provider?: 'esimfx' | 'esimcard' | 'yesim';
}

export interface EsimIssueResponse {
  order_uuid: string;
  message: string;
  data: {
    plan_id: string;
    plan_code: string;
    count: number;
    provider: string;
    response: { esims: EsimRecord[] };
  };
  transaction: Transaction;
  user: ApiUser;
  testing_mode?: boolean;
}

export interface EsimRenewParams {
  iccid: string;
  /** plan_uuid (internal) or plan_code (provider ID). */
  plan_id: string;
  payment_id?: string;
}

export interface EsimRenewResponse {
  order_uuid: string;
  message: string;
  data: {
    iccid: string;
    plan_id: string;
    provider: string;
    order_id: string | null;
    status: string | null;
    /** Only present when provider === 'esimfx'. */
    qr_code?: string | null;
    apn?: string | null;
    esim_status?: string | null;
    subscription?: unknown;
  };
  /**
   * Absent in testing-mode responses (live-mode only). If the provider call
   * failed after the balance was already deducted, the charge is refunded
   * and the top-level response instead has `refunded: true` +
   * `refund_amount` (with `transaction` omitted) — check for `refunded`
   * before assuming `transaction` is present.
   */
  transaction?: Transaction;
  refunded?: boolean;
  refund_amount?: number;
  user: ApiUser;
  testing_mode?: boolean;
}

export interface EsimTopupProduct {
  id: string;
  name: string;
  days: number;
  data: string;
  voice: string;
  sms: string;
  price: number;
  currency: string;
  package_type: string;
  unlimited: boolean;
  unlimited_speed: string;
  countries_included: string;
  operators: string;
  speed: string;
  provider: string;
}

export interface EsimListTopupsResponse {
  data: {
    iccid: string;
    available_topups: EsimTopupProduct[];
    count: number;
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
    provider: string;
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
  data: EsimRecord & { provider: string };
  user: ApiUser;
  testing_mode?: boolean;
}

/**
 * `checkTopup()` is the one endpoint whose success payload is flat (no
 * `user` object, and `iccid`/`provider`/`topup_available` sit at the top
 * level rather than under `data`) - this mirrors the live API exactly,
 * inconsistent as it is.
 */
export interface EsimTopupCheckResponse {
  iccid: string;
  provider: string;
  topup_available: boolean;
  message: string;
  data: {
    can_topup: boolean;
    available_packages: EsimTopupProduct[];
  };
  testing_mode?: boolean;
}

export interface EsimOrderResponse {
  order_uuid: string;
  esims: EsimRecord[];
  user: ApiUser;
  [key: string]: unknown;
}

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
