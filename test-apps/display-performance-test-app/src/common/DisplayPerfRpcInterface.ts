/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chromeLauncher from "chrome-launcher";
import * as http from "http";
import * as https from "https";
import { IModelConnectionProps, RpcInterface, RpcManager, RpcOperation, RpcRequestTokenSupplier_T } from "@itwin/core-common";
import { DptaEnvConfig } from "./DisplayPerfEnvConfig";

const localDeploymentOnly: RpcRequestTokenSupplier_T = () => ({ iModelId: "none", key: "" });

/** Display Performance RPC interface. */
export default class DisplayPerfRpcInterface extends RpcInterface {
  /** The immutable name of the interface. */
  public static readonly interfaceName = "DisplayPerfRpcInterface";

  /** The version of the interface. */
  public static interfaceVersion = "1.0.0";

  /** Full path of the json file; will use the default json file instead if this file cannot be found */
  public static jsonFilePath = "";

  /** The backend server, when running on a browser */
  public static backendServer: http.Server | https.Server;
  public static webServer: http.Server | https.Server;

  /** A chrome browser window, when testing with chrome */
  public static chrome?: chromeLauncher.LaunchedChrome;

  public static getClient(): DisplayPerfRpcInterface { return RpcManager.getClientForInterface(DisplayPerfRpcInterface); }

  public async openSnapshot(_filePath: string): Promise<IModelConnectionProps> { return this.forward(arguments); }
  public async closeIModel(_iModelKey: string): Promise<void> { return this.forward(arguments); }

  @RpcOperation.setRoutingProps(localDeploymentOnly)
  public async getDefaultConfigs(): Promise<string> { return this.forward(arguments); }

  public async saveCsv(_outputPath: string, _outputName: string, _rowDataJson: string, _csvFormat?: string): Promise<void> { return this.forward(arguments); }
  public async savePng(_fileName: string, _png: string): Promise<void> { return this.forward(arguments); }

  @RpcOperation.setRoutingProps(localDeploymentOnly)
  public async writeExternalFile(_outputPath: string, _outputName: string, _append: boolean, _content: string): Promise<void> { return this.forward(arguments); }

  @RpcOperation.setRoutingProps(localDeploymentOnly)
  public async consoleLog(_content: string): Promise<void> { return this.forward(arguments); }

  public async finishCsv(_output: string, _outputPath?: string, _outputName?: string, _csvFormat?: string): Promise<void> { return this.forward(arguments); }
  public async terminate(): Promise<void> { return this.forward(arguments); }

  public async readExternalSavedViews(_filename: string): Promise<string> { return this.forward(arguments); }
  public async getMatchingFiles(_rootDir: string, _pattern: string): Promise<string> { return this.forward(arguments); }

  public async getAccessToken(): Promise<string> { return this.forward(arguments); }

  public async getEnvConfig(): Promise<DptaEnvConfig> { return this.forward(arguments); }
}
