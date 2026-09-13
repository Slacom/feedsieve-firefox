/**
 * Data categories declared in the Firefox manifest for optional community
 * uploads. The local detector and X actions do not require these categories.
 */
export const FIREFOX_DATA_COLLECTION_TYPES = [
  'personallyIdentifyingInfo',
  'technicalAndInteraction',
  'websiteActivity',
  'websiteContent',
] as const;

type FirefoxDataCollectionType = (typeof FIREFOX_DATA_COLLECTION_TYPES)[number];

interface PermissionSnapshot {
  data_collection?: unknown;
}

interface FirefoxPermissionsApi {
  getAll: () => Promise<PermissionSnapshot>;
  request?: (details: { data_collection: FirefoxDataCollectionType[] }) => Promise<boolean>;
}

type BrowserIdentity = 'firefox' | 'other' | 'unknown';

function browserIdentity(): BrowserIdentity {
  if (typeof globalThis === 'undefined') return 'other';
  const browserApi = (globalThis as unknown as {
    browser?: {
      runtime?: {
        getManifest?: () => unknown;
      };
    };
  }).browser;
  if (!browserApi) return 'other';
  const runtime = browserApi.runtime;
  if (typeof runtime?.getManifest !== 'function') return 'unknown';
  try {
    const manifest = runtime.getManifest() as
      | {
          browser_specific_settings?: {
            gecko?: { data_collection_permissions?: unknown };
          };
        }
      | undefined;
    if (!manifest || typeof manifest !== 'object') return 'unknown';
    return manifest.browser_specific_settings?.gecko?.data_collection_permissions !== undefined
      ? 'firefox'
      : 'other';
  } catch {
    return 'unknown';
  }
}

function getFirefoxPermissionsApi(): FirefoxPermissionsApi | undefined {
  if (browserIdentity() !== 'firefox' || typeof globalThis === 'undefined') return undefined;
  const permissions = (
    globalThis as unknown as {
      browser?: { permissions?: Partial<FirefoxPermissionsApi> };
    }
  ).browser?.permissions;
  if (typeof permissions?.getAll !== 'function') return undefined;
  return {
    getAll: permissions.getAll.bind(permissions),
    request:
      typeof permissions.request === 'function' ? permissions.request.bind(permissions) : undefined,
  };
}

function hasDataCollectionField(value: PermissionSnapshot): boolean {
  return Object.prototype.hasOwnProperty.call(value, 'data_collection');
}

function grantsAllDeclaredCategories(value: PermissionSnapshot): boolean {
  const granted = value.data_collection;
  return (
    Array.isArray(granted) &&
    FIREFOX_DATA_COLLECTION_TYPES.every((category) => granted.includes(category))
  );
}

/** True when the current Firefox build exposes the optional consent surface. */
export function supportsFirefoxDataCollectionConsent(): boolean {
  // Unknown browser identity must be treated like Firefox here so a failed
  // runtime probe defaults the UI to local-only mode instead of allowing an
  // upload before consent can be established.
  return browserIdentity() !== 'other';
}

/**
 * Check whether all categories used by community transmission are granted.
 * The Firefox build is identified by its manifest marker; if the runtime then
 * omits `data_collection`, fail closed rather than treating an unknown consent
 * state as permission to transmit.
 */
export async function hasFirefoxDataCollectionConsent(): Promise<boolean> {
  const identity = browserIdentity();
  if (identity === 'other') return true;
  if (identity === 'unknown') return false;
  const api = getFirefoxPermissionsApi();
  if (!api) return false;
  try {
    const permissions = await api.getAll();
    if (!hasDataCollectionField(permissions)) return false;
    return grantsAllDeclaredCategories(permissions);
  } catch {
    // A consent-state read failure must never turn into an upload.
    return false;
  }
}

/**
 * Ask the user to opt into the optional community transmission categories.
 * This function must be called directly from a user-activated handler: Firefox
 * requires permissions.request() to remain in that activation chain.
 */
export async function requestFirefoxDataCollectionConsent(): Promise<boolean> {
  const identity = browserIdentity();
  if (identity === 'other') return true;
  if (identity === 'unknown') return false;
  const api = getFirefoxPermissionsApi();
  if (!api?.request) return false;
  try {
    const accepted = await api.request({
      data_collection: [...FIREFOX_DATA_COLLECTION_TYPES],
    });
    if (!accepted) return false;
    return hasFirefoxDataCollectionConsent();
  } catch {
    return false;
  }
}
