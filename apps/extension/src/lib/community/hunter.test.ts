// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bindHunterEmail,
  fetchHunterBoard,
  fetchHunterProfile,
  openLeaderboard,
  saveHunterProfile,
  verifyHunterEmail,
} from './hunter';
import { FIREFOX_DATA_COLLECTION_TYPES } from '../platform/firefox-data-consent';

let storage: Record<string, unknown>;
let fetchMock: ReturnType<typeof vi.fn>;
let tabCreate: ReturnType<typeof vi.fn>;

const firefoxManifest = {
  browser_specific_settings: {
    gecko: { data_collection_permissions: { required: ['none'] } },
  },
};

beforeEach(() => {
  storage = {
    installationId: 'install-0123456789',
  };
  fetchMock = vi.fn();
  tabCreate = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('browser', {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: storage[key] })),
        set: vi.fn(async (patch: Record<string, unknown>) => Object.assign(storage, patch)),
        remove: vi.fn(async (keys: string | string[]) => {
          for (const key of Array.isArray(keys) ? keys : [keys]) delete storage[key];
        }),
      },
    },
    permissions: {
      getAll: vi.fn().mockResolvedValue({ data_collection: [] }),
      request: vi.fn().mockResolvedValue(false),
    },
    runtime: { getManifest: () => firefoxManifest },
    tabs: { create: tabCreate },
  });
});

describe('hunter data consent boundary', () => {
  it('loads only the public board without sending an installation ID', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ rows: [], total: 0, me: null }), { status: 200 }),
    );

    await expect(fetchHunterBoard()).resolves.toEqual({ rows: [], total: 0, me: null });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({});
  });

  it('does not fetch a personal profile without consent', async () => {
    await expect(fetchHunterProfile()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('blocks profile, email, and verification writes without consent', async () => {
    await expect(saveHunterProfile('name', 'bio', 'handle')).resolves.toEqual({
      ok: false,
      error: 'consent_required',
    });
    await expect(bindHunterEmail('name@example.com')).resolves.toEqual({
      ok: false,
      error: 'consent_required',
    });
    await expect(verifyHunterEmail('name@example.com', '123456')).resolves.toEqual({
      ok: false,
      error: 'consent_required',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('removes the personal me prefix when opening the public leaderboard without consent', async () => {
    await openLeaderboard('abcdef123456');

    expect(tabCreate).toHaveBeenCalledWith({ url: 'https://api.feedsieve.win/leaderboard' });
  });

  it('sends the installation ID only after all declared categories are granted', async () => {
    const getAll = vi.fn().mockResolvedValue({
      data_collection: [...FIREFOX_DATA_COLLECTION_TYPES],
    });
    const currentBrowser = (globalThis as unknown as { browser: Record<string, unknown> }).browser;
    vi.stubGlobal('browser', {
      ...currentBrowser,
      permissions: { getAll, request: vi.fn() },
    });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ rows: [], total: 0, me: null }), { status: 200 }),
    );

    await fetchHunterBoard();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      installation_id: 'install-0123456789',
    });
  });
});
