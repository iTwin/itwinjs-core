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

async function initializeRemoteIModels(props: TestSetsProps): Promise<void> {
  /** iModelId -> savedViewNames */
  const remoteModelsViews = new Map<string, Set<string>>();
  for(const testSet of props.testSet) {
    if(testSet.iModelId === undefined)
      continue; // Not remote

    const externalViews: string[] = [];
    for(const test of testSet.tests)
      if(test.extViewName !== undefined)
        externalViews.push(test.extViewName);

    const thisModelViews = remoteModelsViews.get(testSet.iModelId);
    if(thisModelViews === undefined)
      remoteModelsViews.set(testSet.iModelId, new Set(externalViews));
    else
      externalViews.forEach((v) => { thisModelViews.add(v); });
  }
  if(remoteModelsViews.size < 1)
    return;

  const iTwinId = props.iTwinId;
  if(iTwinId === undefined)
    throw new Error("Missing iTwinId in config for remote iModels");

  const rpcClient = DisplayPerfRpcInterface.getClient();
  await Promise.all(Array.from(remoteModelsViews).map(async ([iModelId, savedViewNames]) =>
    rpcClient.initializeRemoteIModel(iTwinId, iModelId, Array.from(savedViewNames))
  ));
}

async function main() {
  try {
    // TODO
    await DisplayPerfRpcInterface.getClient().consoleLog("DPTA main");

    const configStr = await DisplayPerfRpcInterface.getClient().getDefaultConfigs();
    const props = JSON.parse(configStr) as TestSetsProps;

    await initializeRemoteIModels(props);

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
