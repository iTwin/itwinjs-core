/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Portability */

import { IModelError, IModelStatus } from "@bentley/imodeljs-common";
import { Logger } from "@bentley/bentleyjs-core";
import { Platform } from "./Platform";
// tslint:disable-next-line:no-var-requires
const semver = require("semver");

let realrequire: any;
try {
  // tslint:disable-next-line:no-eval
  realrequire = eval("require");
} catch (e) { }

/** @hidden */
export class NativePlatformRegistry {
  private static _platform: any;

  /** @hidden */
  public static getNativePlatform(): any {
    if (!NativePlatformRegistry._platform)
      throw new IModelError(IModelStatus.FileNotLoaded, "Node platform not loaded");

    return NativePlatformRegistry._platform;
  }

  /** @hidden */
  public static isNativePlatformLoaded(): boolean { return NativePlatformRegistry._platform !== undefined; }

  /** @hidden */
  public static register(platform: any): void {
    NativePlatformRegistry._platform = platform;

    if (!NativePlatformRegistry._platform)
      return;

    NativePlatformRegistry.checkNativePlatformVersion();
    NativePlatformRegistry._platform.logger = Logger;
  }

  private static checkNativePlatformVersion(): void {
    const platformVer = NativePlatformRegistry._platform.version;
    // tslint:disable-next-line:no-var-requires
    const backendRequiresVersion = require("../package.json").dependencies["@bentley/imodeljs-native-platform-api"];
    if (!semver.satisfies(platformVer, backendRequiresVersion)) {
      NativePlatformRegistry._platform = undefined;
      throw new IModelError(IModelStatus.BadRequest, "Native platform version is (" + platformVer + "). imodeljs-backend requires version (" + backendRequiresVersion + ")");
    }
  }

  /** @hidden */
  public static loadStandardAddon(dir?: string): any | undefined {
    if (typeof (process) === "undefined" || process.version === "")
      throw new Error("could not determine process type");

    return realrequire("@bentley/imodeljs-native-platform-api/loadNativePlatform.js").loadNativePlatform(dir);
  }

  /** @hidden */
  public static loadAndRegisterStandardNativePlatform(dir?: string) {

    if (Platform.imodeljsMobile !== undefined) {
      // We are running in imodeljs (our mobile platform)
      NativePlatformRegistry.register(Platform.imodeljsMobile.imodeljsNative);
      return;
    }

    if (typeof (process) === "undefined") {
      // We are running in an unknown platform.
      throw new IModelError(IModelStatus.NotFound);
    }

    // We are running in node or electron.
    NativePlatformRegistry.register(this.loadStandardAddon(dir));
  }
}
