import type { Params, ThreadsClient } from './client.js';
import { describeError } from './errors.js';

export type ContainerStatus = 'IN_PROGRESS' | 'FINISHED' | 'PUBLISHED' | 'ERROR' | 'EXPIRED';

export interface PublishOptions {
  /** Longest wait between container status checks (checks back off up to this). */
  pollIntervalMs?: number;
  /** Stop waiting for media processing after this long. Meta suggests at most 5 minutes. */
  timeoutMs?: number;
  /**
   * Absolute time (ms since epoch) after which to stop waiting. Takes precedence
   * over timeoutMs so several containers in one tool call share one budget.
   */
  deadline?: number;
  /** Absolute time after which multi-step tools (thread chains) should stop starting new steps. */
  stopBy?: number;
  /** Aborts waiting (e.g. the MCP request was cancelled); nothing is published after an abort. */
  signal?: AbortSignal;
  /** Called after each status check that is still processing. */
  onProgress?: (info: { containerId: string; elapsedMs: number; status: ContainerStatus }) => void;
}

export interface PublishResult {
  id: string;
  container_id: string;
  permalink?: string;
  shortcode?: string;
  timestamp?: string;
  crossreshare_to_ig_status?: string;
}

/** The container is still processing when the wait budget ran out; it can be published later. */
export class ContainerPendingError extends Error {
  constructor(readonly containerId: string, waitedMs: number) {
    super(
      `Media container ${containerId} is still processing after ${Math.round(waitedMs / 1000)}s. ` +
        'Check it with get_container_status and publish it with publish_container (containers expire after 24 hours).',
    );
    this.name = 'ContainerPendingError';
  }
}

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new Error('Aborted'));
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new Error('Aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function throwIfAborted(signal: AbortSignal | undefined, containerId?: string) {
  if (signal?.aborted) {
    throw new Error(
      containerId
        ? `Cancelled before publishing; container ${containerId} was not published (publish it later with publish_container).`
        : 'Cancelled before publishing.',
    );
  }
}

/** Creates a media container (step 1 of the Threads publishing flow). */
export async function createContainer(client: ThreadsClient, params: Params): Promise<string> {
  const userId = await client.getUserId();
  const res = await client.post<{ id?: string }>(`/${userId}/threads`, params);
  if (!res.id) throw new Error('Threads did not return a container ID');
  return res.id;
}

/**
 * Polls a container until it is ready to publish. Image and video containers
 * are processed asynchronously; publishing too early fails. Text containers
 * are usually ready on the first check, so checks start fast and back off.
 */
export async function waitForContainer(
  client: ThreadsClient,
  containerId: string,
  { pollIntervalMs = 10_000, timeoutMs = 300_000, deadline, signal, onProgress }: PublishOptions = {},
): Promise<ContainerStatus> {
  const started = Date.now();
  const stopAt = deadline ?? started + timeoutMs;
  for (let attempt = 0; ; attempt++) {
    throwIfAborted(signal, containerId);
    const res = await client.get<{ status?: ContainerStatus; error_message?: string }>(`/${containerId}`, {
      fields: 'id,status,error_message',
    });
    throwIfAborted(signal, containerId);
    const status = res.status ?? 'FINISHED';
    if (status === 'FINISHED' || status === 'PUBLISHED') return status;
    if (status === 'ERROR' || status === 'EXPIRED') {
      throw new Error(`Media container ${containerId} ${status.toLowerCase()}${res.error_message ? `: ${res.error_message}` : ''}`);
    }
    const elapsed = Date.now() - started;
    onProgress?.({ containerId, elapsedMs: elapsed, status });
    // Use the whole budget: the last sleep is shortened to end at the deadline.
    const remaining = stopAt - Date.now();
    if (remaining <= 0) throw new ContainerPendingError(containerId, elapsed);
    try {
      await abortableSleep(Math.min(1_000 * 2 ** attempt, pollIntervalMs, remaining), signal);
    } catch {
      throwIfAborted(signal, containerId);
    }
  }
}

/** Publishes a ready container (step 2) and fetches the resulting permalink. */
export async function publishContainer(
  client: ThreadsClient,
  containerId: string,
  options: PublishOptions = {},
): Promise<PublishResult> {
  const status = await waitForContainer(client, containerId, options);
  if (status === 'PUBLISHED') throw new Error(`Media container ${containerId} has already been published`);
  throwIfAborted(options.signal, containerId);
  const userId = await client.getUserId();
  let res: { id?: string; crossreshare_to_ig_status?: string };
  try {
    res = await client.post(`/${userId}/threads_publish`, { creation_id: containerId });
  } catch (error) {
    throw new Error(
      `Publishing container ${containerId} failed: ${describeError(error)}. If this was a timeout or network error the post ` +
        `may be live; check get_container_status (PUBLISHED means it went out) before retrying with publish_container.`,
    );
  }
  if (!res.id) throw new Error(`Threads did not return a media ID after publishing container ${containerId}`);
  return {
    container_id: containerId,
    ...(await describeMedia(client, res.id)),
    ...(res.crossreshare_to_ig_status ? { crossreshare_to_ig_status: res.crossreshare_to_ig_status } : {}),
  };
}

/** Creates a container and publishes it in one go. */
export async function createAndPublish(client: ThreadsClient, params: Params, options?: PublishOptions): Promise<PublishResult> {
  const containerId = await createContainer(client, params);
  return publishContainer(client, containerId, options);
}

async function describeMedia(client: ThreadsClient, mediaId: string): Promise<Omit<PublishResult, 'container_id'>> {
  try {
    return await client.get(`/${mediaId}`, { fields: 'id,permalink,shortcode,timestamp' });
  } catch {
    // The post is live even if the follow-up lookup fails.
    return { id: mediaId };
  }
}
