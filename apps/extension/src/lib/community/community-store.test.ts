import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCommunitySettings } from './community-store';

describe('community settings on Firefox', () => {
  beforeEach(() => {
    vi.stubGlobal('browser', {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
        },
      },
      permissions: {
        getAll: vi.fn().mockResolvedValue({ data_collection: [] }),
      },
      runtime: {
        getManifest: () => ({
          browser_specific_settings: {
            gecko: { data_collection_permissions: { required: ['none'] } },
          },
        }),
      },
    });
  });

  it('starts new Firefox installs in local-only mode before optional data is accepted', async () => {
    await expect(getCommunitySettings()).resolves.toMatchObject({
      enabled: true,
      strength: 'standard',
      autoContribute: false,
    });
  });
});
