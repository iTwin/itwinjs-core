/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Portability */

import { IModelError, IModelStatus } from "@bentley/imodeljs-common";
import { Logger } from "@bentley/bentleyjs-core";
import { Platform } from "./Platform";
import * as path from "path";
import { IModelJsFs } from "./IModelJsFs";

let realrequire: any;
try {
  // tslint:disable-next-line:no-eval
  realrequire = eval("require");
} catch (e) { }

/** Internal class to manage the native code behind imodeljs-backend -- *rarely used by apps* -- See [[IModelHost]].
 */
export class NativePlatformRegistry {
  private static _platform: any;

  /** @hidden */
  public static getNativePlatform(): any {
    if (!NativePlatformRegistry._platform)
      throw new IModelError(IModelStatus.FileNotLoaded, "Node platform not loaded");

    return NativePlatformRegistry._platform;
  }

  /** @hidden */
  public static isNativePlatformLoaded(): boolean {
    return NativePlatformRegistry._platform !== undefined;
  }

  /** @hidden */
  public static register(platform: any): void {
    NativePlatformRegistry._platform = platform;

    if (!NativePlatformRegistry._platform)
      return;

    NativePlatformRegistry.checkNativePlatformVersion();

    NativePlatformRegistry._platform.logger = Logger;
  }

  private static parseSemVer(str: string): number[] {
    const c = str.split(".");
    return [parseInt(c[0], 10), parseInt(c[1], 10), parseInt(c[2], 10)];
  }

  private static checkNativePlatformVersion(): void {
    const platformVer = NativePlatformRegistry._platform.version;
    // tslint:disable-next-line:no-var-requires
    const iWasBuiltWithVer = require("@bentley/imodeljs-native-platform-api/package.json").version;

    const platformVerDigits = NativePlatformRegistry.parseSemVer(platformVer);
    const iWasBuiltWithVerDigits = NativePlatformRegistry.parseSemVer(iWasBuiltWithVer);

    if ((platformVerDigits[0] !== iWasBuiltWithVerDigits[0]) || (platformVerDigits[1] < iWasBuiltWithVerDigits[1])) {
      NativePlatformRegistry._platform = undefined;
      throw new IModelError(IModelStatus.BadRequest, "Native platform version is (" + platformVer + "). imodeljs-backend requires version (" + iWasBuiltWithVer + ")");
    }
  }

  /** @hidden */
  public static loadStandardAddon(dir?: string): any | undefined {
    if (typeof (process) === "undefined" || process.version === "")
      throw new Error("could not determine process type");

    const addonPackageName = NodeAddonPackageName.computeDefaultImodelNodeAddonPackageName();

    const addonFileName = path.join(dir || "", addonPackageName, "addon", "imodeljs.node");

    return realrequire(addonFileName);
  }

  /** Internal method to load and register the standard platform -- *rarely used by apps* -- See [[IModelHost]]. */
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

  /** @hidden */
  public static loadAndRegisterStandardNativePlatformFromTools() {
    let nativePlatformDir: string | undefined;
    if (!Platform.isMobile()) {
      let toolsDir = __dirname;
      while (!IModelJsFs.existsSync(path.join(toolsDir, "tools")))
        toolsDir = path.join(toolsDir, "..");
      nativePlatformDir = path.join(toolsDir, "tools", "native-platform-installer", "node_modules");
    }
    NativePlatformRegistry.loadAndRegisterStandardNativePlatform(nativePlatformDir);
  }
}

/** Internal utility to compute the native package for the current environment -- *rarely used by apps* -- See [[IModelHost]]. */
class NodeAddonPackageName {

  /** @hidden */
  public static computeDefaultImodelNodeAddonPackageName(): string {

    // *** KEEP THIS CONSISTENT WITH iModelJsNodeAddon/MakePackages.py IN MERCURIAL ***

    if (typeof (process) === "undefined" || process.version === "")
      throw new IModelError(IModelStatus.BadRequest, "Could not determine process type");

    let versionCode;
    const electronVersion = (process.versions as any).electron;
    if (typeof electronVersion !== "undefined") {
      const electronVersionParts = electronVersion.split(".");
      versionCode = "e_" + electronVersionParts[0]; // use only major version number
    } else {
      const nodeVersion = process.version.substring(1).split("."); // strip off the character 'v' from the start of the string
      versionCode = "n_" + nodeVersion[0]; // use only major version number
    }
    return path.join("@bentley", "imodeljs-" + versionCode + "-" + process.platform + "-" + process.arch);
  }

  /** @hidden */
  public static computeDefaultImodelNodeAddonName(): string {
    return path.join(NodeAddonPackageName.computeDefaultImodelNodeAddonPackageName(), "addon", "imodeljs.node");
  }
}
