/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Compiler } from "webpack";
import { ConcatSource } from "webpack-sources";
import * as utils from "./IModeljsLibraryUtils";
function getLoaderString(pkgName: string, pkgVersion: string) {
  return `  const semverGte = (appVersion, extensionVersion) => {
    const dashIndexApp = appVersion.indexOf("-");
    const dashIndexExtension = extensionVersion.indexOf("-");
    if (dashIndexExtension >= 0 ) {
      console.warn("This extension depends on a nightly version of iModel.js Shared Libraries. Use in production with caution as stability is not guaranteed.");
      extensionVersion = extensionVersion.substring(0, dashIndexExtension);
    }
    if (dashIndexApp >= 0) appVersion = appVersion.substring(0, dashIndexApp);
    const appVersionSplit = appVersion.split(".").map((value) => parseInt(value));
    const extensionVersionSplit = extensionVersion.split(".").map((value) => parseInt(value));
    if (appVersionSplit.length !== 3)
      throw new Error("An iModel.js Shared Library is not versioned correctly. Expected 3 numbers separated by '.' for the version");
    if (extensionVersionSplit.length !== 3) throw new Error("Extension is not versioned correctly.Expected 3 numbers separated by '.' for the version.");
    for (const [index, value] of appVersionSplit.entries()) {
      if (value > extensionVersionSplit[index])
        return true;
      else if (value < extensionVersionSplit[index])
        return false;
    }
    return true; // If we don't return while in the loop, then we're in the case where the versions are equal.
  };
  module.exports = (() => {
    if (!window.${utils.IMJS_GLOBAL_OBJECT} || !window.${utils.IMJS_GLOBAL_LIBS_VERS} || !window.${utils.IMJS_GLOBAL_LIBS})
      throw new Error("Expected globals are missing!");
    if (semverGte(window.${utils.IMJS_GLOBAL_LIBS_VERS}[${pkgName}], ${pkgVersion}))
      return window.${utils.IMJS_GLOBAL_LIBS}[${pkgName}];
    if (window.${utils.IMJS_GLOBAL_LIBS}[${pkgName}])
      throw new Error("iModel.js Shared Library " + ${pkgName} + " is loaded, but is an incompatible version." )
    throw new Error("iModel.js Shared Library " + ${pkgName} + " is not yet loaded." )
  })();`;
}

export class IModeljsLibraryImportsPlugin {
  constructor() { }

  public apply(compiler: Compiler) {
    compiler.hooks.normalModuleFactory.tap("IModeljsLibraryImportsPlugin", (normalModuleFactory) => {
      normalModuleFactory.hooks.module.tap("IModeljsLibraryImportsPlugin", (mod, info) => {
        const pkgJson = info.resourceResolveData.descriptionFileData;
        if ((pkgJson.name === info.rawRequest && pkgJson.imodeljsSharedLibrary) || utils.ADDITIONAL_SHARED_LIBRARIES.includes(pkgJson.name)) {
          mod.___IS_BENTLEY = true;
          mod.___IMJS_VER = pkgJson.version;
          mod.___IMJS_NAME = pkgJson.name;
          mod.shouldPreventParsing = () => true;
        }
      });
    });

    compiler.hooks.compilation.tap("IModeljsLibraryImportsPlugin", (compilation) => {
      compilation.moduleTemplates.javascript.hooks.content.tap("IModeljsLibraryImportsPlugin", (source, module) => {
        if (!module.___IS_BENTLEY)
          return source;
        const pkgName = JSON.stringify(module.___IMJS_NAME);
        const pkgVersion = JSON.stringify(module.___IMJS_VER);
        return new ConcatSource(getLoaderString(pkgName, pkgVersion));
      });
    });
  }
}
