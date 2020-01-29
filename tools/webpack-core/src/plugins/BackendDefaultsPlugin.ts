/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Compiler, DefinePlugin } from "webpack";
import { IModelJsOptionsDefaulter } from "../utils/IModelJsOptionsDefaulter";
import { CopyAppAssetsPlugin, CopyBentleyStaticResourcesPlugin } from "./CopyBentleyStaticResourcesPlugin";
import { CopyExternalsPlugin } from "./CopyExternalsPlugin";

// tslint:disable:no-var-requires variable-name
const OptionsDefaulter = require("webpack/lib/OptionsDefaulter");
const ExternalsPlugin = require("webpack/lib/ExternalsPlugin");

class BackendOptionsDefaulter extends OptionsDefaulter {
  constructor() {
    super();

    // By default, webpack will prefer ES Modules over CommonJS modules.
    // This causes trouble with importing node-fetch, so we need to explicitly prefer CommonJS over ES/Harmony.
    // https://github.com/bitinn/node-fetch/issues/450#issuecomment-494475397
    this.set("resolve.mainFields", ["main"]);

    // Don't bother minimizing backends...
    this.set("optimization.minimize", false);
  }
}

export class BackendDefaultsPlugin {
  public apply(compiler: Compiler) {
    // Applying defaults here will allow us to set some defaults before even webpack has a chance to set them...
    compiler.options = new BackendOptionsDefaulter().process(compiler.options);

    compiler.hooks.beforeRun.tap("BackendDefaultsPlugin", () => {
      compiler.options = new IModelJsOptionsDefaulter().process(compiler.options);
    });

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
