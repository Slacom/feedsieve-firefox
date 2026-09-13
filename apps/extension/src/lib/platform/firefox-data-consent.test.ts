import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FIREFOX_DATA_COLLECTION_TYPES,
  hasFirefoxDataCollectionConsent,
  requestFirefoxDataCollectionConsent,
  supportsFirefoxDataCollectionConsent,
} from './firefox-data-consent';

describe('Firefox data collection consent', () => {
  const firefoxManifest = {
    browser_specific_settings: {
      gecko: { data_collection_permissions: { required: ['none'] } },
    },
  };

  beforeEach(() => {
    vi.stubGlobal('browser', undefined);
  });

  it('treats browsers without Firefox data consent APIs as compatible', async () => {
    expect(supportsFirefoxDataCollectionConsent()).toBe(false);
    await expect(hasFirefoxDataCollectionConsent()).resolves.toBe(true);
    await expect(requestFirefoxDataCollectionConsent()).resolves.toBe(true);
  });

  it('fails closed when the browser identity cannot be determined', async () => {
    const getManifest = vi.fn(() => {
      throw new Error('manifest unavailable');
    });
    const request = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('browser', {
      runtime: { getManifest },
      permissions: {
        getAll: vi.fn().mockResolvedValue({ data_collection: [...FIREFOX_DATA_COLLECTION_TYPES] }),
        request,
      },
    });

    expect(supportsFirefoxDataCollectionConsent()).toBe(true);
    await expect(hasFirefoxDataCollectionConsent()).resolves.toBe(false);
    await expect(requestFirefoxDataCollectionConsent()).resolves.toBe(false);
    expect(request).not.toHaveBeenCalled();
  });

  it('fails closed when the Firefox runtime omits the data_collection key', async () => {
    const getAll = vi.fn().mockResolvedValue({ permissions: ['storage'] });
    const request = vi.fn();
    vi.stubGlobal('browser', {
      runtime: { getManifest: () => firefoxManifest },
      permissions: { getAll, request },
    });

    await expect(hasFirefoxDataCollectionConsent()).resolves.toBe(false);
    await expect(requestFirefoxDataCollectionConsent()).resolves.toBe(false);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('denies transmission when Firefox exposes consent but not all optional categories are granted', async () => {
    const getAll = vi.fn().mockResolvedValue({ data_collection: ['websiteContent'] });
    vi.stubGlobal('browser', {
      runtime: { getManifest: () => firefoxManifest },
      permissions: { getAll, request: vi.fn() },
    });

    await expect(hasFirefoxDataCollectionConsent()).resolves.toBe(false);
  });

  it('requests all declared categories from a user gesture and verifies the resulting grant', async () => {
    const getAll = vi
      .fn()
      .mockResolvedValueOnce({ data_collection: [...FIREFOX_DATA_COLLECTION_TYPES] });
    const request = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('browser', {
      runtime: { getManifest: () => firefoxManifest },
      permissions: { getAll, request },
    });

    await expect(requestFirefoxDataCollectionConsent()).resolves.toBe(true);
    expect(request).toHaveBeenCalledWith({
      data_collection: [...FIREFOX_DATA_COLLECTION_TYPES],
    });
  });

  it('fails closed when the user rejects the optional data request', async () => {
    const getAll = vi.fn().mockResolvedValue({ data_collection: [] });
    const request = vi.fn().mockResolvedValue(false);
    vi.stubGlobal('browser', {
      runtime: { getManifest: () => firefoxManifest },
      permissions: { getAll, request },
    });

    await expect(requestFirefoxDataCollectionConsent()).resolves.toBe(false);
  });
});
