/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { RpcInterface, RpcManager } from "@bentley/imodeljs-common";
import * as https from "https";
import * as http from "http";

/** Display Performance RPC interface. */
export default class DisplayPerfRpcInterface extends RpcInterface {
  /** The version of the interface. */
  public static version = "1.0.0";

  /** Full path of the json file; will use the default json file instead if this file cannot be found */
  public static jsonFilePath = "";

  /** The backend server, when running on a browser */
  public static webServer: http.Server | https.Server;

  /** The types that can be marshaled by the interface. */
  public static types = () => [];

  public static getClient(): DisplayPerfRpcInterface { return RpcManager.getClientForInterface(DisplayPerfRpcInterface); }

  public async getDefaultConfigs(): Promise<string> { return this.forward(arguments); }
  public async saveCsv(_outputPath: string, _outputName: string, _rowData: Map<string, number | string>): Promise<void> { return this.forward(arguments); }
  public async savePng(_fileName: string, _png: string): Promise<void> { return this.forward(arguments); }

  public async finishTest(): Promise<void> { return this.forward.apply(this, arguments); }
}
