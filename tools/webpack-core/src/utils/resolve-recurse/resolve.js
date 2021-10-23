/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// Adapted from resolve.js, https://github.com/brandonhorst/node-resolve-recurse/blob/master/lib/resolve.js
const util = require("util");
const findup = util.promisify(require("findup"));
const resolve = util.promisify(require("resolve"));
const builtIn = require("module").builtinModules;
const _ = require("lodash");
const path = require("path");
const fs = require("fs");

// Track used Dependencies so we don't waste time processing the same ones.
const usedDeps = new Set();

// promise moduleDirectory
// given the name of a module, and the directory of the module which referenced
//  it, resolve to the module base directory
function moduleDirectory(name, dir) {
  return resolve(`${name}/package.json`, { basedir: dir }).then(function (filePath) {
    return findup(path.dirname(filePath), "package.json");
  });
}
// promise mergeDefaultOptions
// given use-input options, it will resolve an options object
//  with the defaults in place, and options.path resolved
function mergeDefaultOptions(options) {

  // apply simple defaults
  const trueOptions = {
    filter: options.filter || null,
    properties: options.properties || ["dependencies"],
  };

  // if options.path was supplied, resolve it relative to the parent.
  // if not, just use the parent itself
  let modulePromise;
  let modulePath;
  if (options.path) {
    modulePath = options.relative ? path.dirname(options.relative) : path.dirname(module.parent.filename);
    modulePromise = moduleDirectory(options.path, modulePath);
  } else {
    modulePromise = moduleDirectory(module.parent.filename, ".");
  }

  // return a promise that resolves to the true path
  return modulePromise.then(function (modPath) {
    trueOptions.path = modPath;
    return trueOptions;
  });
}

// function unzipObject
// given an accumulator (an array) and an object, break the object into many
// [key, value] arrays and add them to acc
// return acc
// for use with _.reduce
function unzipObject(acc, value) {
  _.each(value, function (val, key) {
    acc.push({ name: key, version: val });
  });
  return acc;
}

// function getDependencies
// given a package.json file read into an object, return the dependencies
// as specified in options.dependencies
function getDependencies(pkg, options) {
  return _.chain(pkg)
    .at(options.properties)
    .reduce(unzipObject, [])
    .value();
}

// promise dependentModules
// resolves to an array of the dependentModules for a module in a given directory
// allowedVersion is the version that the referring package.json requested,
//  if it exists
// options is the options object
async function dependentModules(dir, allowedVersion, options) {
  dir = fs.realpathSync(dir);
  // read the package.json, and get the dependencies
  const pkg = require(path.join(dir, "package.json"));
  let deps = getDependencies(pkg, options);

  // if there is a filter, and it rejects this package.json, just stop
  if (options.filter && !options.filter(pkg)) {
    return Promise.resolve(null);
  }
  // Filter out built in dependencies and ones that we've already found in our search.
  deps = deps.filter((value) => {
    return !(builtIn.includes(value.name)) && !usedDeps.has(value.name);
  });
  deps.forEach((element) => {
    usedDeps.add(element.name);
  });
  // for each dependency, make a promise that calls dependentModules
  // on its directory
  const depPromises = _.map(deps, function (dep) {
    return moduleDirectory(dep.name, dir).then(async function (directory) {
      return dependentModules(directory, dep.version, options);
    });
  });

  // return a promise that will give an array of objects representing each dep
  // call _.compact because filtered-out dependencies return null
  return Promise.all(depPromises).then(function (depObjects) {
    return {
      name: pkg.name,
      path: dir,
      allowedVersion,
      actualVersion: pkg.version,
      dependencies: _.compact(depObjects),
    };
  });
}

// promise resolveRecurse
// entry point
// resolve to the default options, and then get the
//  dependent modules (recursively)
async function resolveRecurse(options) {
  if (!options) {
    options = {};
  }

  // get the default options, and then get the dependent modules
  // nodify it, to conform to a typical node API but still return a promise
  return mergeDefaultOptions(options).then(async function (opts) {
    return dependentModules(opts.path, null, opts);
  });
}

exports.resolveRecurse = resolveRecurse;
exports.usedDeps = usedDeps;
