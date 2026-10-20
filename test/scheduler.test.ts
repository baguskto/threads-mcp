import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hostTag, Scheduler } from '../src/scheduler.js';

async function withScheduler(fn: (ctx: { file: string; clock: { now: Date }; published: string[]; make: (fail?: boolean) => Scheduler<{ text: string }> }) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'threads-mcp-'));
  const file = join(dir, 'schedule.json');
  const clock = { now: new Date('2026-01-01T00:00:00Z') };
  const published: string[] = [];
  const make = (fail = false) =>
    new Scheduler<{ text: string }>(
      file,
      async ({ text }) => {
        if (fail) throw new Error('nope');
        published.push(text);
        return { id: `m-${text}` };
      },
      () => clock.now,
    );
  try {
    await fn({ file, clock, published, make });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('publishes posts once they are due and persists the result', () =>
  withScheduler(async ({ file, clock, published, make }) => {
    const scheduler = make();
    await scheduler.add({ text: 'later' }, new Date('2026-01-01T02:00:00Z'));
    await scheduler.add({ text: 'soon' }, new Date('2026-01-01T01:00:00Z'));

    assert.deepEqual(await scheduler.runDue(), []);
    clock.now = new Date('2026-01-01T01:30:00Z');
    const done = await scheduler.runDue();
    assert.deepEqual(published, ['soon']);
    assert.equal(done[0].status, 'published');
    assert.deepEqual(done[0].result, { id: 'm-soon' });

    // A second instance sharing the file sees the same state and doesn't re-publish.
    const other = make();
    assert.deepEqual(await other.runDue(), []);
    const saved = JSON.parse(await readFile(file, 'utf8'));
    assert.deepEqual(saved.posts.map((p: any) => p.status).sort(), ['pending', 'published']);
  }));

test('rejects past times and supports cancelling', () =>
  withScheduler(async ({ clock, published, make }) => {
    const scheduler = make();
    await assert.rejects(scheduler.add({ text: 'x' }, new Date('2025-12-31T00:00:00Z')), /future/);
    const post = await scheduler.add({ text: 'x' }, new Date('2026-01-02T00:00:00Z'));
    await scheduler.cancel(post.id);
    await assert.rejects(scheduler.cancel(post.id), /already cancelled/);
    clock.now = new Date('2026-01-03T00:00:00Z');
    await scheduler.runDue();
    assert.deepEqual(published, []);
    assert.equal((await scheduler.list('cancelled')).length, 1);
  }));

test('records failures without throwing', () =>
  withScheduler(async ({ clock, make }) => {
    const scheduler = make(true);
    await scheduler.add({ text: 'x' }, new Date('2026-01-01T00:10:00Z'));
    clock.now = new Date('2026-01-01T00:20:00Z');
    const [post] = await scheduler.runDue();
    assert.equal(post.status, 'failed');
    assert.equal(post.error, 'nope');
  }));

test('concurrent list() calls cannot undo a cancel or an add', () =>
  withScheduler(async ({ make, file }) => {
    const scheduler = make();
    const post = await scheduler.add({ text: 'x' }, new Date('2026-01-02T00:00:00Z'));
    await Promise.all([
      scheduler.cancel(post.id),
      scheduler.list(),
      scheduler.list(),
      scheduler.add({ text: 'y' }, new Date('2026-01-03T00:00:00Z')),
      scheduler.list(),
    ]);
    const saved = JSON.parse(await readFile(file, 'utf8')).posts;
    assert.deepEqual(saved.map((p: any) => p.status).sort(), ['cancelled', 'pending']);
  }));

test('due posts are claimed one at a time, earliest first', () =>
  withScheduler(async ({ clock, file }) => {
    const order: string[] = [];
    const scheduler: Scheduler<{ text: string }> = new Scheduler(
      file,
      async ({ text }) => {
        order.push(text);
        const statuses = (await scheduler.list()).map((p) => `${p.payload.text}:${p.status}`);
        // While one post is publishing the others are still pending, so a crash can't strand them.
        assert.equal(statuses.filter((s) => s.endsWith(':publishing')).length, 1);
        return {};
      },
      () => clock.now,
    );
    await scheduler.add({ text: 'b' }, new Date('2026-01-01T02:00:00Z'));
    await scheduler.add({ text: 'a' }, new Date('2026-01-01T01:00:00Z'));
    clock.now = new Date('2026-01-01T03:00:00Z');
    await scheduler.runDue();
    assert.deepEqual(order, ['a', 'b']);
  }));

test('recover() only fails posts whose publishing process is gone', () =>
  withScheduler(async ({ file, make }) => {
    const now = new Date('2026-01-01T00:00:00Z').toISOString();
    const post = (id: string, pid: number) => ({
      id,
      publish_at: now,
      created_at: now,
      status: 'publishing',
      payload: { text: id },
      claimed_by: { pid, instance: 'other-instance', host: hostTag(), at: now },
    });
    // The parent (test runner) is alive; a claim with our own pid but another instance id is an earlier, dead server.
    await writeFile(
      file,
      JSON.stringify({ version: 1, posts: [post('alive', process.ppid), post('dead', 2 ** 22 + 12345), post('reused-pid', process.pid)] }),
    );
    await make().recover();
    const saved = JSON.parse(await readFile(file, 'utf8')).posts;
    assert.equal(saved.find((p: any) => p.id === 'alive').status, 'publishing');
    assert.equal(saved.find((p: any) => p.id === 'dead').status, 'failed');
    assert.equal(saved.find((p: any) => p.id === 'reused-pid').status, 'failed');
  }));

test('a lock left by a crashed process is broken', () =>
  withScheduler(async ({ file, make }) => {
    await writeFile(`${file}.lock`, `${2 ** 22 + 12345} dead-instance token ${hostTag()}`);
    const old = new Date(Date.now() - 60_000);
    await utimes(`${file}.lock`, old, old);
    const post = await make().add({ text: 'x' }, new Date('2026-01-02T00:00:00Z'));
    assert.equal(post.status, 'pending');
    await assert.rejects(stat(`${file}.lock`), /ENOENT/);
  }));

test('a lock held by a live (even stalled) process is never broken', () =>
  withScheduler(async ({ file, clock }) => {
    // The test runner's parent process is alive; pretend it has held the lock for 5 minutes.
    await writeFile(`${file}.lock`, `${process.ppid} other-instance token ${hostTag()}`);
    const old = new Date(Date.now() - 5 * 60_000);
    await utimes(`${file}.lock`, old, old);
    const scheduler = new Scheduler<{ text: string }>(file, async () => ({}), () => clock.now, 300);
    await assert.rejects(scheduler.add({ text: 'x' }, new Date('2026-01-02T00:00:00Z')), /busy/);
    assert.equal(await readFile(`${file}.lock`, 'utf8'), `${process.ppid} other-instance token ${hostTag()}`);
  }));

test('an earlier server with the same pid counts as gone', () =>
  withScheduler(async ({ file, make }) => {
    await writeFile(`${file}.lock`, `${process.pid} previous-instance token ${hostTag()}`);
    const old = new Date(Date.now() - 60_000);
    await utimes(`${file}.lock`, old, old);
    assert.equal((await make().add({ text: 'x' }, new Date('2026-01-02T00:00:00Z'))).status, 'pending');
  }));

test('a write is refused if the lock was lost in the meantime', () =>
  withScheduler(async ({ file, make }) => {
    const scheduler = make();
    await scheduler.add({ text: 'a' }, new Date('2026-01-02T00:00:00Z'));
    // Simulate another process taking over the lock right before our save.
    const original = (scheduler as any).load.bind(scheduler);
    (scheduler as any).load = async () => {
      const posts = await original();
      await writeFile(`${file}.lock`, 'someone else');
      return posts;
    };
    await assert.rejects(scheduler.add({ text: 'b' }, new Date('2026-01-03T00:00:00Z')), /Lost the schedule file lock/);
    (scheduler as any).load = original;
    await writeFile(`${file}.lock`, '');
    const { unlink } = await import('node:fs/promises');
    await unlink(`${file}.lock`);
    assert.deepEqual((await scheduler.list()).map((p) => p.payload.text), ['a']);
  }));

test('a corrupt schedule file is reported instead of being overwritten', () =>
  withScheduler(async ({ file, make }) => {
    await writeFile(file, '{not json');
    await assert.rejects(make().add({ text: 'x' }, new Date('2026-01-02T00:00:00Z')), /not in the expected format/);
    assert.equal(await readFile(file, 'utf8'), '{not json');
  }));

test('valid JSON of the wrong shape is not overwritten either', () =>
  withScheduler(async ({ file, make }) => {
    for (const content of ['[{"id":"keep-me"}]', '{"version":1,"posts":{"0":{}}}', 'null']) {
      await writeFile(file, content);
      await assert.rejects(make().add({ text: 'x' }, new Date('2026-01-02T00:00:00Z')), /expected format/);
      assert.equal(await readFile(file, 'utf8'), content);
    }
  }));

test('an outcome that could not be saved is written on the next run, before anything new is claimed', () =>
  withScheduler(async ({ file, clock, published, make }) => {
    const scheduler = make();
    await scheduler.add({ text: 'a' }, new Date('2026-01-01T00:10:00Z'));
    clock.now = new Date('2026-01-01T00:20:00Z');
    // Simulate the outcome write failing once (e.g. the file stayed locked).
    const original = (scheduler as any).recordOutcome.bind(scheduler);
    let failOnce = true;
    (scheduler as any).recordOutcome = async (...args: any[]) => {
      if (failOnce) {
        failOnce = false;
        throw new Error('Schedule file is locked');
      }
      return original(...args);
    };
    await assert.rejects(scheduler.runDue(), /locked/);
    assert.deepEqual(published, ['a']);
    // Still ours and unsaved, so recovery must not mark it failed.
    await scheduler.recover();
    assert.equal(JSON.parse(await readFile(file, 'utf8')).posts[0].status, 'publishing');
    const [post] = await scheduler.runDue();
    assert.equal(post.status, 'published');
    assert.deepEqual(published, ['a'], 'not published twice');
  }));

test('an empty lock (crash between create and write) is broken after a while', () =>
  withScheduler(async ({ file, make }) => {
    await writeFile(`${file}.lock`, '');
    const old = new Date(Date.now() - 60_000);
    await utimes(`${file}.lock`, old, old);
    assert.equal((await make().add({ text: 'x' }, new Date('2026-01-02T00:00:00Z'))).status, 'pending');
  }));

test('a lock or claim from another host or container is never judged by its pid', () =>
  withScheduler(async ({ file, clock }) => {
    // A dead-looking pid (or our own pid) means nothing when it comes from another pid namespace.
    for (const pid of [2 ** 22 + 12345, process.pid]) {
      await writeFile(`${file}.lock`, `${pid} peer-instance token other-container|pid:[1]`);
      const old = new Date(Date.now() - 60_000);
      await utimes(`${file}.lock`, old, old);
      const scheduler = new Scheduler<{ text: string }>(file, async () => ({}), () => clock.now, 300);
      await assert.rejects(scheduler.add({ text: 'x' }, new Date('2026-01-02T00:00:00Z')), /busy/);
    }
    const { unlink } = await import('node:fs/promises');
    await unlink(`${file}.lock`);
    const now = clock.now.toISOString();
    await writeFile(
      file,
      JSON.stringify({
        version: 1,
        posts: [{ id: 'p', publish_at: now, created_at: now, status: 'publishing', payload: { text: 'p' },
          claimed_by: { pid: process.pid, instance: 'peer', host: 'other-container|pid:[1]', at: now } }],
      }),
    );
    await new Scheduler<{ text: string }>(file, async () => ({}), () => clock.now).recover();
    assert.equal(JSON.parse(await readFile(file, 'utf8')).posts[0].status, 'publishing');
  }));
