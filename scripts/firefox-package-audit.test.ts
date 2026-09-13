import { describe, expect, it } from 'vitest';
import { isUnsafeArchivePath } from './firefox-package-audit.mjs';

describe('Firefox package archive audit', () => {
  it('rejects sensitive paths and traversal entries', () => {
    expect(isUnsafeArchivePath('.env')).toBe(true);
    expect(isUnsafeArchivePath('nested/.secrets/signing-key')).toBe(true);
    expect(isUnsafeArchivePath('../manifest.json')).toBe(true);
    expect(isUnsafeArchivePath('nested\\manifest.json')).toBe(true);
  });

  it('accepts ordinary runtime and source paths', () => {
    expect(isUnsafeArchivePath('manifest.json')).toBe(false);
    expect(isUnsafeArchivePath('content-scripts/content.js')).toBe(false);
    expect(isUnsafeArchivePath('src/lib/platform/manifest.ts')).toBe(false);
  });
});
