import { WiilineApiError } from './errors';
import type { WiilineApiErrorBody } from './types';
import { PlansResource } from './resources/plans';
import { EsimResource } from './resources/esim';

export interface WiilineClientOptions {
  /** Your Wiiline API key (from the dashboard's API Tokens page), e.g. "wii_...". */
  apiKey: string;
  /** API base URL. Defaults to `https://wiiesim.me`. */
  baseUrl?: string;
  /** Request timeout in milliseconds. Defaults to 30000. */
  timeoutMs?: number;
}

export type QueryParams = Record<string, string | number | boolean | undefined>;

const DEFAULT_BASE_URL = 'https://wiiesim.me';
const DEFAULT_TIMEOUT_MS = 30_000;

export class WiilineClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  readonly plans: PlansResource;
  readonly esim: EsimResource;

  constructor(options: WiilineClientOptions) {
    if (!options?.apiKey) {
      throw new Error('WiilineClient: apiKey is required');
    }
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    this.plans = new PlansResource(this);
    this.esim = new EsimResource(this);
  }

  private buildUrl(path: string, query?: QueryParams): string {
    const url = new URL(this.baseUrl + path);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }

  /** @internal Used by resource classes - not part of the public API surface. */
  async request<T>(
    method: 'GET' | 'POST',
    path: string,
    options: { query?: QueryParams; body?: unknown; headers?: Record<string, string> } = {}
  ): Promise<T> {
    const url = this.buildUrl(path, options.query);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${this.apiKey}`,
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        throw new WiilineApiError(`Request timed out after ${this.timeoutMs}ms`, {
          status: 0,
          code: 'timeout',
        });
      }
      throw new WiilineApiError(
        `Network error calling ${path}: ${(err as Error)?.message || String(err)}`,
        { status: 0, code: 'network_error' }
      );
    } finally {
      clearTimeout(timeout);
    }

    let json: any = null;
    try {
      json = await response.json();
    } catch {
      // Non-JSON body (rare - e.g. an upstream proxy error page).
    }

    // success:false can come back with a 200 on some endpoints, so check
    // the body independently of the HTTP status.
    if (!response.ok || json?.success === false) {
      const body: WiilineApiErrorBody | undefined = json ?? undefined;
      const retryAfterHeader = response.headers.get('retry-after');
      const retryAfter = body?.retryAfter ?? (retryAfterHeader ? Number(retryAfterHeader) : undefined);

      throw new WiilineApiError(
        body?.message || body?.error || `Request to ${path} failed with status ${response.status}`,
        {
          status: response.status,
          code: body?.error || 'api_error',
          details: body?.details,
          retryAfter,
          body,
        }
      );
    }

    return json as T;
  }
}
