/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Compiler } from "webpack";
import { ConcatSource } from "webpack-sources";
import * as utils from "./IModeljsLibraryUtils";

/** The plugin adds any module that contains the `imodeljsSharedLibrary` field within its package.json to the global scope.
 *
 * The reason for adding it to the global scope is in support of iModel.js Extensions.
 */
export class IModeljsLibraryExportsPlugin {
  constructor() { }

  public apply(compiler: Compiler) {
    compiler.hooks.normalModuleFactory.tap("IModeljsLibraryExportsPlugin", (normalModuleFactory) => {
      normalModuleFactory.hooks.module.tap("IModeljsLibraryExportsPlugin", (mod, info) => {
        const pkgJson = info.resourceResolveData.descriptionFileData;
        if ((pkgJson.name === info.rawRequest && pkgJson.imodeljsSharedLibrary) || utils.ADDITIONAL_SHARED_LIBRARIES.includes(pkgJson.name)) {
          mod.___IS_BENTLEY = true;
          mod.___IMJS_VER = pkgJson.version;
          mod.___IMJS_NAME = pkgJson.name;
        }
        return mod;
      });
    });
    compiler.hooks.compilation.tap("IModeljsLibraryExportsPlugin", (compilation) => {
      compilation.moduleTemplates.javascript.hooks.content.tap("IModeljsLibraryExportsPlugin", (source, module) => {
        // check for a rootModule (for concatenated modules)
        let rootModule;
        if (!module.___IS_BENTLEY && module.rootModule && module.rootModule.___IS_BENTLEY) {
          rootModule = module.rootModule;
        }

        const isBentley = module.___IS_BENTLEY || (rootModule && rootModule.___IS_BENTLEY);
        if (!isBentley)
          return source;

        const pkgName = JSON.stringify(rootModule ? rootModule.___IMJS_NAME : module.___IMJS_NAME);
        const pkgVersion = JSON.stringify(rootModule ? rootModule.___IMJS_VER : module.___IMJS_VER);

        return new ConcatSource(
          source,
          `\nif ((typeof window !== "undefined") && window && !window.${utils.IMJS_GLOBAL_OBJECT}) window.${utils.IMJS_GLOBAL_OBJECT} = {};`,
          `\nif ((typeof window !== "undefined") && window && !window.${utils.IMJS_GLOBAL_LIBS}) window.${utils.IMJS_GLOBAL_LIBS} = {};`,
          `\nif ((typeof window !== "undefined") && window && !window.${utils.IMJS_GLOBAL_LIBS_VERS}) window.${utils.IMJS_GLOBAL_LIBS_VERS} = {};`,
          `\nwindow.${utils.IMJS_GLOBAL_LIBS}[${pkgName}] = __webpack_require__(${JSON.stringify(module.id)});`,
          `\nwindow.${utils.IMJS_GLOBAL_LIBS_VERS}[${pkgName}] = ${pkgVersion};\n`,
        );
      });
    });
  }
}
