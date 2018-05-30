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

/** Class that holds the singleton platform instance that was loaded by the app for this iModelJs session. It is up to the app to load the platform. */
export class NativePlatformRegistry {
  private static _platform: any;

  /** Return the singleton platform instance configured for this iModelJs session.
   * See [[NativePlatformRegistry.register]]
   * @throws [[IModelError]] if the platform was not loaded.
   */
  public static getNativePlatform(): any {
    if (!NativePlatformRegistry._platform)
      throw new IModelError(IModelStatus.FileNotLoaded, "Node platform not loaded");

    return NativePlatformRegistry._platform;
  }

  /** @hidden */
  public static isNativePlatformLoaded(): boolean {
    return NativePlatformRegistry._platform !== undefined;
  }

  /** Call this function to register the platform */
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

  /** Load the appropriate version of the standard addon. */
  public static loadStandardAddon(dir?: string): any | undefined {
    if (typeof (process) === "undefined" || process.version === "")
      throw new Error("could not determine process type");

    const addonPackageName = NodeAddonPackageName.computeDefaultImodelNodeAddonPackageName();

    const addonFileName = path.join(dir || "", addonPackageName, "addon", "imodeljs.node");

    return realrequire(addonFileName);
  }

  /** Load and register the standard platform. */
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

/** Utility class to help apps compute the name of the default platform package that should be used in the current environment.
 * Normally, only an Electron app should have to use this class.
 * NB: This class is NOT to be used directly by the backend.
 */
export class NodeAddonPackageName {

  /** Compute the name of default platform package that should be used for this environment. This method uses the same naming formula that is used by
   * the bb part that generates and publishes the default platform packages (iModelJsNodeAddon:MakePackages).
   */
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

  /** Compute the name of default addon that should be used for this environment. This method uses the same naming formula that is used by
   * the bb part that generates and publishes the default platform packages (iModelJsNodeAddon:MakePackages).
   */
  public static computeDefaultImodelNodeAddonName(): string {
    return path.join(NodeAddonPackageName.computeDefaultImodelNodeAddonPackageName(), "addon", "imodeljs.node");
  }
}
