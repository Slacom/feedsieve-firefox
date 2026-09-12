import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getFirefoxSidebarAction } from './sidepanel';

describe('Firefox sidebar adapter', () => {
  beforeEach(() => {
    vi.stubGlobal('browser', undefined);
  });

  it('returns no API when Firefox sidebarAction is unavailable', () => {
    expect(getFirefoxSidebarAction()).toBeUndefined();
  });

  it('returns the native sidebarAction API when Firefox exposes it', () => {
    const open = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('browser', { sidebarAction: { open } });

    expect(getFirefoxSidebarAction()?.open).toBe(open);
  });
});
