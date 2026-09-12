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

function isFirefoxBuild(): boolean {
  if (typeof globalThis === 'undefined') return false;
  const runtime = (
    globalThis as unknown as {
      browser?: {
        runtime?: {
          getManifest?: () => unknown;
        };
      };
    }
  ).browser?.runtime;
  try {
    const manifest = runtime?.getManifest?.() as
      | {
          browser_specific_settings?: {
            gecko?: { data_collection_permissions?: unknown };
          };
        }
      | undefined;
    return manifest?.browser_specific_settings?.gecko?.data_collection_permissions !== undefined;
  } catch {
    return false;
  }
}

function getFirefoxPermissionsApi(): FirefoxPermissionsApi | undefined {
  if (!isFirefoxBuild() || typeof globalThis === 'undefined') return undefined;
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
  // Use the manifest marker rather than only API presence so a Firefox
  // permission API failure still defaults the UI to local-only mode.
  return isFirefoxBuild();
}

/**
 * Check whether all categories used by community transmission are granted.
 * The Firefox build is identified by its manifest marker; if the runtime then
 * omits `data_collection`, fail closed rather than treating an unknown consent
 * state as permission to transmit.
 */
export async function hasFirefoxDataCollectionConsent(): Promise<boolean> {
  if (!isFirefoxBuild()) return true;
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
  if (!isFirefoxBuild()) return true;
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
