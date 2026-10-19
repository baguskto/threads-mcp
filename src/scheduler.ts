import { randomUUID } from 'node:crypto';
import { link, mkdir, open, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { describeError } from './threads/errors.js';

export type ScheduledStatus = 'pending' | 'publishing' | 'published' | 'failed' | 'cancelled';

export interface ScheduledPost<P = unknown> {
  id: string;
  publish_at: string;
  created_at: string;
  status: ScheduledStatus;
  /** Everything needed to build the post at publish time. */
  payload: P;
  result?: unknown;
  error?: string;
  updated_at?: string;
  /** Which process is publishing it, so a restart can tell a crash from a peer still at work. */
  claimed_by?: { pid: number; at: string };
}

export const defaultScheduleFile = () => join(homedir(), '.threads-mcp', 'scheduled-posts.json');

/** A claim older than this is treated as abandoned even if its process id is alive (pids get reused). */
const CLAIM_TIMEOUT_MS = 30 * 60_000;
const STALE_LOCK_MS = 60_000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: any) {
    return error?.code === 'EPERM';
  }
}

/**
 * The Threads API has no native scheduling, so scheduled posts are kept in a
 * local JSON file and published by a timer while this server is running.
 * Containers are created at publish time because they expire after 24 hours.
 *
 * Several server processes may share the file (one per MCP client window), so
 * every read-modify-write happens under a lock file, and each post is claimed
 * before it is published so only one process publishes it.
 */
export class Scheduler<P = unknown> {
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly file: string,
    private readonly publish: (payload: P) => Promise<unknown>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async add(payload: P, publishAt: Date): Promise<ScheduledPost<P>> {
    if (Number.isNaN(publishAt.getTime())) throw new Error('publish_at is not a valid date');
    if (publishAt.getTime() <= this.now().getTime()) throw new Error('publish_at must be in the future');
    const post: ScheduledPost<P> = {
      id: randomUUID(),
      publish_at: publishAt.toISOString(),
      created_at: this.now().toISOString(),
      status: 'pending',
      payload,
    };
    await this.update((posts) => {
      posts.push(post);
    });
    return post;
  }

  async list(status?: ScheduledStatus): Promise<ScheduledPost<P>[]> {
    const posts = await this.load();
    return posts.filter((p) => !status || p.status === status).sort((a, b) => a.publish_at.localeCompare(b.publish_at));
  }

  async cancel(id: string): Promise<ScheduledPost<P>> {
    return this.update((posts) => {
      const post = posts.find((p) => p.id === id);
      if (!post) throw new Error(`No scheduled post with id ${id}`);
      if (post.status !== 'pending') throw new Error(`Scheduled post ${id} is already ${post.status}`);
      post.status = 'cancelled';
      post.updated_at = this.now().toISOString();
      return post;
    });
  }

  /**
   * Publishes due posts one at a time, earliest first. Each post is claimed
   * under the lock just before it is published, so a crash leaves at most one
   * post in "publishing" and the rest stay pending.
   */
  async runDue(): Promise<ScheduledPost<P>[]> {
    if (this.running) return [];
    this.running = true;
    const processed: ScheduledPost<P>[] = [];
    try {
      for (;;) {
        const claimed = await this.update((posts) => {
          const now = this.now();
          const next = posts
            .filter((p) => p.status === 'pending' && Date.parse(p.publish_at) <= now.getTime())
            .sort((a, b) => a.publish_at.localeCompare(b.publish_at))[0];
          if (!next) return undefined;
          next.status = 'publishing';
          next.claimed_by = { pid: process.pid, at: now.toISOString() };
          next.updated_at = now.toISOString();
          return { id: next.id, payload: next.payload };
        });
        if (!claimed) break;

        let outcome: Pick<ScheduledPost<P>, 'status' | 'result' | 'error'>;
        try {
          outcome = { status: 'published', result: await this.publish(claimed.payload), error: undefined };
        } catch (error) {
          outcome = { status: 'failed', error: describeError(error), result: undefined };
        }
        const post = await this.update((posts) => {
          const post = posts.find((p) => p.id === claimed.id);
          if (!post) return undefined;
          Object.assign(post, outcome, { updated_at: this.now().toISOString(), claimed_by: undefined });
          return post;
        });
        if (post) processed.push(post);
      }
      return processed;
    } finally {
      this.running = false;
    }
  }

  /**
   * Marks posts stuck in "publishing" as failed when the process that claimed
   * them is gone. They are not re-posted automatically: the publish may have
   * gone through before the crash.
   */
  async recover(): Promise<void> {
    await this.update((posts) => {
      const now = this.now();
      for (const post of posts) {
        if (post.status !== 'publishing') continue;
        const claim = post.claimed_by;
        const abandoned =
          !claim || !processAlive(claim.pid) || now.getTime() - Date.parse(claim.at) > CLAIM_TIMEOUT_MS;
        if (!abandoned) continue;
        post.status = 'failed';
        post.error = 'Server stopped while publishing; check your profile before rescheduling.';
        post.claimed_by = undefined;
        post.updated_at = now.toISOString();
      }
    });
  }

  start(intervalMs = 30_000) {
    if (this.timer) return;
    const tick = () => {
      this.runDue().catch((error) => console.error('Scheduler error:', describeError(error)));
    };
    this.recover()
      .catch((error) => console.error('Scheduler error:', describeError(error)))
      .finally(tick);
    this.timer = setInterval(tick, intervalMs);
    this.timer.unref();
  }

  stop() {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  /** Reads the file fresh each time so several server processes stay in sync. */
  private async load(): Promise<ScheduledPost<P>[]> {
    let raw: string;
    try {
      raw = await readFile(this.file, 'utf8');
    } catch (error: any) {
      if (error?.code === 'ENOENT') return [];
      throw error;
    }
    try {
      const data = JSON.parse(raw);
      return Array.isArray(data?.posts) ? data.posts : [];
    } catch {
      throw new Error(`Schedule file ${this.file} is not valid JSON; fix or move it before scheduling more posts.`);
    }
  }

  private async save(posts: ScheduledPost<P>[]) {
    await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
    const tmp = `${this.file}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(tmp, JSON.stringify({ version: 1, posts }, null, 2), { mode: 0o600 });
    await rename(tmp, this.file);
  }

  /** Loads, lets `fn` change the posts, and saves if anything changed — all under the lock. */
  private async update<T>(fn: (posts: ScheduledPost<P>[]) => T): Promise<T> {
    return this.withLock(async () => {
      const posts = await this.load();
      const before = JSON.stringify(posts);
      const result = fn(posts);
      if (JSON.stringify(posts) !== before) await this.save(posts);
      return result;
    });
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const lock = `${this.file}.lock`;
    const token = randomUUID();
    await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
    for (let attempt = 0; ; attempt++) {
      try {
        const handle = await open(lock, 'wx', 0o600);
        await handle.writeFile(token);
        await handle.close();
        break;
      } catch (error: any) {
        if (error?.code !== 'EEXIST') throw error;
        if (await this.breakStaleLock(lock)) continue;
        if (attempt > 200) throw new Error(`Schedule file is locked: ${lock}`);
        await sleep(50);
      }
    }
    try {
      return await fn();
    } finally {
      // Only remove the lock if it is still ours.
      const owner = await readFile(lock, 'utf8').catch(() => undefined);
      if (owner === token) await unlink(lock).catch(() => {});
    }
  }

  /**
   * Removes a lock left by a crashed process. The stale lock is first renamed
   * to a unique name, so when two processes race only one of them wins and
   * neither can delete a fresh lock the other just took.
   */
  private async breakStaleLock(lock: string): Promise<boolean> {
    const age = await stat(lock).then((s) => Date.now() - s.mtimeMs, () => 0);
    if (age <= STALE_LOCK_MS) return false;
    const grave = `${lock}.${process.pid}.${randomUUID()}.stale`;
    try {
      await rename(lock, grave);
    } catch {
      return false;
    }
    const stillStale = await stat(grave).then((s) => Date.now() - s.mtimeMs > STALE_LOCK_MS, () => false);
    if (!stillStale) {
      // We grabbed another process's fresh lock; put it back without overwriting
      // a lock someone may have taken since (link fails if the path exists).
      await link(grave, lock).catch(() => {});
      await unlink(grave).catch(() => {});
      return false;
    }
    await unlink(grave).catch(() => {});
    return true;
  }
}
