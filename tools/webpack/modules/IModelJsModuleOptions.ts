/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as lodash from "lodash";
import * as Utils from "./utils";

export enum SubModuleType {
  System = "system",
  Plugin = "plugin",
  WebWorker = "webworker",
}

/**  */
export enum ModuleType {
  System = "system",
  Application = "application",
  Plugin = "plugin",
  WebWorker = "webworker",
}

export interface WebpackModuleOpts {
  /** Output directory for webpacked bundle. Typically "lib/module" for modules and "lib/webresources" for applications and plugins. */
  dest: string;
  /** Entry script file point for webpack to start. Typically "lib/index.js" or "lib/main.js". */
  entry: string;
  /** The name of the bundle. For applications, "main.js". For modules, the name of the module. For plugins, the name of the plugin. */
  bundleName: string;
  /** if present and true, indicates that webpack needs to use the stylesheet loading plugins. Slows webpack down considerably. */
  styleSheets?: boolean;
  /** For applications only, uses the specified html file as a template to create the webpage's html file. */
  htmlTemplate?: string;
  /** Only for `Plugin` module types. */
  build?: string;
  /** Only for `Plugin` module types. */
  sign?: {
    privateKey: string;
    publicKey: string;
  };
}

/**
 * Defines the options supported from the command line.
 */
export interface ModuleOpts {
  /** Whether to build the production version */
  production?: boolean;
  /** Number between 0 and 4. The greater of module.detail and args.detail is used. */
  detail?: number;
  /** Whether to generate a stats file for all of the system modules */
  stats?: boolean;
}

/** Defines the structure of the `iModelJs.buildModule` JSON in the package.json.
 */
export interface IModelJsModuleConfig {
  type: ModuleType;

  /** Number between 0 and 4. The greater of module.detail and args.detail is used. */
  detail: number;

  /** A space-delimited string of options to pass to the tsc command line. Usually, the build just does "tsc" and uses tsconfig.json for all options. */
  tscOptions?: string;

  /** If specified, ensures that pseduoLocalization is performed for any localization files within the specified `source` directory. */
  pseudoLocalize?: { source: string, dest: string };

  /** Defines a list of the resources that should be included with the plugin */
  sourceResources: Array<{
    source: string,
    dest: string,
    copy?: boolean,
  }>;

  /** Additional webpack options that are passed to webpack during compilation. */
  webpack?: WebpackModuleOpts;

  /**  Defines the configuration for the frontend bundle
   * > Used only in the case of an "Application" type.
   */
  makeConfig?: {
    dest: string,
    sources?: Array<{ file: string, filter: string }>,
    filter?: string, // Not needed if sources is supplied
  };

  subModules?: Array<{
    dest: string,
    entry: string,
    bundleName: string,
    styleSheets?: boolean,
    type: SubModuleType,
  }>;

  /** Used to streamline development of Plugins within the iModel.js repository or when developing an app alongside a Plugin
   * WARNING:  This will be removed in 2.0 in favor of a better Plugin development experience.
   */
  installTo?: string;
}

/** Returns whether or not the `iModelJs.buildModule` exists within a the provided file */
export function validPackageJsonConfig(fileName: string): boolean {
  const packageContents: any = Utils.readPackageFileContents(fileName);
  return packageContents.iModelJs && packageContents.iModelJs.buildModule;
}

/** Creates an iModelJsModuleConfig object by loading options from a json config file,
 * applying run-time overrides.
 * All relative paths specified in the config file are resolved from the config file directory.
 * All other relative paths (overrides) are resolved from the current working directory.
 * Throws if the `buildModule` object is undefined or invalid.
 * @param fileName  The path to the package.json config file.
 * @param overrides  A partial set of options.  These values will always override any options set in the config file.
 */
export function fromPackageJson(fileName: string, overrides: ModuleOpts): IModelJsModuleConfig {
  const packageContents: any = Utils.readPackageFileContents(fileName);
  if (packageContents.iModelJs && packageContents.iModelJs.buildModule)
    return lodash.defaultsDeep(overrides, packageContents.iModelJs.buildModule);
  throw new Error(`The 'iModelJs.buildModule' does not exist in ${fileName}.`);
}
