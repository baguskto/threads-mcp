import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Scheduler } from '../src/scheduler.js';

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
