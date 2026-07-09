import type { WiilineClient } from '../client';
import type { Plan, PlansListParams, PlansListResponse, PlanDetailsResponse } from '../types';

export class PlansResource {
  constructor(private readonly client: WiilineClient) {}

  /**
   * List available plans, optionally filtered by type/country/region/search term.
   *
   * @example
   * const { data: plans } = await client.plans.list({ plan_type: 'country' });
   */
  list(params?: PlansListParams): Promise<PlansListResponse> {
    return this.client.request<PlansListResponse>('GET', '/api/plans', { query: params as any });
  }

  /**
   * Get a single plan by its `plan_uuid` or `plan_code`.
   *
   * @example
   * const { data: plan } = await client.plans.get('198c8236-d1ed-400b-b4d3-5b82541cfbde');
   */
  get(id: string): Promise<PlanDetailsResponse> {
    return this.client.request<PlanDetailsResponse>('GET', `/api/plans/${encodeURIComponent(id)}`);
  }
}

export type { Plan, PlansListParams, PlansListResponse, PlanDetailsResponse };
