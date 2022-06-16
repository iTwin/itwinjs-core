/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { TestRunner, TestSetsProps } from "./TestRunner";
import { ProcessDetector } from "@itwin/core-bentley";
import { ElectronApp } from "@itwin/core-electron/lib/cjs/ElectronFrontend";
import {
  BentleyCloudRpcManager, IModelReadRpcInterface, IModelTileRpcInterface, RpcConfiguration, SnapshotIModelRpcInterface,
} from "@itwin/core-common";
import { IModelApp, IModelAppOptions } from "@itwin/core-frontend";
import { HyperModeling, SectionMarker, SectionMarkerHandler } from "@itwin/hypermodeling-frontend";
import DisplayPerfRpcInterface from "../common/DisplayPerfRpcInterface";
import { FrontendIModelsAccess } from "@itwin/imodels-access-frontend";
import { TestFrontendAuthorizationClient } from "@itwin/oidc-signin-tool/lib/cjs/TestFrontendAuthorizationClient";
import { IModelsClient } from "@itwin/imodels-client-management";

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

    const token = await DisplayPerfRpcInterface.getClient().getAccessToken();
    if(token) {
      iModelApp.authorizationClient = new TestFrontendAuthorizationClient(token);
      if(process.env.IMJS_URL_PREFIX)
        iModelApp.hubAccess = new FrontendIModelsAccess(new IModelsClient({
          api: {
            baseUrl: `https://${process.env.IMJS_URL_PREFIX}api.bentley.com/imodels`,
          },
        }));
      else
        iModelApp.hubAccess = new FrontendIModelsAccess();
    }

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

async function main() {
  try {
    const configStr = await DisplayPerfRpcInterface.getClient().getDefaultConfigs();
    const props = JSON.parse(configStr) as TestSetsProps;
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
