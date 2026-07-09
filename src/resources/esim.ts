import type { WiilineClient } from '../client';
import type {
  EsimIssueParams,
  EsimIssueResponse,
  EsimRenewParams,
  EsimRenewResponse,
  EsimListTopupsResponse,
  EsimUpgradeParams,
  EsimUpgradeResponse,
  EsimInfoResponse,
  EsimTopupCheckResponse,
  EsimOrderResponse,
} from '../types';

export class EsimResource {
  constructor(private readonly client: WiilineClient) {}

  /**
   * Issue one or more new eSIMs for a plan (or top up an existing eSimCard
   * eSIM by passing `iccid`). Charges your account balance.
   *
   * Rate limit: 10 requests/minute.
   *
   * @example
   * const result = await client.esim.issue({ plan_id: 'plan_uuid_or_code', count: 1 });
   * console.log(result.data.response.esims[0].qrcode);
   */
  issue(params: EsimIssueParams): Promise<EsimIssueResponse> {
    return this.client.request<EsimIssueResponse>('POST', '/api/esim/issue', { body: params });
  }

  /**
   * Renew an existing eSIM with a new plan. Charges your account balance; if
   * the provider call fails after the charge, the amount is automatically
   * refunded (`refunded: true` in the response, `transaction` omitted).
   *
   * Rate limit: 10 requests/minute.
   */
  renew(params: EsimRenewParams): Promise<EsimRenewResponse> {
    return this.client.request<EsimRenewResponse>('POST', '/api/esim/renew', { body: params });
  }

  /**
   * List topup/upgrade products available for an active eSIM, without
   * purchasing anything.
   *
   * Rate limit: 10 requests/minute.
   */
  listTopups(iccid: string): Promise<EsimListTopupsResponse> {
    return this.client.request<EsimListTopupsResponse>('GET', '/api/esim/upgrade', { query: { iccid } });
  }

  /**
   * Purchase a topup/upgrade product for an existing eSIM (eSIMfx provider
   * only). Charges your account balance; refunded automatically if the
   * provider call fails after the charge (`refunded: true`, `transaction`
   * omitted).
   *
   * Rate limit: 10 requests/minute.
   */
  upgrade(params: EsimUpgradeParams): Promise<EsimUpgradeResponse> {
    return this.client.request<EsimUpgradeResponse>('POST', '/api/esim/upgrade', { body: params });
  }

  /**
   * Get the current status and usage details of an eSIM by ICCID.
   *
   * Note: `data.status_qr` here is the raw provider string (casing varies,
   * e.g. "Installed") - it is NOT normalized the way `issue()`'s response is.
   */
  info(iccid: string): Promise<EsimInfoResponse> {
    return this.client.request<EsimInfoResponse>('GET', '/api/esim/info', { query: { iccid } });
  }

  /**
   * Check whether topup packages are available for an eSIM, and list them.
   * Auto-detects the provider - there is no way to force one via this call.
   */
  checkTopup(iccid: string): Promise<EsimTopupCheckResponse> {
    return this.client.request<EsimTopupCheckResponse>('GET', '/api/esim/topup-check', { query: { iccid } });
  }

  /** Look up a previous order (from `issue()`) by its `order_uuid`. */
  getOrder(orderUuid: string): Promise<EsimOrderResponse> {
    return this.client.request<EsimOrderResponse>('GET', `/api/esim/order/${encodeURIComponent(orderUuid)}`);
  }
}

export type {
  EsimIssueParams,
  EsimIssueResponse,
  EsimRenewParams,
  EsimRenewResponse,
  EsimListTopupsResponse,
  EsimUpgradeParams,
  EsimUpgradeResponse,
  EsimInfoResponse,
  EsimTopupCheckResponse,
  EsimOrderResponse,
};
