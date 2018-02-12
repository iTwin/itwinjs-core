/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import initLogging from "./logging";
import { ImsActiveSecureTokenClient, ImsDelegationSecureTokenClient, AuthorizationToken, AccessToken } from "@bentley/imodeljs-clients";
import { Config as ClientConfig } from "@bentley/imodeljs-clients/lib/Config";
import { IModelGateway } from "@bentley/imodeljs-frontend/lib/gateway/IModelGateway";
import ECPresentationGateway from "@bentley/ecpresentation-frontend/lib/frontend/ECPresentationGateway";
import { IModelConnection } from "@bentley/imodeljs-frontend/lib/frontend/IModelConnection";
import { Logger } from "@bentley/bentleyjs-core/lib/Logger";
import { BentleyCloudGatewayConfiguration } from "@bentley/imodeljs-frontend/lib/gateway/BentleyCloudGatewayConfiguration";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { IModelVersion } from "@bentley/imodeljs-frontend/lib/common/IModelVersion";

// initialize logging
initLogging();

// Initialize my application gateway configuration for the frontend
BentleyCloudGatewayConfiguration.initialize({ info: { title: "my-app", version: "v1.0" } }, [IModelGateway, ECPresentationGateway]);

// Configure a CORS proxy in development mode.
if (process.env.NODE_ENV === "development")
  ClientConfig.devCorsProxyServer = "http://localhost:" + process.env.CORS_PROXY_PORT; // By default, this will run on port 3001

/** Demonstrates frontend application logic that will be running in a web browser. */
export class MyAppFrontend {
  /** The current open IModelConnection. Will be `undefined` until [[openIModel]] is called. */
  public static iModel: IModelConnection | undefined;

  private static readonly AUTH_CLIENT = new ImsActiveSecureTokenClient("QA");
  private static readonly ACCESS_CLIENT = new ImsDelegationSecureTokenClient("QA");

  /** Logs in to IMS and returns an AccessToken. */
  private static async imsLogin(): Promise<AccessToken> {
    /* spell-checker:disable */
    const email = "bistroDEV_pmadm1@mailinator.com"; // Using test user for now
    const password = "pmadm1";
    /* spell-checker:enable */

    const authToken: AuthorizationToken = await MyAppFrontend.AUTH_CLIENT.getToken(email, password);
    const accessToken: AccessToken = await MyAppFrontend.ACCESS_CLIENT.getToken(authToken);
    return accessToken;
  }

  /** Opens an IModelConnection to the iModel of the specified name. */
  public static async openIModel(iModelName: string): Promise<void> {
    if (this.iModel && this.iModel.name === iModelName)
      return;

    const accessToken = await this.imsLogin();
    this.iModel = await IModelConnection.open(accessToken, "8d8b93b0-2aa2-4d0a-8505-46153bf71719", iModelName, OpenMode.Readonly, IModelVersion.latest());
    Logger.logInfo("ecpresentation", "Opened: " + this.iModel.name);
  }

  /** Returns the name (CodeValue) of the current iModel's root subject element. */
  public static async getRootSubjectName(): Promise<string> {
    if (!this.iModel)
      throw new Error("iModel was never opened!");

    const rootSubjectProps = await this.iModel.elements.getElementProps([this.iModel.elements.rootSubjectId]);
    return rootSubjectProps[0].code!.value!;
  }
}
