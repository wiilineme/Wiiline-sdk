import type { WiilineApiErrorBody } from './types';

/**
 * Thrown for any API response with `success: false`, or a network/transport
 * failure. Note the API itself is not perfectly consistent about HTTP status
 * codes (e.g. `plans.list()` can return HTTP 200 with `success: false` when
 * no plans are available for the account) - always prefer catching this
 * error over branching on `status` alone.
 */
export class WiilineApiError extends Error {
  /** HTTP status code, or 0 for a network-level failure (no response received). */
  readonly status: number;
  /** Short machine-oriented error code/category from the API's `error` field. */
  readonly code: string;
  /** Extra structured detail the API attached (varies by endpoint). */
  readonly details?: unknown;
  /** Seconds to wait before retrying, present on 429 responses. */
  readonly retryAfter?: number;
  /** The raw parsed response body, if one was returned. */
  readonly body?: WiilineApiErrorBody;

  constructor(message: string, options: {
    status: number;
    code?: string;
    details?: unknown;
    retryAfter?: number;
    body?: WiilineApiErrorBody;
  }) {
    super(message);
    this.name = 'WiilineApiError';
    this.status = options.status;
    this.code = options.code || 'unknown_error';
    this.details = options.details;
    this.retryAfter = options.retryAfter;
    this.body = options.body;
  }
}
