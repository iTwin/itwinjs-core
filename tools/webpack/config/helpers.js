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

const knownSourceMapPaths = [paths.appSrc];

/** Creates a list of include paths for app source and all its @bentley dependencies */
const createBentleySourceMapsIncludePaths = (resource) => {
  for (const knownDir of knownSourceMapPaths) {
    if (resource.startsWith(knownDir))
      return true;
  }

  const dir = path.dirname(resource);
  const matches = glob.sync(path.resolve(dir, "**/*.map"));
  if (matches && matches.length > 0) {
    knownSourceMapPaths.push(dir);
    return true;
  }
  return false;
};

const _ = require("lodash");
const merge = require("webpack-merge");
const uniteRules = require("webpack-merge/lib/join-arrays-smart").uniteRules;

const mergeWdioConfigs = merge;
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
    } else if (key === "externals") {
      return [...b, ...a];
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
  mergeWdioConfigs,
  mergeWebpackConfigs,
  modulesToExcludeFromTests,
};
