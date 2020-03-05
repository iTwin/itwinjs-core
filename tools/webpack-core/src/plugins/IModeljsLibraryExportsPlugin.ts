/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Compiler } from "webpack";
import { ConcatSource } from "webpack-sources";

const IMJS_GLOBAL_OBJECT = "__IMODELJS_INTERNALS_DO_NOT_USE";
const IMJS_GLOBAL_LIBS = `${IMJS_GLOBAL_OBJECT}.SHARED_LIBS`;
const IMJS_GLOBAL_LIBS_VERS = `${IMJS_GLOBAL_LIBS}_VERS`;

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
        if (pkgJson.name === info.rawRequest && pkgJson.imodeljsSharedLibrary) {
          mod.___IS_BENTLEY = true;
          mod.___IMJS_VER = pkgJson.version;
          mod.___IMJS_NAME = pkgJson.name;
        }
        return mod;
      });
    });
    compiler.hooks.compilation.tap("IModeljsLibraryExportsPlugin", (compilation) => {
      compilation.moduleTemplates.javascript.hooks.content.tap("IModeljsLibraryExportsPlugin", (source, module) => {
        if (!module.___IS_BENTLEY)
          return source;
        const pkgName = JSON.stringify(module.___IMJS_NAME);
        return new ConcatSource(
          source,
          `\nif ((typeof window !== "undefined") && window && !window.${IMJS_GLOBAL_LIBS}) window.${IMJS_GLOBAL_LIBS} = [];`,
          `\nif ((typeof window !== "undefined") && window && !window.${IMJS_GLOBAL_LIBS_VERS}) window.${IMJS_GLOBAL_LIBS_VERS} = [];`,
          `\nwindow.${IMJS_GLOBAL_LIBS}[${pkgName}] = __webpack_require__(${JSON.stringify(module.id)});`,
          `\nwindow.${IMJS_GLOBAL_LIBS_VERS}[${pkgName}] = ${JSON.stringify(module.___IMJS_VER)};\n`,
        );
      });
    });
  }
}
