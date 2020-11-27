/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Compiler } from "webpack";
import { ConcatSource } from "webpack-sources";
import * as utils from "./IModeljsLibraryUtils";

function getLoaderString(pkgName: string, pkgVersion: string) {
  return `  module.exports = (() => {
    if (!window.${utils.IMJS_GLOBAL_OBJECT} || !window.${utils.IMJS_GLOBAL_LIBS_VERS} || !window.${utils.IMJS_GLOBAL_LIBS})
      throw new Error("Expected globals are missing!");
    if (window.${utils.IMJS_GLOBAL_LIBS_VERS}[${pkgName}] >= ${pkgVersion})
      return window.${utils.IMJS_GLOBAL_LIBS}[${pkgName}];
    if (window.${utils.IMJS_GLOBAL_LIBS}[${pkgName}])
      throw new Error("iModel.js Shared Library " + ${pkgName} + " is loaded, but is an incompatible version." )
    throw new Error("iModel.js Shared Library " + ${pkgName} + " is not yet loaded." )
  })();`;
}

export class IModeljsLibraryImportsPlugin {
  constructor() { }

  public apply(compiler: Compiler): void {
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
