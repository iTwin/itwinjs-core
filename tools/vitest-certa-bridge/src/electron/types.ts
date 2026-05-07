/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

/**
 * Options passed to the custom Vitest BrowserProvider for Electron.
 * @beta
 */
export interface ElectronBrowserProviderOptions {
  /** Absolute path to the backend init module loaded in the Electron main process before opening the Vitest page. */
  backendInitModule?: string;
  /** Absolute path to a consumer preload module. The provider wraps it with bridge callback exposure. */
  preloadModule?: string;
  /** Extra environment variables to pass to the Electron process. */
  env?: Record<string, string>;
  /** Extra command-line arguments passed to the Electron binary. */
  electronArgs?: string[];
  /** Timeout in milliseconds for provider startup and Electron session lifetime. */
  timeout?: number;
}
