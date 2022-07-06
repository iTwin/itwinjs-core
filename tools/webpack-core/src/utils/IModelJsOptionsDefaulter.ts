/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// import * as path from "path";
import { Configuration, WebpackOptionsDefaulter } from "webpack";

// eslint-disable-next-line @typescript-eslint/naming-convention
const _isProductionLikeMode = (options: Configuration) => {
  return options.mode === "production" || !options.mode;
};

export class IModelJsOptionsDefaulter extends WebpackOptionsDefaulter {
  constructor(_enableSourceMaps = true) {
    super();
    // if (enableSourceMaps) {
    //   this.set("output.devtoolModuleFilenameTemplate", "call", (value: any, options: Configuration) => {
    //     if (value)
    //       return value;
    //     if (isProductionLikeMode(options))
    //       return (info: any) => path.relative(options.output?.path || process.cwd(), info.absoluteResourcePath).replace(/\\/g, "/");
    //     return (info: any) => info.absoluteResourcePath.replace(/\\/g, "/");
    //   });
    // }
    // // Add a loader to remove all asserts in production builds.
    // this.set("module.rules", "call", (value: any[], options: Configuration) => {
    //   const rulesToAdd = [];
    //   if (enableSourceMaps)
    //     rulesToAdd.push({
    //       test: /\.js$/,
    //       loader: require.resolve("source-map-loader"),
    //       enforce: "pre",
    //     });
    //   if (isProductionLikeMode(options))
    //     rulesToAdd.push({
    //       test: /\.js$/,
    //       loader: path.join(__dirname, "../loaders/strip-assert-loader.js"),
    //       enforce: "pre",
    //     });
    //   return [
    //     ...rulesToAdd, ...(value || []),
    //   ];
    // });
  }

  public override process(options?: any) {
    return options;
  }
}
