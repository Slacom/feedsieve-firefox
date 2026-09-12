import { describe, expect, it } from 'vitest';
import { buildExtensionManifest } from './manifest';

describe('extension manifest targets', () => {
  it('uses Firefox sidebar_action without Chrome-only sidePanel permissions', () => {
    const manifest = buildExtensionManifest({
      browser: 'firefox',
      mode: 'production',
      manifestVersion: 3,
    });

    expect(manifest.permissions).toEqual(['storage']);
    expect(manifest).not.toHaveProperty('side_panel');
    expect(manifest.sidebar_action).toEqual({
      default_panel: 'popup.html',
      default_title: 'FeedSieve Firefox',
      default_icon: {
        '16': '/icon-16.png',
        '32': '/icon-32.png',
        '48': '/icon-48.png',
      },
      open_at_install: false,
    });
    expect(manifest.browser_specific_settings).toEqual({
      gecko: {
        id: '@feedsieve-firefox',
        strict_min_version: '140.0',
        data_collection_permissions: {
          required: ['none'],
          optional: [
            'personallyIdentifyingInfo',
            'technicalAndInteraction',
            'websiteActivity',
            'websiteContent',
          ],
        },
      },
    });
  });

  it('keeps host permissions aligned with the runtime community API', () => {
    const manifest = buildExtensionManifest({
      browser: 'firefox',
      mode: 'production',
      manifestVersion: 3,
    });

    expect(manifest.host_permissions).toEqual(['https://x.com/*', 'https://api.feedsieve.win/*']);
  });

  it('keeps the Chrome side panel target unchanged and adds localhost only in development', () => {
    const manifest = buildExtensionManifest({
      browser: 'chrome',
      mode: 'development',
      manifestVersion: 3,
    });

    expect(manifest.permissions).toEqual(['storage', 'sidePanel']);
    expect(manifest.side_panel).toEqual({ default_path: 'popup.html' });
    expect(manifest).not.toHaveProperty('sidebar_action');
    expect(manifest).not.toHaveProperty('browser_specific_settings');
    expect(manifest.host_permissions).toEqual([
      'https://x.com/*',
      'http://localhost/*',
      'https://api.feedsieve.win/*',
    ]);
  });
});
