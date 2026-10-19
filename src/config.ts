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
}

const truthy = (v?: string) => ['1', 'true', 'yes'].includes(v?.trim().toLowerCase() ?? '');

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
  return {
    accessToken: env.THREADS_ACCESS_TOKEN?.trim() || undefined,
    userId: env.THREADS_USER_ID?.trim() || undefined,
    baseUrl: host || undefined,
    apiVersion: apiVersion || undefined,
    appSecret: env.THREADS_APP_SECRET?.trim() || undefined,
    scheduleFile: env.THREADS_SCHEDULE_FILE?.trim() || undefined,
    readOnly: truthy(env.THREADS_READ_ONLY),
  };
}
