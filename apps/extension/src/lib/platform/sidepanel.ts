export interface ChromeSidePanelApi {
  open?: (options: { windowId: number }) => Promise<void>;
  close?: (options: { windowId: number }) => Promise<void>;
  setPanelBehavior?: (options: { openPanelOnActionClick: boolean }) => Promise<void>;
  setOptions?: (options: { enabled?: boolean; path?: string; windowId?: number }) => Promise<void>;
}

export interface FirefoxSidebarActionApi {
  open?: () => Promise<void>;
}

/**
 * Safe accessor for chrome.sidePanel API without DOM or React dependencies.
 */
export function getChromeSidePanel(): ChromeSidePanelApi | undefined {
  if (typeof globalThis !== 'undefined') {
    const glob = globalThis as unknown as {
      chrome?: {
        sidePanel?: ChromeSidePanelApi;
      };
    };
    return glob.chrome?.sidePanel;
  }
  return undefined;
}

/**
 * Safe accessor for Firefox's sidebarAction API.
 *
 * WXT's shared browser type follows the Chromium API surface and therefore
 * does not expose sidebarAction. Feature-detect the Firefox-only API at the
 * boundary instead of making the shared React code depend on a browser global.
 */
export function getFirefoxSidebarAction(): FirefoxSidebarActionApi | undefined {
  if (typeof globalThis !== 'undefined') {
    const glob = globalThis as unknown as {
      browser?: {
        sidebarAction?: FirefoxSidebarActionApi;
      };
    };
    return glob.browser?.sidebarAction;
  }
  return undefined;
}
