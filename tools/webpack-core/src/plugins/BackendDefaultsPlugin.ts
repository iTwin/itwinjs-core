/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Compiler, DefinePlugin } from "webpack";
import { IModelJsOptionsDefaulter } from "../utils/IModelJsOptionsDefaulter";
import { CopyAppAssetsPlugin, CopyBentleyStaticResourcesPlugin } from "./CopyBentleyStaticResourcesPlugin";
import { CopyExternalsPlugin } from "./CopyExternalsPlugin";

// tslint:disable-next-line:no-var-requires variable-name
const ExternalsPlugin = require("webpack/lib/ExternalsPlugin");

export class BackendDefaultsPlugin {
  public apply(compiler: Compiler) {
    // By default, webpack will prefer ES Modules over CommonJS modules.
    // This causes trouble with importing node-fetch, so we need to explicitly prefer CommonJS over ES/Harmony.
    // https://github.com/bitinn/node-fetch/issues/450#issuecomment-494475397
    compiler.options.resolve!.mainFields = ["main"];

    // Don't bother minimizing backends...
    compiler.options.optimization!.minimize = false;

    compiler.options = new IModelJsOptionsDefaulter().process(compiler.options);

    // Add default plugins
    new CopyAppAssetsPlugin("assets").apply(compiler);
    new CopyBentleyStaticResourcesPlugin(["assets"]).apply(compiler);
    new CopyExternalsPlugin().apply(compiler);
    new DefinePlugin({
      "global.GENTLY": false,
    }).apply(compiler);
    new ExternalsPlugin("commonjs", [
      "@bentley/imodeljs-native/package.json",
      "@bentley/imodeljs-native/loadNativePlatform.js",
      "dtrace-provider",
      "node-report/api",
    ]).apply(compiler);
  }
}
