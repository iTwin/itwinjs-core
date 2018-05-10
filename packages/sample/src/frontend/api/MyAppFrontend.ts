/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import initLogging from "./logging";
import { Logger, OpenMode } from "@bentley/bentleyjs-core";
import { Config as ClientConfig } from "@bentley/imodeljs-clients";
import { BentleyCloudRpcManager, StandaloneIModelRpcInterface, IModelReadRpcInterface, RpcOperation, IModelToken } from "@bentley/imodeljs-common";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { ECPresentationRpcInterface } from "@bentley/ecpresentation-common";
import { ECPresentation } from "@bentley/ecpresentation-frontend";
import SampleRpcInterface from "../../common/SampleRpcInterface";

// initialize logging
initLogging();

// initialize ECPresentation
ECPresentation.initialize();

// Initialize my application RPC for the frontend
const interfaces = [StandaloneIModelRpcInterface, IModelReadRpcInterface, ECPresentationRpcInterface, SampleRpcInterface];
BentleyCloudRpcManager.initializeClient({ info: { title: "my-app", version: "v1.0" } }, interfaces);
for (const def of interfaces)
  RpcOperation.forEach(def, (operation) => operation.policy.token = (_request) => new IModelToken("test", false, "test", "test")); // wtf?

// Configure a CORS proxy in development mode.
if (process.env.NODE_ENV === "development")
  ClientConfig.devCorsProxyServer = "http://localhost:" + process.env.CORS_PROXY_PORT; // By default, this will run on port 3001

export class MyAppFrontend {
  public static iModel: IModelConnection | undefined;

  public static async getSampleImodels(): Promise<string[]> {
    return await SampleRpcInterface.getClient().getSampleImodels();
  }

  public static async openIModel(path: string): Promise<IModelConnection> {
    this.iModel = await IModelConnection.openStandalone(path, OpenMode.Readonly);
    Logger.logInfo("ecpresentation", "Opened: " + this.iModel.name);
    return this.iModel;
  }
}
