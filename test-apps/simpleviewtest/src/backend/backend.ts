/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { IModelHost, IModelHostConfiguration } from "@bentley/imodeljs-backend";
import { Logger } from "@bentley/bentleyjs-core";
import { IModelTileRpcInterface, StandaloneIModelRpcInterface, IModelReadRpcInterface } from "@bentley/imodeljs-common";
import * as fs from "fs";
import * as path from "path";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import { IModelBankClient } from "@bentley/imodeljs-clients/lib/IModelBank/IModelBankClient";
import { UrlFileHandler } from "@bentley/imodeljs-clients/lib/UrlFileHandler";
import { SVTConfiguration } from "../common/SVTConfiguration";
import { Config } from "@bentley/imodeljs-clients";

IModelJsConfig.init(false /* suppress exception */, false /* suppress error message */, Config.App);
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // (needed temporarily to use self-signed cert to communicate with iModelBank via https)

export function getRpcInterfaces() {
  return [IModelTileRpcInterface, StandaloneIModelRpcInterface, IModelReadRpcInterface];
}

function setupStandaloneConfiguration() {
  const filename = process.env.SVT_STANDALONE_FILENAME;
  if (filename !== undefined) {
    const configuration: any = {};
    configuration.standalone = true;
    configuration.standalonePath = process.env.SVT_STANDALONE_FILEPATH; // optional (browser-use only)
    configuration.viewName = process.env.SVT_STANDALONE_VIEWNAME; // optional
    configuration.iModelName = filename;
    fs.writeFileSync(path.join(__dirname, "public", "configuration.json"), JSON.stringify(configuration), "utf8");
  }
}

export function initializeBackend() {
  setupStandaloneConfiguration();

  const hostConfig = new IModelHostConfiguration();
  // tslint:disable-next-line:no-var-requires
  const svtConfig: SVTConfiguration = require("./public/configuration.json");
  if (svtConfig.customOrchestratorUri)
    hostConfig.imodelClient = new IModelBankClient(svtConfig.customOrchestratorUri, new UrlFileHandler());

  IModelHost.startup(hostConfig);

  Logger.initializeToConsole(); // configure logging for imodeljs-core
}
