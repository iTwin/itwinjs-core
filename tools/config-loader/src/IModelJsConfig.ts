/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chalk from "chalk";
import * as fs from "fs";
import * as JSON5 from "json5";
import * as path from "path";

/** Loads the provided `.env` file into process.env
 * @internal
 */
export function loadEnv(envFile: string) {
  if (!fs.existsSync(envFile))
    return;

  const dotenv = require("dotenv"); // eslint-disable-line @typescript-eslint/no-var-requires
  const dotenvExpand = require("dotenv-expand"); // eslint-disable-line @typescript-eslint/no-var-requires
  const envResult = dotenv.config({ path: envFile });
  if (envResult.error) {
    throw envResult.error;
  }

  dotenvExpand(envResult);
}

/* eslint-disable deprecation/deprecation */

/** Handles locating an iModel.js configuration JSON file and merging it with the existing configuration.
 *
 * The best way to use this class, and the [[IModelJsConfig.init]] method, is by calling it on the startup of an iModel.js
 * application or at the beginning of test execution.
 *
 * For details on how the configuration is loaded, see the documentation on [[IModelJsConfig.init]].
 * @public
 * @deprecated Deprecated in favor of directly using the dotenv package or using the new `loadEnv()`. Will be removed in next major release (3.0).
 */
export class IModelJsConfig {
  private static _repositoryPath: string;

  /** Given a directory, it will be searched for a `default.json5` file and if a `overrideConfigName` is provided that filename, append with `.json5`, will
   * be searched for in the provided directory.
   *
   * If the "{overrideConfigName}.json5" file exists, the configuration is merged with the default configuration using `Object.assign`.  Meaning if there are
   * any configurations with the same key, the one specified in the "{overrideConfigName}.json5" will win.
   *
   * > If the `default.json5` is found and parsed successfully, the path to the config file will be added to the configuration with the key, `imjs_config_file_default`.
   * > If the `{overrideConfigName}.json5` is found, the path will be added with the key, `imjs_config_file_override`.
   */
  private static getConfiguration(repositoryRootDir: string, overrideConfigName?: string): any {
    const fileExtension = ".json5";
    const defaultConfigFile = path.join(repositoryRootDir, `default${fileExtension}`);
    if (!fs.existsSync(defaultConfigFile))
      throw new Error(`Could not find default${fileExtension} at ${repositoryRootDir}.`);

    const defaultConfig = JSON5.parse(fs.readFileSync(defaultConfigFile, "utf8").toString());

    // override default with another config
    if (undefined !== overrideConfigName) {
      const overrideConfigFile = path.join(repositoryRootDir, overrideConfigName + fileExtension);
      if (!fs.existsSync(overrideConfigFile))
        throw new Error(`Could not find config file ${overrideConfigFile}`);

      const overrideConfig: object = JSON5.parse(fs.readFileSync(overrideConfigFile, "utf8").toString());
      defaultConfig.imjs_config_file_override = overrideConfigFile;
      Object.assign(defaultConfig, overrideConfig);
    }

    defaultConfig.imjs_config_file_default = defaultConfigFile;
    return defaultConfig;
  }

  /** Searches up the folder hierarchy, from the location of this file until the root directory, for the provided name of the configuration directory.
   */
  private static getConfigurationDir(configFolder: string): string {
    const parts: string[] = __dirname.split(path.sep).reverse();
    while (parts.length > 0) {
      const resolved = path.join(parts.slice().reverse().join(path.sep), configFolder);
      if (fs.existsSync(resolved))
        return resolved;
      parts.shift();
    }

    throw new Error(`Failed to find an iModel.js configuration file. Either set 'imjs_config_dir' env variable to point to the '${configFolder}' or put the folder '${configFolder}' next to repository that uses it.`);
  }

  private static getEnvFile(repositoryRootDir: string): any {
    const envFile = path.join(repositoryRootDir, ".env");
    if (!fs.existsSync(envFile)) {
      return;
    }

    const dotenv = require("dotenv"); // eslint-disable-line @typescript-eslint/no-var-requires
    const dotenvExpand = require("dotenv-expand"); // eslint-disable-line @typescript-eslint/no-var-requires
    const envResult = dotenv.config({ path: envFile });
    if (envResult.error) {
      throw envResult.error;
    }

    dotenvExpand(envResult);
  }

  /** During initialization the configuration is searched for across many locations.  If initialization has previously been called, then `process.env` is returned.
   *
   * If the environment variable `imjs_config_dir` is set, that directory will be searched first.  Otherwise, a directory named `imodeljs-config` will attempt to be
   * located anywhere up the folder hierarchy.
   *
   * > Whichever directory is successful in loading the configuration, is set as `process.env.imjs_config_dir`.
   *
   * Both directories will be searched for,
   *  - A file named `default.json5`
   *  - And if the env variable `imjs_config_env` is defined, the value will be used as the name of a file that is located in the same `imodeljs-config` directory as above.
   *    - Note: The value of the environment variable will be appended with `.json5`.  i.e. if `imjs_config_env=override`, the file `override.json5` will attempt to be located.
   *
   * The order the files above are parsed, and added to the config, is important because each one will override the previous values, if there are any overlaps.
   * The order of initialization is:
   *  1. `default.json5`
   *  1. `${imjs_config_env}.json5`
   *
   * If the "{imjs_config_env}.json5" file exists, the configuration is merged with the default configuration using `Object.assign`.  Meaning if there are
   * any configurations with the same key, the one specified in the "{imjs_config_env}.json5" will win.
   *
   * > If the `default.json5` is found and parsed successfully, the path to the config file will be added to the configuration with the key, `imjs_config_file_default`.
   * > If the `{imjs_config_env}.json5` is found, the path will be added with the key, `imjs_config_file_override`.
   *
   * @param suppressException whether or not an exception should be suppressed.  If true, no exception will be thrown.
   * @param suppressErrorMessage whether or not an error message will be printed to the console during an exception.  The `suppressException` parameter has no effect on the error message.
   * @param config
   * @public
   */
  public static init(suppressException: boolean = false, suppressErrorMessage: boolean = false, config?: any): any {
    const shellEnv = process.env;
    if (IModelJsConfig._repositoryPath || shellEnv.imjs_config_file_default)
      return shellEnv;

    let configRepository: string = "";

    if (undefined !== shellEnv && undefined !== shellEnv.imjs_config_dir) {
      const configDir = shellEnv.imjs_config_dir;
      if ("" !== configDir && fs.existsSync(configDir))
        configRepository = configDir.replace(/\/$/, "").replace(/\\$/, ""); // removes any trailing '/' or '\'
    }

    try {
      if ("" === configRepository)
        configRepository = IModelJsConfig.getConfigurationDir("imodeljs-config");

      const configuration: any = IModelJsConfig.getConfiguration(configRepository, shellEnv.imjs_config_env);
      // also set them as shell var
      Object.assign(process.env, configuration);

      // eslint-disable-next-line no-eval
      eval(`process.env.imjs_config_dir="${configRepository}"`);

      IModelJsConfig._repositoryPath = configRepository;
      if (undefined !== config)
        config.merge(shellEnv);
    } catch (err) {
      if (!suppressErrorMessage) {
        // eslint-disable-next-line no-console
        console.log(`${chalk.yellowBright(err.message)}`);
      }
      if (!suppressException)
        throw err;
    }

    try {
      IModelJsConfig.getEnvFile(configRepository);
    } catch (err) {
      if (!suppressErrorMessage) {
        // eslint-disable-next-line no-console
        console.log(`${chalk.yellowBright(err.message)}`);
      }
      if (!suppressException)
        throw err;
    }

    return shellEnv;
  }
}
