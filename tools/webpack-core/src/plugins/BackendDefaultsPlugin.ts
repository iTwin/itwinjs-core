/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { AssetInfo, Compiler, DefinePlugin, ExternalsPlugin, RuleSetRule } from "webpack";
import { CopyAppAssetsPlugin, CopyStaticAssetsPlugin } from "./CopyBentleyStaticResourcesPlugin";
import { CopyExternalsPlugin } from "./CopyExternalsPlugin";
import { IgnoreOptionalDependenciesPlugin } from "./OptionalDependenciesPlugin";
import { addCopyFilesSuffix, addExternalPrefix, copyFilesRule, handlePrefixedExternals, RequireMagicCommentsPlugin } from "./RequireMagicCommentsPlugin";

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

    const isProductionLikeMode =
      compiler.options.mode === "production" || !compiler.options.mode;

    if (isProductionLikeMode) {
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

    compiler.options.output.devtoolModuleFilenameTemplate = (info: AssetInfo) => {
      const devtoolPath = isProductionLikeMode
        ? path.relative(
          compiler.options.output?.path || process.cwd(),
          info.absoluteResourcePath,
        )
        : path.resolve(info.absoluteResourcePath);

      return devtoolPath.replace(/\\/g, "/");
    };

    if (compiler.options.ignoreWarnings === undefined)
      compiler.options.ignoreWarnings = [];
    compiler.options.ignoreWarnings.push((warn) => /Failed to parse source map/.test(warn.message));

    // Add default plugins
    const plugins = [
      new CopyAppAssetsPlugin("assets"),
      new CopyStaticAssetsPlugin({ fromTo: "assets", useDirectoryName: true }),
      new CopyExternalsPlugin(),
      new DefinePlugin({
        "global.GENTLY": false,
      }),
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
        "applicationinsights-native-metrics",
        "@opentelemetry/tracing",
        "keytar",
      ]),
    ];
    plugins.forEach((p) => p.apply(compiler));
  }
}
