/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { Configuration } from "webpack";

// tslint:disable-next-line:no-var-requires variable-name
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

    this.set("module.noParse", "append", [
      // Don't parse dtrace-provider for `require` calls.
      // It attempts to include (optional) DTrace bindings on MacOS only.
      // According to the bunyan README (https://github.com/trentm/node-bunyan#webpack), we can safely ignore this.
      /dtrace-provider.js$/,
      // Don't parse this file in express - it's causing another "the request of a dependency is an expression" error.
      // As far as I can tell, this attempts to dynamically include an optional templating engine, which we shouldn't need anyway...
      /express[\\\/]lib[\\\/]view.js$/,
    ]);
  }
}
