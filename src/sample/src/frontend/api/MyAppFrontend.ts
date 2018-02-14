/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import initLogging from "./logging";
import { Config as ClientConfig } from "@bentley/imodeljs-clients/lib/Config";
import { IModelGateway } from "@bentley/imodeljs-frontend/lib/gateway/IModelGateway";
import ECPresentationGateway from "@bentley/ecpresentation-frontend/lib/frontend/ECPresentationGateway";
import SampleGateway from "./SampleGateway";
import { IModelConnection } from "@bentley/imodeljs-frontend/lib/frontend/IModelConnection";
import { Logger } from "@bentley/bentleyjs-core/lib/Logger";
import { BentleyCloudGatewayConfiguration } from "@bentley/imodeljs-frontend/lib/gateway/BentleyCloudGatewayConfiguration";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";

// initialize logging
initLogging();

// Initialize my application gateway configuration for the frontend
BentleyCloudGatewayConfiguration.initialize({ info: { title: "my-app", version: "v1.0" } },
  [IModelGateway, ECPresentationGateway, SampleGateway]);

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
