/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { TestRunner, TestSetsProps } from "./TestRunner";
import {
  ClientRequestContext, Dictionary, Id64, Id64Arg, Id64String, OpenMode, ProcessDetector, SortedArray, StopWatch,
} from "@bentley/bentleyjs-core";
import { Project } from "@bentley/context-registry-client";
import { ElectronApp } from "@bentley/electron-manager/lib/ElectronFrontend";
import { BrowserAuthorizationClient, BrowserAuthorizationClientConfiguration } from "@bentley/frontend-authorization-client";
import { HubIModel } from "@bentley/imodelhub-client";
import {
  BackgroundMapProps, BackgroundMapType, BentleyCloudRpcManager, ColorDef, DisplayStyleProps, FeatureAppearance, FeatureAppearanceProps, Hilite,
  IModelReadRpcInterface, IModelTileRpcInterface, RenderMode, RpcConfiguration, SnapshotIModelRpcInterface, ViewDefinitionProps,
} from "@bentley/imodeljs-common";
import {
  AuthorizedFrontendRequestContext, DisplayStyle3dState, DisplayStyleState, EntityState, FeatureOverrideProvider, FeatureSymbology,
  FrontendRequestContext, GLTimerResult, IModelApp, IModelAppOptions, IModelConnection, NativeAppAuthorization, PerformanceMetrics, Pixel,
  RenderSystem, ScreenViewport, SnapshotConnection, Target, TileAdmin, Viewport, ViewRect, ViewState,
} from "@bentley/imodeljs-frontend";
import { System } from "@bentley/imodeljs-frontend/lib/webgl";
import { I18NOptions } from "@bentley/imodeljs-i18n";
import { AccessToken } from "@bentley/itwin-client";
import { ProjectShareClient, ProjectShareFile, ProjectShareFileQuery, ProjectShareFolderQuery } from "@bentley/projectshare-client";
import { HyperModeling } from "@bentley/hypermodeling-frontend";
import DisplayPerfRpcInterface from "../common/DisplayPerfRpcInterface";
import { initializeIModelHub } from "./ConnectEnv";
import { IModelApi } from "./IModelApi";

export class DisplayPerfTestApp {
  public static async startup(iModelApp?: IModelAppOptions): Promise<void> {
    iModelApp = iModelApp ?? {};
    iModelApp.i18n = { urlTemplate: "locales/en/{{ns}}.json" } as I18NOptions;

    iModelApp.rpcInterfaces = [DisplayPerfRpcInterface, IModelTileRpcInterface, SnapshotIModelRpcInterface, IModelReadRpcInterface];
    if (ProcessDetector.isElectronAppFrontend)
      await ElectronApp.startup({ iModelApp });
    else
      await IModelApp.startup(iModelApp);

    await HyperModeling.initialize();

    IModelApp.animationInterval = undefined;
  }
}

async function main() {
  try {
    const configStr = await DisplayPerfRpcInterface.getClient().getDefaultConfigs();
    const props = JSON.parse(configStr) as TestSetsProps;
    const runner = await TestRunner.create(props);
    await runner.run();
  } catch (err) {
    alert(err.toString());
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


