import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
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
}

export const defaultScheduleFile = () => join(homedir(), '.threads-mcp', 'scheduled-posts.json');

/**
 * The Threads API has no native scheduling, so scheduled posts are kept in a
 * local JSON file and published by a timer while this server is running.
 * Containers are created at publish time because they expire after 24 hours.
 */
export class Scheduler<P = unknown> {
  private posts: ScheduledPost<P>[] = [];
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
    await this.withLock(async () => {
      await this.load();
      this.posts.push(post);
      await this.save();
    });
    return post;
  }

  async list(status?: ScheduledStatus): Promise<ScheduledPost<P>[]> {
    await this.load();
    return this.posts
      .filter((p) => !status || p.status === status)
      .sort((a, b) => a.publish_at.localeCompare(b.publish_at));
  }

  async cancel(id: string): Promise<ScheduledPost<P>> {
    return this.withLock(async () => {
      await this.load();
      const post = this.posts.find((p) => p.id === id);
      if (!post) throw new Error(`No scheduled post with id ${id}`);
      if (post.status !== 'pending') throw new Error(`Scheduled post ${id} is already ${post.status}`);
      post.status = 'cancelled';
      post.updated_at = this.now().toISOString();
      await this.save();
      return post;
    });
  }

  /** Publishes every pending post whose time has come. Returns the posts it processed. */
  async runDue(): Promise<ScheduledPost<P>[]> {
    if (this.running) return [];
    this.running = true;
    try {
      // Claim due posts under the lock so a second server process sharing the
      // same file can't publish them too, then publish outside the lock.
      const claimed = await this.withLock(async () => {
        await this.load();
        const due = this.posts.filter((p) => p.status === 'pending' && Date.parse(p.publish_at) <= this.now().getTime());
        for (const post of due) post.status = 'publishing';
        if (due.length) await this.save();
        return due.map((p) => ({ id: p.id, payload: p.payload }));
      });
      const processed: ScheduledPost<P>[] = [];
      for (const { id, payload } of claimed) {
        let outcome: Pick<ScheduledPost<P>, 'status' | 'result' | 'error'>;
        try {
          outcome = { status: 'published', result: await this.publish(payload) };
        } catch (error) {
          outcome = { status: 'failed', error: describeError(error) };
        }
        await this.withLock(async () => {
          await this.load();
          const post = this.posts.find((p) => p.id === id);
          if (!post) return;
          Object.assign(post, outcome, { updated_at: this.now().toISOString() });
          await this.save();
          processed.push(post);
        });
      }
      return processed;
    } finally {
      this.running = false;
    }
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

  /** Re-reads the file every time so several server processes stay in sync. */
  private async load() {
    try {
      const data = JSON.parse(await readFile(this.file, 'utf8'));
      this.posts = Array.isArray(data?.posts) ? data.posts : [];
    } catch (error: any) {
      if (error?.code !== 'ENOENT') throw error;
      this.posts = [];
    }
  }

  /** Recovers posts left in "publishing" by a crash; they are not re-posted automatically. */
  async recover(): Promise<void> {
    await this.withLock(async () => {
      await this.load();
      const stuck = this.posts.filter((p) => p.status === 'publishing');
      for (const post of stuck) {
        post.status = 'failed';
        post.error = 'Server stopped while publishing; check your profile before rescheduling.';
      }
      if (stuck.length) await this.save();
    });
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const lock = `${this.file}.lock`;
    await mkdir(dirname(this.file), { recursive: true });
    for (let attempt = 0; ; attempt++) {
      try {
        const handle = await open(lock, 'wx');
        await handle.close();
        break;
      } catch (error: any) {
        if (error?.code !== 'EEXIST') throw error;
        // Break locks left behind by a crashed process.
        const age = await stat(lock).then((s) => Date.now() - s.mtimeMs, () => 0);
        if (age > 60_000) await unlink(lock).catch(() => {});
        else if (attempt > 100) throw new Error(`Schedule file is locked: ${lock}`);
        else await new Promise((r) => setTimeout(r, 50));
      }
    }
    try {
      return await fn();
    } finally {
      await unlink(lock).catch(() => {});
    }
  }

  private async save() {
    await mkdir(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify({ version: 1, posts: this.posts }, null, 2), { mode: 0o600 });
    await rename(tmp, this.file);
  }
}
