/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelHost
 */

import { IModelJsNative, NativeLibrary } from "@bentley/imodeljs-native";
import { Logger, ProcessDetector } from "@itwin/core-bentley";

let nativePlatform: typeof IModelJsNative | undefined;

let syncNativeLogLevelsOverride: (() => void) | undefined;

function syncNativeLogLevels() {
  if (syncNativeLogLevelsOverride) {
    syncNativeLogLevelsOverride();
  } else {
    nativePlatform?.clearLogLevelCache();
  }
}

/** Provides access to the internal APIs defined in @bentley/imodeljs-native.
 * @internal
 */
export class IModelNative {
  public static get platform(): typeof IModelJsNative {
    if (undefined === nativePlatform) {
      throw new Error("IModelHost.startup must be called first");
    }

    return nativePlatform;
  }
}

/** @internal Strictly to be called by IModelHost.startup. */
export function loadNativePlatform(): void {
  if (undefined === nativePlatform) {
    nativePlatform = ProcessDetector.isMobileAppBackend ? (process as any)._linkedBinding("iModelJsNative") as typeof IModelJsNative : NativeLibrary.load();
    nativePlatform.logger = Logger;
    Logger.onLogLevelChanged.addListener(() => syncNativeLogLevels());
  }
}

/** @internal Strictly for tests. */
export function overrideSyncNativeLogLevels(func?: () => void): void {
  syncNativeLogLevelsOverride = func;
}
