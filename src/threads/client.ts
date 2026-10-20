import { ThreadsApiError } from './errors.js';

export const DEFAULT_BASE_URL = 'https://graph.threads.net';
export const DEFAULT_API_VERSION = 'v1.0';

export type ParamValue = string | number | boolean | readonly (string | number)[] | Record<string, unknown> | null | undefined;
export type Params = Record<string, ParamValue>;

export interface Paging {
  cursors?: { before?: string; after?: string };
  next?: string;
  previous?: string;
}

export interface Page<T> {
  data: T[];
  paging?: Paging;
}

export interface RequestOptions {
  /** Set to false for endpoints that live outside the versioned path (token refresh/exchange). */
  versioned?: boolean;
  /** Set to false to omit the access token (oEmbed is public). */
  auth?: boolean;
  /** Override the retry count for this request. */
  retries?: number;
}

/** Relative API paths are node IDs and edge names only; this blocks `..`, `?`, `#` and encoded tricks. */
const SAFE_PATH = /^\/[A-Za-z0-9_]+(\/[A-Za-z0-9_]+)*$/;

export interface ThreadsClientOptions {
  /** Optional so public endpoints (oEmbed) work without one; authenticated calls throw without it. */
  accessToken?: string;
  /** Override the Graph host, e.g. for a proxy. Defaults to https://graph.threads.net. */
  baseUrl?: string;
  apiVersion?: string;
  /** Skip the `/me` lookup when the Threads user ID is already known. */
  userId?: string;
  timeoutMs?: number;
  /** Retries for idempotent requests (GET/DELETE) on transient failures. */
  maxRetries?: number;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Minimal Threads Graph API client built on the global fetch.
 * GET/DELETE are retried with exponential backoff on transient errors;
 * POST is never retried so a publish can't be duplicated.
 */
export class ThreadsClient {
  private accessToken?: string;
  private readonly base: string;
  private readonly root: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private userId?: string;

  constructor(options: ThreadsClientOptions) {
    this.accessToken = options.accessToken;
    this.base = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    const version = options.apiVersion ?? DEFAULT_API_VERSION;
    this.root = version ? `${this.base}/${version}` : this.base;
    this.userId = options.userId;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.maxRetries = options.maxRetries ?? 3;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.sleep = options.sleep ?? defaultSleep;
  }

  get token(): string | undefined {
    return this.accessToken;
  }

  setAccessToken(token: string) {
    this.accessToken = token;
  }

  /** The authenticated user's Threads ID, looked up once and cached. */
  async getUserId(): Promise<string> {
    if (!this.userId) {
      const me = await this.get<{ id: string }>('/me', { fields: 'id' });
      this.userId = me.id;
    }
    return this.userId;
  }

  get<T>(path: string, params?: Params, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, params, options);
  }

  post<T>(path: string, params?: Params, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, params, options);
  }

  delete<T>(path: string, params?: Params, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, params, options);
  }

  /**
   * Walks `paging.next` links until `maxItems` results are collected
   * or there are no more pages.
   */
  async paginate<T>(path: string, params: Params = {}, maxItems = 100): Promise<T[]> {
    const items: T[] = [];
    let page = await this.get<Page<T>>(path, params);
    for (;;) {
      items.push(...(page.data ?? []));
      const next = page.paging?.next;
      if (items.length >= maxItems || !next || !page.data?.length) break;
      page = await this.request<Page<T>>('GET', this.rebase(next));
    }
    return items.slice(0, maxItems);
  }

  /**
   * Points a `paging.next` link at the configured host. Graph returns links on
   * its own host, which would bypass a proxy set with THREADS_API_BASE_URL.
   */
  private rebase(link: string): string {
    const url = new URL(link);
    const base = new URL(this.base);
    if (url.origin === base.origin) return url.toString();
    const prefix = base.pathname.replace(/\/+$/, '');
    return new URL(`${prefix}${url.pathname}${url.search}`, base.origin).toString();
  }

  private buildUrl(path: string, versioned = true): URL {
    if (/^https?:\/\//.test(path)) {
      // Only follow pagination links that point back at the configured API host.
      const url = new URL(path);
      const base = new URL(this.base);
      const prefix = base.pathname.replace(/\/+$/, '');
      const underBase = !prefix || url.pathname === prefix || url.pathname.startsWith(`${prefix}/`);
      if (url.origin !== base.origin || !underBase) throw new Error(`Refusing to follow a link to ${url.origin}${url.pathname}`);
      return url;
    }
    const normalized = path.startsWith('/') ? path : `/${path}`;
    if (!SAFE_PATH.test(normalized)) throw new Error(`Invalid API path: ${path}`);
    return new URL(`${versioned ? this.root : this.base}${normalized}`);
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    params: Params = {},
    options: RequestOptions = {},
  ): Promise<T> {
    const url = this.buildUrl(path, options.versioned);
    if (options.auth !== false && !this.accessToken) {
      throw new Error('THREADS_ACCESS_TOKEN is not set. Add it to the env block of this MCP server in your client config.');
    }
    const encoded = encodeParams(options.auth === false ? params : { ...params, access_token: this.accessToken });
    let body: URLSearchParams | undefined;
    if (method === 'POST') {
      body = encoded;
    } else {
      for (const [key, value] of encoded) url.searchParams.set(key, value);
    }

    const attempts = method === 'POST' ? 1 : (options.retries ?? this.maxRetries) + 1;
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.send<T>(method, url, body);
      } catch (error) {
        const retryable = error instanceof ThreadsApiError ? error.retryable : isNetworkError(error);
        if (!retryable || attempt >= attempts) throw error;
        const backoff = Math.min(500 * 2 ** (attempt - 1), 8_000);
        const retryAfter = error instanceof ThreadsApiError ? (error.retryAfterSeconds ?? 0) * 1000 : 0;
        await this.sleep(Math.min(Math.max(backoff, retryAfter), 60_000));
      }
    }
  }

  private async send<T>(method: string, url: URL, body?: URLSearchParams): Promise<T> {
    const response = await this.fetchImpl(url, {
      method,
      body,
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const text = await response.text();
    let payload: any;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { raw: text };
    }
    if (!response.ok || payload?.error) {
      const err = payload?.error ?? {};
      throw new ThreadsApiError({
        message: err.error_user_msg || err.message || `HTTP ${response.status} ${response.statusText}`.trim(),
        status: response.status,
        code: err.code,
        subcode: err.error_subcode,
        type: err.type,
        fbtraceId: err.fbtrace_id,
        isTransient: err.is_transient === true,
        retryAfterSeconds: Number(response.headers.get('retry-after')) || undefined,
      });
    }
    return payload as T;
  }
}

/** Serialises params the way the Graph API expects (CSV arrays, JSON objects). */
export function encodeParams(params: Params): URLSearchParams {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (value.length) out.set(key, value.join(','));
    } else if (typeof value === 'object') {
      out.set(key, JSON.stringify(value));
    } else {
      out.set(key, String(value));
    }
  }
  return out;
}

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === 'TimeoutError' || error.name === 'AbortError' || error instanceof TypeError;
}
