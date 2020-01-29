/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import * as glob from "glob";
import { Configuration } from "webpack";

// tslint:disable-next-line:no-var-requires variable-name
const OptionsDefaulter: any = require("webpack/lib/OptionsDefaulter");

const isProductionLikeMode = (options: Configuration) => {
  return options.mode === "production" || !options.mode;
};

/** Uses webpack resource path syntax, but strips anything before ~ (node_modules)
 * to handle symlinked modules
 */
const createDevToolModuleFilename = (info: any) => {
  // default:
  // return `webpack:///${info.resourcePath}?${info.loaders}`
  const tildePos = info.resourcePath.indexOf("~");
  if (-1 !== tildePos)
    return `webpack:///./${info.resourcePath.substr(tildePos)}`;
  return info.absoluteResourcePath;
};

const knownSourceMapPaths: string[] = [];

/** Creates a list of include paths for app source and all its @bentley dependencies */
const createBentleySourceMapsIncludePaths = (resource: string) => {
  for (const knownDir of knownSourceMapPaths) {
    if (resource.startsWith(knownDir))
      return true;
  }

  const dir = path.dirname(resource);
  const matches = glob.sync(path.join(dir, "{!(module)/**/*.map,*.map}"));
  if (matches && matches.length > 0) {
    knownSourceMapPaths.push(dir);
    return true;
  }
  return false;
};

export class IModelJsOptionsDefaulter extends OptionsDefaulter {
  constructor(enableSourceMaps = true) {
    super();

    if (enableSourceMaps) {
      this.set("devtool", "cheap-module-source-map");
      this.set("output.devtoolModuleFilenameTemplate", createDevToolModuleFilename);
      this.set("module.rules", "append", [
        {
          test: /\.js$/,
          loader: require.resolve("source-map-loader"),
          enforce: "pre",
          include: createBentleySourceMapsIncludePaths,
        },
      ]);
    }

    // Add a loader to remove all asserts in production builds.
    this.set("module.rules", "call", (value: any[], options: Configuration) => {
      if (!isProductionLikeMode(options))
        return value;

      return [
        ...(value || []),
        {
          test: /\.js$/,
          loader: path.join(__dirname, "../loaders/strip-assert-loader.js"),
          enforce: "pre",
        },
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
