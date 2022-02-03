/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import type { Configuration } from "webpack";

// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/naming-convention
const OptionsDefaulter: any = require("webpack/lib/OptionsDefaulter");

const isProductionLikeMode = (options: Configuration) => {
  return options.mode === "production" || !options.mode;
};

export class IModelJsOptionsDefaulter extends OptionsDefaulter {
  constructor(enableSourceMaps = true) {
    super();

    if (enableSourceMaps) {
      this.set("output.devtoolModuleFilenameTemplate", "call", (value: any, options: Configuration) => {
        if (value)
          return value;

        if (isProductionLikeMode(options))
          return (info: any) => path.relative(options.output?.path || process.cwd(), info.absoluteResourcePath).replace(/\\/g, "/");

        return (info: any) => info.absoluteResourcePath.replace(/\\/g, "/");
      });
    }

    // Add a loader to remove all asserts in production builds.
    this.set("module.rules", "call", (value: any[], options: Configuration) => {
      const rulesToAdd = [];

      if (enableSourceMaps)
        rulesToAdd.push({
          test: /\.js$/,
          loader: require.resolve("source-map-loader"),
          enforce: "pre",
        });

      if (isProductionLikeMode(options))
        rulesToAdd.push({
          test: /\.js$/,
          loader: path.join(__dirname, "../loaders/strip-assert-loader.js"),
          enforce: "pre",
        });

      return [
        ...rulesToAdd, ...(value || []),
      ];
    });
  }
}
