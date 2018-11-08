/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import DisplayPerfRpcInterface from "../common/DisplayPerfRpcInterface";
import { RpcManager } from "@bentley/imodeljs-common";
import * as fs from "fs";

/** The backend implementation of DisplayPerfRpcImpl. */
export default class DisplayPerfRpcImpl extends DisplayPerfRpcInterface {

  public async getDefaultConfigs(): Promise<string> {
    let jsonStr = "";
    const defaultJsonFile = "./src/backend/DefaultConfig.json";
    if (fs.existsSync(DisplayPerfRpcInterface.jsonFilePath)) {
      console.log("DisplayPerfRpcInterface.jsonFilePath: " + DisplayPerfRpcInterface.jsonFilePath); // tslint:disable-line
      jsonStr = fs.readFileSync(DisplayPerfRpcInterface.jsonFilePath).toString();
    } else if (fs.existsSync(defaultJsonFile)) {
      console.log("defaultJsonFile: " + defaultJsonFile); // tslint:disable-line
      jsonStr = fs.readFileSync(defaultJsonFile).toString();
    }
    return jsonStr;
  }
}

/** Auto-register the impl when this file is included. */
RpcManager.registerImpl(DisplayPerfRpcInterface, DisplayPerfRpcImpl);
