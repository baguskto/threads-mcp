export interface Config {
  accessToken?: string;
  userId?: string;
  baseUrl?: string;
  apiVersion?: string;
  appSecret?: string;
  /** Where scheduled posts are persisted between restarts. */
  scheduleFile?: string;
  /** Only register tools that never change anything on Threads. */
  readOnly?: boolean;
  /** How long a publish call waits for media processing before returning the pending container. */
  publishWaitSeconds?: number;
}

const truthy = (v?: string) => ['1', 'true', 'yes'].includes(v?.trim().toLowerCase() ?? '');

/** A non-negative number of seconds; 0 is valid (return immediately). */
function parseSeconds(value?: string): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error(`THREADS_PUBLISH_WAIT_SECONDS must be a number of seconds >= 0, got "${value}"`);
  return n;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const baseUrl = env.THREADS_API_BASE_URL?.trim();
  let apiVersion = env.THREADS_API_VERSION?.trim();
  let host = baseUrl;
  // Accept the legacy form THREADS_API_BASE_URL=https://graph.threads.net/v1.0.
  const match = baseUrl?.match(/^(.*?)\/(v\d+\.\d+)\/?$/);
  if (match) {
    host = match[1];
    apiVersion ??= match[2];
  }
  if (host) assertSafeBaseUrl(host);
  return {
    accessToken: env.THREADS_ACCESS_TOKEN?.trim() || undefined,
    userId: env.THREADS_USER_ID?.trim() || undefined,
    baseUrl: host || undefined,
    apiVersion: apiVersion || undefined,
    appSecret: env.THREADS_APP_SECRET?.trim() || undefined,
    scheduleFile: env.THREADS_SCHEDULE_FILE?.trim() || undefined,
    readOnly: truthy(env.THREADS_READ_ONLY),
    publishWaitSeconds: parseSeconds(env.THREADS_PUBLISH_WAIT_SECONDS),
  };
}

/** The access token is sent to this host, so only allow HTTPS (or plain HTTP to localhost for testing). */
function assertSafeBaseUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`THREADS_API_BASE_URL is not a valid URL: ${value}`);
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) {
    throw new Error('THREADS_API_BASE_URL must use https:// (http:// is only allowed for localhost)');
  }
}
