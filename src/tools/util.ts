import type { CallToolResult } from '@modelcontextprotocol/server';
import { describeError } from '../threads/errors.js';

/** Wraps a JSON-serialisable value as an MCP tool result. */
export function ok(value: unknown): CallToolResult {
  const result: CallToolResult = {
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
  };
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    result.structuredContent = value as Record<string, unknown>;
  }
  return result;
}

export function fail(error: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: `Error: ${describeError(error)}` }],
    isError: true,
  };
}

/**
 * Runs a tool body and converts thrown errors into `isError` results, so the
 * model sees the Threads error message instead of a protocol failure.
 */
export function handler<A>(fn: (args: A) => Promise<unknown>): (args: A) => Promise<CallToolResult> {
  return async (args: A) => {
    try {
      return ok(await fn(args));
    } catch (error) {
      return fail(error);
    }
  };
}

/** Converts an ISO 8601 date or Unix timestamp to Unix seconds, as Threads expects. */
export function toUnixSeconds(value: string | number | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value === 'number') return value > 1e12 ? Math.floor(value / 1000) : Math.floor(value);
  if (/^\d+$/.test(value)) return toUnixSeconds(Number(value));
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) throw new Error(`Invalid date: ${value}`);
  return Math.floor(ms / 1000);
}

export const fieldsParam = (fields: string[] | undefined, fallback: readonly string[]) =>
  (fields?.length ? fields : fallback).join(',');
