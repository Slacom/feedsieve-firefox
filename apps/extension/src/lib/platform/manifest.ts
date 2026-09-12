export interface ExtensionManifestOptions {
  browser: string;
  mode: string;
  manifestVersion: 2 | 3;
}

export interface ExtensionManifest {
  name: string;
  short_name: string;
  description: string;
  permissions: string[];
  host_permissions: string[];
  icons: Record<number, string>;
  side_panel?: { default_path: string };
  sidebar_action?: {
    default_panel: string;
    default_title: string;
    default_icon: Record<string, string>;
    open_at_install: boolean;
  };
  browser_specific_settings?: {
    gecko: {
      id: string;
      strict_min_version: string;
      data_collection_permissions: {
        required: string[];
        optional: string[];
      };
    };
  };
}

const ICONS = {
  16: '/icon-16.png',
  32: '/icon-32.png',
  48: '/icon-48.png',
  64: '/icon.png',
  128: '/icon-128.png',
} as const;

const COMMUNITY_API_HOST = 'https://api.feedsieve.win/*';

/**
 * Build the browser-specific portion of the extension manifest.
 *
 * The application code is shared between browsers, but Chrome's sidePanel
 * and Firefox's sidebar_action are different manifest/API surfaces. Keeping
 * that difference here prevents a Chrome-only permission from leaking into
 * the Firefox package.
 */
export function buildExtensionManifest({
  browser,
  mode,
}: ExtensionManifestOptions): ExtensionManifest {
  const isFirefox = browser === 'firefox';
  const hostPermissions = [
    'https://x.com/*',
    ...(mode === 'development' ? ['http://localhost/*'] : []),
    COMMUNITY_API_HOST,
  ];

  const base = {
    short_name: 'FeedSieve',
    description: 'X 赛博清洁工：黄框标注垃圾账号，一键批量真拉黑。标注永不隐藏内容。',
    host_permissions: hostPermissions,
    icons: ICONS,
  };

  if (isFirefox) {
    return {
      ...base,
      name: 'FeedSieve Firefox',
      permissions: ['storage'],
      sidebar_action: {
        default_panel: 'popup.html',
        default_title: 'FeedSieve Firefox',
        default_icon: {
          '16': ICONS[16],
          '32': ICONS[32],
          '48': ICONS[48],
        },
        open_at_install: false,
      },
      browser_specific_settings: {
        gecko: {
          id: '@feedsieve-firefox',
          strict_min_version: '140.0',
          data_collection_permissions: {
            // The core detector and blocker work locally. Community uploads
            // remain opt-out at runtime, so Firefox can keep installation
            // usable when the user declines optional data transmission.
            required: ['none'],
            optional: [
              'personallyIdentifyingInfo',
              'technicalAndInteraction',
              'websiteActivity',
              'websiteContent',
            ],
          },
        },
      },
    };
  }

  return {
    ...base,
    name: 'FeedSieve',
    permissions: ['storage', 'sidePanel'],
    side_panel: {
      default_path: 'popup.html',
    },
  };
}
