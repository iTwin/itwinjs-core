/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ProcessDetector } from "@itwin/core-bentley";
import { IModelReadRpcInterface, IModelTileRpcInterface, SnapshotIModelRpcInterface } from "@itwin/core-common";
import { BentleyCloudRpcManager, RpcConfiguration } from "@itwin/core-rpc-common";
import { ElectronApp } from "@itwin/core-electron/lib/cjs/ElectronFrontend";
import { ElectronRendererAuthorization } from "@itwin/electron-authorization/lib/cjs/ElectronRenderer";
import { BrowserAuthorizationClient } from "@itwin/browser-authorization/lib/cjs/Client";
import { IModelApp, IModelAppOptions } from "@itwin/core-frontend";
import { HyperModeling, SectionMarker, SectionMarkerHandler } from "@itwin/hypermodeling-frontend";
import { FrontendIModelsAccess } from "@itwin/imodels-access-frontend";
import { IModelsClient } from "@itwin/imodels-client-management";
import DisplayPerfRpcInterface from "../common/DisplayPerfRpcInterface";
import { TestRunner, TestSetsProps } from "./TestRunner";

/** Prevents the hypermodeling markers from displaying in the viewport and obscuring the image. */
class MarkerHandler extends SectionMarkerHandler {
  public override isMarkerVisible(_marker: SectionMarker) {
    return false;
  }
}

export class DisplayPerfTestApp {
  public static async startup(iModelApp?: IModelAppOptions): Promise<void> {
    iModelApp = iModelApp ?? {};
    if (iModelApp.tileAdmin === undefined) {
      iModelApp.tileAdmin = {
        minimumSpatialTolerance: 0,
        cesiumIonKey: process.env.IMJS_CESIUM_ION_KEY,
      };
    } else {
      iModelApp.tileAdmin.minimumSpatialTolerance = 0;
      iModelApp.tileAdmin.cesiumIonKey = process.env.IMJS_CESIUM_ION_KEY;
    }

    /* eslint-disable @typescript-eslint/naming-convention */
    iModelApp.mapLayerOptions = {
      MapboxImagery: process.env.IMJS_MAPBOX_KEY ? { key: "access_token", value: process.env.IMJS_MAPBOX_KEY } : undefined,
      BingMaps: process.env.IMJS_BING_MAPS_KEY ? { key: "key", value: process.env.IMJS_BING_MAPS_KEY } : undefined,
    };
    /* eslint-enable @typescript-eslint/naming-convention */

    iModelApp.hubAccess = process.env.IMJS_URL_PREFIX
      ? new FrontendIModelsAccess(new IModelsClient({ api: { baseUrl: `https://${process.env.IMJS_URL_PREFIX}api.bentley.com/imodels` } }))
      : new FrontendIModelsAccess();

    iModelApp.rpcInterfaces = [DisplayPerfRpcInterface, IModelTileRpcInterface, SnapshotIModelRpcInterface, IModelReadRpcInterface];
    if (ProcessDetector.isElectronAppFrontend)
      await ElectronApp.startup({ iModelApp });
    else
      await IModelApp.startup(iModelApp);

    await HyperModeling.initialize({ markerHandler: new MarkerHandler() });

    IModelApp.animationInterval = undefined;
  }

  public static async logException(ex: any, logFile?: { dir: string, name: string }): Promise<void> {
    const errMsg = ex.stack ?? (ex.toString ? ex.toString() : "unknown error type");
    const msg = `DPTA_EXCEPTION\n${errMsg}\n`;
    const client = DisplayPerfRpcInterface.getClient();
    await client.consoleLog(msg);
    if (logFile)
      await client.writeExternalFile(logFile.dir, logFile.name, true, msg);
  }
}

async function signIn(): Promise<void> {
  if (process.env.IMJS_OIDC_HEADLESS)
    return;
  let authorizationClient;
  if (ProcessDetector.isElectronAppFrontend)
    authorizationClient = new ElectronRendererAuthorization();
  else
    authorizationClient = new BrowserAuthorizationClient({
      clientId: process.env.IMJS_OIDC_CLIENT_ID!,
      scope: process.env.IMJS_OIDC_SCOPE!,
      redirectUri: process.env.IMJS_OIDC_REDIRECT_URI!,
    });
  await authorizationClient.signIn();
  IModelApp.authorizationClient = authorizationClient;
}

async function main() {
  try {
    const configStr = await DisplayPerfRpcInterface.getClient().getDefaultConfigs();
    const props = JSON.parse(configStr) as TestSetsProps;

    if (props.signIn)
      await signIn();

    const runner = new TestRunner(props);
    await runner.run();
  } catch (err: any) {
    await DisplayPerfTestApp.logException(err);
  } finally {
    await DisplayPerfRpcInterface.getClient().terminate();
  }

  return IModelApp.shutdown();
}

window.onload = async () => {
  // Choose RpcConfiguration based on whether we are in electron or browser
  RpcConfiguration.developmentMode = true;
  RpcConfiguration.disableRoutingValidation = true;

  if (!ProcessDetector.isElectronAppFrontend && !ProcessDetector.isMobileAppFrontend) {
    const uriPrefix = "http://localhost:3001";
    BentleyCloudRpcManager.initializeClient({ info: { title: "DisplayPerformanceTestApp", version: "v1.0" }, uriPrefix }, [DisplayPerfRpcInterface, IModelTileRpcInterface, SnapshotIModelRpcInterface, IModelReadRpcInterface]);
  }

  await DisplayPerfTestApp.startup();
  await main();
};
