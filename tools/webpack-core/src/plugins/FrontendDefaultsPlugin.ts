/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { Compiler} from "webpack";
import { DefinePlugin } from "webpack";
import { IModelJsOptionsDefaulter } from "../utils/IModelJsOptionsDefaulter";

/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/naming-convention */
const FilterWarningsPlugin = require("webpack-filter-warnings-plugin");
const ExternalsPlugin = require("webpack/lib/ExternalsPlugin");
/* eslint-enable @typescript-eslint/no-var-requires, @typescript-eslint/naming-convention */

export class FrontendDefaultsPlugin {
  constructor(private _enableSourcemaps = true) { }
  public apply(compiler: Compiler) {
    compiler.options = new IModelJsOptionsDefaulter(this._enableSourcemaps).process(compiler.options);

    // Add default plugins
    new DefinePlugin({
      "global.GENTLY": false,
    }).apply(compiler);
    new FilterWarningsPlugin({ exclude: /Failed to parse source map/ }).apply(compiler);
    new ExternalsPlugin("commonjs", [
      "electron",
    ]).apply(compiler);
  }
}
