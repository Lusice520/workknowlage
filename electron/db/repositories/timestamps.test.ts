/// <reference types="node" />
// @vitest-environment node

import { createRequire } from 'node:module';
import { expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const { formatLocalTimestampLabel } = require('./timestamps.cjs');

test('formats SQLite datetime strings as local time labels', () => {
  expect(formatLocalTimestampLabel('2026-05-18 08:28:11', {
    locale: 'zh-CN',
    timeZone: 'Asia/Shanghai',
  })).toBe('2026年5月18日 16:28');
});

test('falls back to the original value when a timestamp cannot be parsed', () => {
  expect(formatLocalTimestampLabel('not-a-time')).toBe('not-a-time');
});
