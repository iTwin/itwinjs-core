/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
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
      Object.assign(defaultConfig, overrideConfig);
    }
    return defaultConfig;
  }

  private static getConfigurationDir(repositoryName: string, configFolder?: string): string {
    let repositoryRootDir;
    if (process.env.imjs_config_dir) {
      if (fs.existsSync(process.env.imjs_config_dir)) {
        repositoryRootDir = process.env.imjs_config_dir.replace(/\/$/, "").replace(/\\$/, "");
      }
    }
    if (!repositoryRootDir) {
      const parts: string[] = __dirname.split(path.sep);
      for (let i = 0; i < parts.length; i++) {
        if (parts[i] === repositoryName) {
          repositoryRootDir = parts.slice(0, i + 1).join(path.sep) + path.sep + ".." + path.sep + configFolder!;
          break;
        }
      }
    }
    if (!repositoryRootDir || !fs.existsSync(repositoryRootDir)) {
      throw new Error(`Fail to find configuration for imodeljs at '${repositoryRootDir}'. Either set 'imjs_config_dir' env variable to point to the '${configFolder}' or put the folder '${configFolder}' at same level '${repositoryName}' repository for auto discovery to work.`);
    }
    return repositoryRootDir;
  }
  public static init(suppressError: boolean = false, config?: any): any {
    if (IModelJsConfig._repositoryPath)
      return;

    try {
      const configRepository = IModelJsConfig.getConfigurationDir("imodeljs", "imodeljs-config");
      const configuration = IModelJsConfig.getConfiguration(configRepository, process.env.imjs_config_env);
      // also set them as shell var
      Object.assign(process.env, configuration);
      process.env.imjs_config_dir = configRepository;
      IModelJsConfig._repositoryPath = configRepository;
      if (config) {
        config.merge(process.env);
      }
      return process.env;
    } catch (err) {
      // tslint:disable-next-line:no-console
      console.log(`${chalk.default.redBright(err.message)}`);
      if (!suppressError) {
        throw err;
      }
      return process.env;
    }
  }
}
