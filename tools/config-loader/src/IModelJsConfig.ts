/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as JSON5 from "json5";
import * as fs from "fs";
import * as path from "path";
import * as chalk from "chalk";

export class IModelJsConfig {
  private static _repositoryPath: string;
  private static getConfiguration(repositoryRootDir: string, overrideConfigName?: string): string {
    const fileExtension = ".json5";
    const defaultConfigFile = repositoryRootDir + path.sep + "default" + fileExtension;
    if (!fs.existsSync(defaultConfigFile)) {
      throw new Error(`Could not find default${fileExtension} at ${repositoryRootDir}. This file must exist.`);
    }
    const defaultConfig = JSON5.parse(fs.readFileSync(defaultConfigFile, "utf8").toString());
    // override default with another config
    if (overrideConfigName) {
      const overrideConfigFile = repositoryRootDir + path.sep + overrideConfigName! + fileExtension;
      if (!fs.existsSync(overrideConfigFile)) {
        throw new Error(`Could not find config file ${overrideConfigFile}`);
      }
      const overrideConfig: object = JSON5.parse(fs.readFileSync(overrideConfigFile, "utf8").toString());
      defaultConfig.imjs_config_file_override = overrideConfigFile;
      Object.assign(defaultConfig, overrideConfig);
    }

    defaultConfig.imjs_config_file_default = defaultConfigFile;
    return defaultConfig;
  }
  // This function go along up the hierarchy and look for configFolder
  private static getConfigurationDir(configFolder: string): string {
    let repositoryRootDir;
    // tslint:disable-next-line:no-eval
    const configDir = eval("process.env.imjs_config_dir") as string;
    if (configDir) {
      if (fs.existsSync(configDir)) {
        repositoryRootDir = configDir.replace(/\/$/, "").replace(/\\$/, "");
      }
    }
    if (!repositoryRootDir) {
      const parts: string[] = __dirname.split(path.sep).reverse();
      while (parts.length > 0) {
        const resolved = path.join(parts.slice().reverse().join(path.sep), configFolder);
        if (fs.existsSync(resolved)) {
          repositoryRootDir = resolved;
          break;
        }
        parts.shift();
      }
    }
    if (!repositoryRootDir || !fs.existsSync(repositoryRootDir)) {
      throw new Error(`Failed to find configuration for imodeljs at '${repositoryRootDir}'. Either set 'imjs_config_dir' env variable to point to the '${configFolder}' or put the folder '${configFolder}' next to repository that uses it.`);
    }

    // tslint:disable-next-line:no-console
    console.log(`Found configuration folder at: ${chalk.default.bold(repositoryRootDir)}`);
    return repositoryRootDir;
  }
  public static init(suppressError: boolean = false, config?: any): any {
    const shellEnv = process.env;
    if (IModelJsConfig._repositoryPath || shellEnv.imjs_config_file_default)
      return shellEnv;

    try {
      const configRepository = IModelJsConfig.getConfigurationDir("imodeljs-config");
      const configuration = IModelJsConfig.getConfiguration(configRepository, shellEnv.imjs_config_env);
      // also set them as shell var
      Object.assign(process.env, configuration);
      // tslint:disable-next-line:no-eval
      eval(`process.env.imjs_config_dir="${configRepository}"`);
      // process.env.imjs_config_dir = configRepository;
      IModelJsConfig._repositoryPath = configRepository;
      if (config) {
        config.merge(shellEnv);
      }
    } catch (err) {
      // tslint:disable-next-line:no-console
      console.log(`${chalk.default.redBright(err.message)}`);
      if (!suppressError) {
        throw err;
      }
    }
    return shellEnv;
  }
}
