/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelHost } from "@bentley/imodeljs-backend";
import { Logger } from "@bentley/bentleyjs-core";
import { IModelTileRpcInterface, StandaloneIModelRpcInterface, IModelReadRpcInterface } from "@bentley/imodeljs-common";
import * as fs from "fs";
import * as path from "path";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // (needed temporarily to use self-signed cert to communicate with iModelBank via https)

export function getRpcInterfaces() {
  return [IModelTileRpcInterface, StandaloneIModelRpcInterface, IModelReadRpcInterface];
}

function setupStandaloneConfiguration() {
  const filename = process.env.SVT_STANDALONE_FILENAME;
  if (filename !== undefined) {
    const configuration: any = {};
    configuration.standalone = true;
    configuration.standalonePath = filename;
    configuration.viewName = process.env.SVT_STANDALONE_VIEWNAME; // optional
    configuration.iModelName = filename;
    fs.writeFileSync(path.join(__dirname, "public", "configuration.json"), JSON.stringify(configuration), "utf8");
  }
}

export function initializeBackend() {
  setupStandaloneConfiguration();

  IModelHost.startup();

  Logger.initializeToConsole(); // configure logging for imodeljs-core
}
