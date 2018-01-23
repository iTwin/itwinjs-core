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
  let resourcePath = info.resourcePath;
  const tildePos = resourcePath.indexOf("~");
  if (-1 !== tildePos)
    resourcePath = `./${resourcePath.substr(tildePos)}`;

  return `webpack:///${resourcePath}`;
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

module.exports = {
  createDevToolModuleFilename,
  createBentleySourceMapsIncludePaths,
};
