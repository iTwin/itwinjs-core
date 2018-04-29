/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import initLogging from "./logging";
import { Logger, OpenMode } from "@bentley/bentleyjs-core";
import { Config as ClientConfig } from "@bentley/imodeljs-clients";
import { BentleyCloudGatewayConfiguration, StandaloneIModelGateway, IModelReadGateway, GatewayOperation, IModelToken } from "@bentley/imodeljs-common";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { ECPresentation, ECPresentationGateway } from "@bentley/ecpresentation-frontend";
import SampleGateway from "./SampleGateway";

// initialize logging
initLogging();

// initialize ECPresentation
ECPresentation.initialize();

// Initialize my application gateway configuration for the frontend
const gateways = [StandaloneIModelGateway, IModelReadGateway, ECPresentationGateway, SampleGateway];
BentleyCloudGatewayConfiguration.initialize({ info: { title: "my-app", version: "v1.0" } }, gateways);
for (const gateway of gateways)
  GatewayOperation.forEach(gateway, (operation) => operation.policy.token = (_request) => new IModelToken("test", false, "test", "test")); // wtf?

// Configure a CORS proxy in development mode.
if (process.env.NODE_ENV === "development")
  ClientConfig.devCorsProxyServer = "http://localhost:" + process.env.CORS_PROXY_PORT; // By default, this will run on port 3001

export class MyAppFrontend {
  public static iModel: IModelConnection | undefined;

  public static async getSampleImodels(): Promise<string[]> {
    return await SampleGateway.getProxy().getSampleImodels();
  }

  public static async openIModel(path: string): Promise<IModelConnection> {
    this.iModel = await IModelConnection.openStandalone(path, OpenMode.Readonly);
    Logger.logInfo("ecpresentation", "Opened: " + this.iModel.name);
    return this.iModel;
  }
}
