/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import initLogging from "./logging";
import { Logger, OpenMode } from "@bentley/bentleyjs-core";
import { Config as ClientConfig } from "@bentley/imodeljs-clients";
import { BentleyCloudRpcManager, StandaloneIModelRpcInterface, IModelReadRpcInterface, RpcOperation, IModelToken, BentleyCloudRpcParams } from "@bentley/imodeljs-common";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import SampleRpcInterface from "../../common/SampleRpcInterface";

// initialize logging
initLogging();

// __PUBLISH_EXTRACT_START__ Frontend.Initialization.ECPresentation
import { ECPresentation } from "@bentley/ecpresentation-frontend";
ECPresentation.initialize();
// __PUBLISH_EXTRACT_END__

const rpcParams: BentleyCloudRpcParams = { info: { title: "my-app", version: "v1.0" } };
const otherRpcInterfaces = [StandaloneIModelRpcInterface, IModelReadRpcInterface, SampleRpcInterface];
// __PUBLISH_EXTRACT_START__ Frontend.Initialization.RpcInterface
import { ECPresentationRpcInterface } from "@bentley/ecpresentation-common";
BentleyCloudRpcManager.initializeClient(rpcParams, [...otherRpcInterfaces, ECPresentationRpcInterface]);
// __PUBLISH_EXTRACT_END__

const interfaces = [...otherRpcInterfaces, ECPresentationRpcInterface];
for (const def of interfaces)
  RpcOperation.forEach(def, (operation) => operation.policy.token = (_request) => new IModelToken("test", false, "test", "test"));

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
