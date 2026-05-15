import { describe, expect, test } from 'vitest';
import { getRichTableOverlayHost } from './richTableOverlayHost';

describe('getRichTableOverlayHost', () => {
  test('defaults to document.body when no explicit host is provided', () => {
    expect(getRichTableOverlayHost()).toBe(document.body);
  });

  test('returns the explicit host instead of assuming document.body', () => {
    const host = document.createElement('div');

    expect(getRichTableOverlayHost(host)).toBe(host);
  });
});
