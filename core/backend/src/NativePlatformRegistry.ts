/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelError, IModelStatus } from "@bentley/imodeljs-common";
import { Logger } from "@bentley/bentleyjs-core";
import { Platform } from "./Platform";
import * as path from "path";

// tslint:disable-next-line:no-eval
const realrequire = eval("require");

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

  /** Get the module that can load the standard node addon. */
  public static getStandardAddonLoaderModule(dir?: string): any | undefined {
    if (typeof (process) === "undefined")
      return undefined;
    let packageDir: string;
    if ("electron" in process.versions)
      packageDir = "@bentley/imodeljs-native-platform-electron";
    else
      packageDir = "@bentley/imodeljs-native-platform-node";
    if (dir !== undefined)
      packageDir = path.join(dir, packageDir);
    // *** TODO: Put the name of the js file back into the addon package's 'main' property, so that we don't have to hard-wire it here.
    const addonLoaderPath = path.join(packageDir, "NodeAddonLoader.js");
    return realrequire(addonLoaderPath);
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
    const loaderModule = NativePlatformRegistry.getStandardAddonLoaderModule(dir);
    if (loaderModule === undefined) {
      throw new IModelError(IModelStatus.NotFound);
    }
    NativePlatformRegistry.register(loaderModule.NodeAddonLoader.loadAddon());
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
      versionCode = "e_" + electronVersion.replace(/\./g, "_");
    } else {
      const nodeVersion = process.version.substring(1).split("."); // strip off the character 'v' from the start of the string
      versionCode = "n_" + nodeVersion[0]; // use only major version number
    }
    return "@bentley/imodeljs-" + versionCode + "-" + process.platform + "-" + process.arch;
  }

  /** Compute the name of default platform that should be used for this environment. This method uses the same naming formula that is used by
   * the bb part that generates and publishes the default platform packages (iModelJsNodeAddon:MakePackages).
   */
  public static computeDefaultImodelNodeAddonName(): string {
    return NodeAddonPackageName.computeDefaultImodelNodeAddonPackageName() + "/platform/imodeljs.node";
  }
}
