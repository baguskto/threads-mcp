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
  /** Which server instance is publishing it, so a restart can tell a crash from a peer still at work. */
  claimed_by?: { pid: number; instance: string; at: string };
}

type Outcome<P> = Pick<ScheduledPost<P>, 'status' | 'result' | 'error'>;

export const defaultScheduleFile = () => join(homedir(), '.threads-mcp', 'scheduled-posts.json');

/** A claim older than this is treated as abandoned even if its process id is alive (pids get reused). */
const CLAIM_TIMEOUT_MS = 30 * 60_000;
/**
 * Locks name their owner (pid + server instance). A lock is broken only when
 * that owner is gone and the lock is older than STALE_LOCK_MS, so a live but
 * stalled holder (paused, starved threadpool) never loses it. ABANDONED_LOCK_MS
 * is the fallback for owners we can't check (pid reused by another process).
 */
const STALE_LOCK_MS = 2_000;
const ABANDONED_LOCK_MS = 10 * 60_000;
/** An owner is written right after the lock is created; an empty lock this old was left by a crash in between. */
const EMPTY_LOCK_MS = 30_000;
/** How long to keep trying for the lock before reporting it as busy. */
const LOCK_WAIT_MS = 30_000;

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
  /** Outcomes of finished publishes that could not be written yet; retried before anything new is claimed. */
  private unsaved = new Map<string, Outcome<P>>();
  /** Distinguishes this server from an earlier one that had the same pid (common in containers). */
  private readonly instance = randomUUID();

  constructor(
    private readonly file: string,
    private readonly publish: (payload: P) => Promise<unknown>,
    private readonly now: () => Date = () => new Date(),
    private readonly lockWaitMs = LOCK_WAIT_MS,
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
      // A post that went out must never be left looking unpublished, so first
      // write any outcome a previous run could not save.
      for (const [id, outcome] of [...this.unsaved]) {
        const post = await this.recordOutcome(id, outcome);
        this.unsaved.delete(id);
        if (post) processed.push(post);
      }
      await this.recover();

      for (;;) {
        const claimed = await this.update((posts) => {
          const now = this.now();
          const next = posts
            .filter((p) => p.status === 'pending' && Date.parse(p.publish_at) <= now.getTime())
            .sort((a, b) => a.publish_at.localeCompare(b.publish_at))[0];
          if (!next) return undefined;
          next.status = 'publishing';
          next.claimed_by = { pid: process.pid, instance: this.instance, at: now.toISOString() };
          next.updated_at = now.toISOString();
          return { id: next.id, payload: next.payload };
        });
        if (!claimed) break;

        let outcome: Outcome<P>;
        try {
          outcome = { status: 'published', result: await this.publish(claimed.payload), error: undefined };
        } catch (error) {
          outcome = { status: 'failed', error: describeError(error), result: undefined };
        }
        this.unsaved.set(claimed.id, outcome);
        const post = await this.recordOutcome(claimed.id, outcome);
        this.unsaved.delete(claimed.id);
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
   * gone through before the crash. Runs on every tick, so a peer that dies
   * while this server is running is noticed too.
   */
  async recover(): Promise<void> {
    await this.update((posts) => {
      const now = this.now();
      for (const post of posts) {
        if (post.status !== 'publishing') continue;
        const claim = post.claimed_by;
        const expired = !claim || now.getTime() - Date.parse(claim.at) > CLAIM_TIMEOUT_MS;
        let abandoned: boolean;
        if (expired) abandoned = true;
        else if (claim.instance === this.instance) abandoned = false; // ours: in flight or awaiting save
        else if (claim.pid === process.pid) abandoned = true; // an earlier server that had our pid
        else abandoned = !processAlive(claim.pid);
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
    tick();
    this.timer = setInterval(tick, intervalMs);
    this.timer.unref();
  }

  stop() {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  private recordOutcome(id: string, outcome: Outcome<P>) {
    return this.update((posts) => {
      const post = posts.find((p) => p.id === id);
      if (!post) return undefined;
      Object.assign(post, outcome, { updated_at: this.now().toISOString(), claimed_by: undefined });
      return post;
    });
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
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      data = undefined;
    }
    const posts = (data as { posts?: unknown } | null | undefined)?.posts;
    if (!Array.isArray(posts)) {
      throw new Error(`Schedule file ${this.file} is not in the expected format; fix or move it before scheduling more posts.`);
    }
    return posts as ScheduledPost<P>[];
  }

  private async save(posts: ScheduledPost<P>[], assertHeld: () => Promise<void>) {
    await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
    const tmp = `${this.file}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(tmp, JSON.stringify({ version: 1, posts }, null, 2), { mode: 0o600 });
    try {
      // Never replace the file unless we still own the lock.
      await assertHeld();
      await rename(tmp, this.file);
    } catch (error) {
      await unlink(tmp).catch(() => {});
      throw error;
    }
  }

  /** Loads, lets `fn` change the posts, and saves if anything changed — all under the lock. */
  private async update<T>(fn: (posts: ScheduledPost<P>[]) => T): Promise<T> {
    return this.withLock(async (assertHeld) => {
      const posts = await this.load();
      const before = JSON.stringify(posts);
      const result = fn(posts);
      if (JSON.stringify(posts) !== before) await this.save(posts, assertHeld);
      return result;
    });
  }

  private async withLock<T>(fn: (assertHeld: () => Promise<void>) => Promise<T>): Promise<T> {
    const lock = `${this.file}.lock`;
    const owner = `${process.pid} ${this.instance} ${randomUUID()}`;
    await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
    if (!(await this.acquire(lock, owner, this.lockWaitMs))) throw new Error(`Schedule file is busy (locked by another process): ${lock}`);
    const assertHeld = async () => {
      const current = await readFile(lock, 'utf8').catch(() => undefined);
      if (current !== owner) throw new Error('Lost the schedule file lock; the change was not saved. Try again.');
    };
    try {
      return await fn(assertHeld);
    } finally {
      if ((await readFile(lock, 'utf8').catch(() => undefined)) === owner) await unlink(lock).catch(() => {});
    }
  }

  /** Creates `path` exclusively with `owner` as its content, breaking it only if its owner is gone. */
  private async acquire(path: string, owner: string, waitMs: number): Promise<boolean> {
    const giveUpAt = Date.now() + waitMs;
    for (;;) {
      try {
        const handle = await open(path, 'wx', 0o600);
        try {
          await handle.writeFile(owner);
        } finally {
          await handle.close();
        }
        return true;
      } catch (error: any) {
        if (error?.code !== 'EEXIST') throw error;
        if (await this.breakAbandonedLock(path)) continue;
        if (Date.now() > giveUpAt) return false;
        await sleep(20 + Math.random() * 40); // jitter so waiting processes don't retry in lockstep
      }
    }
  }

  /** Whether the process and server instance named in a lock file are gone. */
  private ownerGone(content: string): boolean {
    const [pidText, instance] = content.split(' ');
    const pid = Number(pidText);
    if (!Number.isInteger(pid) || pid <= 0) return false; // still being written, or unknown: treat as alive
    if (pid === process.pid) return instance !== this.instance; // an earlier server that had our pid
    return !processAlive(pid);
  }

  /**
   * Removes a lock whose owner died. Breakers take turns through a second lock
   * (itself owner-checked), and delete the main lock only if it is still the
   * same file they judged abandoned. A live owner's lock is never removed.
   */
  private async breakAbandonedLock(lock: string): Promise<boolean> {
    // Cheap check first: a lock younger than STALE_LOCK_MS is never broken, so skip reading it.
    const mtimeMs = await stat(lock).then((s) => s.mtimeMs, () => undefined);
    if (mtimeMs === undefined || Date.now() - mtimeMs <= STALE_LOCK_MS) return false;
    const first = await this.lockSnapshot(lock);
    if (!first || !this.abandoned(first)) return false;
    const breaker = `${lock}.break`;
    const breakerOwner = `${process.pid} ${this.instance} ${randomUUID()}`;
    // Taking the break-lock must not wait: if another live breaker holds it, let it finish.
    if (!(await this.acquire(breaker, breakerOwner, 0))) return false;
    try {
      const again = await this.lockSnapshot(lock);
      if (!again || again.content !== first.content || again.mtimeMs !== first.mtimeMs || !this.abandoned(again)) return false;
      await unlink(lock).catch(() => {});
      return true;
    } finally {
      if ((await readFile(breaker, 'utf8').catch(() => undefined)) === breakerOwner) await unlink(breaker).catch(() => {});
    }
  }

  private abandoned({ content, mtimeMs }: { content: string; mtimeMs: number }): boolean {
    const age = Date.now() - mtimeMs;
    if (!content.trim()) return age > EMPTY_LOCK_MS;
    return (age > STALE_LOCK_MS && this.ownerGone(content)) || age > ABANDONED_LOCK_MS;
  }

  private async lockSnapshot(lock: string): Promise<{ content: string; mtimeMs: number } | undefined> {
    try {
      const [s, content] = await Promise.all([stat(lock), readFile(lock, 'utf8')]);
      return { content, mtimeMs: s.mtimeMs };
    } catch {
      return undefined;
    }
  }
}
