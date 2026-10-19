/**
 * Error raised for any non-2xx response from the Threads Graph API.
 * Carries the raw Graph error fields plus a human-friendly hint.
 */
export class ThreadsApiError extends Error {
  readonly status: number;
  readonly code?: number;
  readonly subcode?: number;
  readonly type?: string;
  readonly fbtraceId?: string;
  readonly isTransient: boolean;
  readonly retryAfterSeconds?: number;
  readonly hint?: string;

  constructor(init: {
    message: string;
    status: number;
    code?: number;
    subcode?: number;
    type?: string;
    fbtraceId?: string;
    isTransient?: boolean;
    retryAfterSeconds?: number;
  }) {
    const hint = hintFor(init.code, init.subcode, init.status, init.message);
    super(hint ? `${init.message} — ${hint}` : init.message);
    this.name = 'ThreadsApiError';
    this.status = init.status;
    this.code = init.code;
    this.subcode = init.subcode;
    this.type = init.type;
    this.fbtraceId = init.fbtraceId;
    this.isTransient = init.isTransient ?? false;
    this.retryAfterSeconds = init.retryAfterSeconds;
    this.hint = hint;
  }

  /** Whether retrying the same request later is likely to succeed. */
  get retryable(): boolean {
    if (this.isTransient) return true;
    if (this.status === 429 || this.status >= 500) return true;
    // 1 = unknown, 2 = service unavailable; 4/17/32/613 = rate limiting.
    return [1, 2, 4, 17, 32, 613].includes(this.code ?? -1);
  }

  toJSON() {
    return {
      error: this.message,
      status: this.status,
      code: this.code,
      subcode: this.subcode,
      type: this.type,
      fbtrace_id: this.fbtraceId,
    };
  }
}

function hintFor(code: number | undefined, subcode: number | undefined, status: number, message: string): string | undefined {
  if (code === 190) {
    return 'The access token is invalid or expired. Generate a new long-lived token (or call refresh_access_token before it expires).';
  }
  if (code === 10 || (code !== undefined && code >= 200 && code < 300)) {
    return 'Permission denied. Make sure the token was granted the scope this endpoint needs (see validate_setup).';
  }
  if (code === 4 || code === 17 || code === 32 || code === 613 || status === 429) {
    return 'Rate limit reached. Check get_publishing_limit and wait before retrying.';
  }
  if (code === 24 && subcode === 4279009) {
    return 'The media container is not ready yet. Wait for it to finish processing before publishing.';
  }
  if (/LINK_LIMIT_EXCEEDED/.test(message)) {
    return 'Posts can contain at most 5 links.';
  }
  if (/GEO_GATING|FEATURE_NOT_AVAILABLE/.test(message)) {
    return 'This feature is not enabled for your account.';
  }
  if (code === 100 && /url|media|image|video/i.test(message)) {
    return 'Media URLs must be publicly reachable over HTTPS and in a supported format.';
  }
  return undefined;
}

/** Formats any thrown value into a single-line message for tool output. */
export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
