/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { Compiler, Configuration, DefinePlugin, ExternalsPlugin, RuleSetRule, WebpackOptionsNormalized } from "webpack";
import { CopyAppAssetsPlugin, CopyStaticAssetsPlugin } from "./CopyBentleyStaticResourcesPlugin";
import { CopyExternalsPlugin } from "./CopyExternalsPlugin";
import { IgnoreOptionalDependenciesPlugin } from "./OptionalDependenciesPlugin";
import { addCopyFilesSuffix, addExternalPrefix, copyFilesRule, handlePrefixedExternals, RequireMagicCommentsPlugin } from "./RequireMagicCommentsPlugin";

/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/naming-convention */
const FilterWarningsPlugin = require("webpack-filter-warnings-plugin");
/* eslint-enable @typescript-eslint/no-var-requires, @typescript-eslint/naming-convention */

const isProductionLikeMode = (
  options: Configuration | WebpackOptionsNormalized
) => {
  return options.mode === "production" || !options.mode;
};

export class BackendDefaultsPlugin {
  public apply(compiler: Compiler) {
    // By default, webpack will prefer ES Modules over CommonJS modules.
    // This causes trouble with importing node-fetch, so we need to explicitly prefer CommonJS over ES/Harmony.
    // https://github.com/bitinn/node-fetch/issues/450#issuecomment-494475397
    compiler.options.resolve.mainFields = ["main"];

    // Don't bother minimizing backends...
    compiler.options.optimization.minimize = false;

    // Add a loader to remove all asserts in production builds.
    const defaultRules: RuleSetRule[] = [
      {
        test: /\.js$/,
        loader: require.resolve("source-map-loader"),
        enforce: "pre",
      },
    ];

    if (isProductionLikeMode(compiler.options)) {
      defaultRules.push({
        test: /\.js$/,
        loader: path.join(__dirname, "../loaders/strip-assert-loader.js"),
        enforce: "pre",
      });
    }

    compiler.options.module.rules = [
      ...defaultRules,
      ...(compiler.options.module.rules || []),
      {
        test: /\.ecschema\.xml$/,
        loader: require.resolve("file-loader"),
        options: {
          name: "ecschemas/[name].[ext]",
        },
      },
      copyFilesRule,
    ];

    compiler.options.output.devtoolModuleFilenameTemplate = (
      value: any,
      options: Configuration
    ) => {
      if (value) return value;

      if (isProductionLikeMode(options))
        return (info: any) =>
          path
            .relative(
              options.output?.path || process.cwd(),
              info.absoluteResourcePath
            )
            .replace(/\\/g, "/");

      return (info: any) => info.absoluteResourcePath.replace(/\\/g, "/");
    };

    // Add default plugins
    const plugins = [
      new CopyAppAssetsPlugin("assets"),
      new CopyStaticAssetsPlugin({ fromTo: "assets", useDirectoryName: true }),
      new CopyExternalsPlugin(),
      new DefinePlugin({
        "global.GENTLY": false,
      }),
      new FilterWarningsPlugin({ exclude: /Failed to parse source map/ }),
      new IgnoreOptionalDependenciesPlugin([
        "debug",
        "diagnostic-channel-publishers",
        "express",
        "got",
        "keyv",
        "ws",
        "node-fetch",
      ]),
      new RequireMagicCommentsPlugin([
        {
          test: /webpack: *external/i,
          handler: addExternalPrefix,
        },
        {
          test: /webpack: *copyfile/i,
          handler: addCopyFilesSuffix,
          convertResolve: true,
        },
      ]),
      new ExternalsPlugin("commonjs", [
        handlePrefixedExternals,
        "electron",
        "@bentley/imodeljs-native",
        "@bentley/imodeljs-native/package.json",
        "dtrace-provider",
        "node-report/api",
        "applicationinsights-native-metrics",
        "@opentelemetry/tracing",
        "keytar",
      ]),
    ];
    plugins.forEach((p) => p.apply(compiler));
  }
}
