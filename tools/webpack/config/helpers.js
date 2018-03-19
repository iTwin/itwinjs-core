/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
"use strict";

const glob = require("glob");
const path = require("path");
const fs = require("fs");
const paths = require("./paths");

/** Uses webpack resource path syntax, but strips anything before ~ (node_modules)
 * to handle symlinked modules
 */
const createDevToolModuleFilename = (info) => {
  // default:
  // return `webpack:///${info.resourcePath}?${info.loaders}`
  const tildePos = info.resourcePath.indexOf("~");
  if (-1 !== tildePos)
    return `webpack:///./${info.resourcePath.substr(tildePos)}`;
  return info.absoluteResourcePath;
};

/** Creates a list of include paths for app source and all its @bentley dependencies */
const createBentleySourceMapsIncludePaths = () => {
  let includePaths = [paths.appSrc];
  const bentleyIncludesPath = path.resolve(paths.appNodeModules, "@bentley");
  const bentleyIncludes = fs.readdirSync(bentleyIncludesPath);
  for (const bentleyInclude of bentleyIncludes) {
    const matches = glob.sync(path.resolve(bentleyIncludesPath, bentleyInclude, "**/*.map"))
    if (matches && matches.length > 0)
      includePaths.push(fs.realpathSync(path.resolve(bentleyIncludesPath, bentleyInclude)));
  }
  return includePaths;
};

const _ = require("lodash");
const merge = require("webpack-merge");
const uniteRules = require("webpack-merge/lib/join-arrays-smart").uniteRules;

const mergeWebpackConfigs = merge({
  customizeArray: (a, b, key) => {
    if (key === "module.rules") {
      const preAndPostRules = [];
      const oneOfRule = a.pop();
      if (!oneOfRule.oneOf)
        throw new Error("Failed to merge webpack configs.  The last entry in a base config's module.rules must be { oneOf: [...] }.");

      b.forEach(rule => {
        if (rule.enforce)
          preAndPostRules.push(rule);
        else
          oneOfRule.oneOf.unshift(rule);
      });

      return [..._.unionWith(a, preAndPostRules, uniteRules.bind(null, {}, key)), oneOfRule];
    }

    // Fall back to default merging
    return undefined;
  },

  customizeObject: (a, b, key) => undefined,
});

function getCustomizedWebpackConfig(configPath, config) {
  let actualConfig = config;

  if (paths.appWebpackConfigBase && fs.existsSync(paths.appWebpackConfigBase))
    actualConfig = mergeWebpackConfigs(actualConfig, require(paths.appWebpackConfigBase));

  if (configPath && fs.existsSync(configPath))
    actualConfig = mergeWebpackConfigs(actualConfig, require(configPath));

  return actualConfig;
}

const modulesToExcludeFromTests = [
  paths.appMainJs,
  paths.appIndexJs,
  paths.appSrcBackendElectron,
  paths.appSrcBackendWeb,
]

module.exports = {
  createDevToolModuleFilename,
  createBentleySourceMapsIncludePaths,
  getCustomizedWebpackConfig,
  mergeWebpackConfigs,
  modulesToExcludeFromTests,
};
