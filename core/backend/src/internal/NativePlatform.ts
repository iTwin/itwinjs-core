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

class NativePlatformModule {
  public get NativePlatform(): typeof IModelJsNative {
    if (undefined === nativePlatform) {
      throw new Error("IModelHost.startup must be called first");
    }

    return nativePlatform;
  }

  // Strictly to be called by IModelHost.startup.
  public loadNativePlatform(): void {
    if (undefined === nativePlatform) {
      nativePlatform = ProcessDetector.isMobileAppBackend ? (process as any)._linkedBinding("iModelJsNative") as typeof IModelJsNative : NativeLibrary.load();
      nativePlatform.logger = Logger;
      Logger.onLogLevelChanged.addListener(() => syncNativeLogLevels());
    }
  }

  // Strictly for tests.
  public overrideSyncNativeLogLevels(func?: () => void): void {
    syncNativeLogLevelsOverride = func;
  }
}

const nativePlatformModule = new NativePlatformModule();
export = nativePlatformModule;
