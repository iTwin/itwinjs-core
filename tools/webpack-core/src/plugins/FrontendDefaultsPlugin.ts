/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Compiler, DefinePlugin } from "webpack";
import { IModelJsOptionsDefaulter } from "../utils/IModelJsOptionsDefaulter";

export class FrontendDefaultsPlugin {
  constructor(private _enableSourcemaps = true) { }
  public apply(compiler: Compiler) {
    compiler.options = new IModelJsOptionsDefaulter(this._enableSourcemaps).process(compiler.options);

    // Add default plugins
    new DefinePlugin({
      "global.GENTLY": false,
    }).apply(compiler);
  }
}
