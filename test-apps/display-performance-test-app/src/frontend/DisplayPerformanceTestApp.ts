/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { TestRunner, TestSetsProps } from "./TestRunner";
import { ProcessDetector } from "@itwin/core-bentley";
import { ElectronApp } from "@itwin/electron-manager/lib/ElectronFrontend";
import {
  BentleyCloudRpcManager, IModelReadRpcInterface, IModelTileRpcInterface, RpcConfiguration, SessionProps, SnapshotIModelRpcInterface,
} from "@itwin/core-common";
import { IModelApp, IModelAppOptions, NativeAppAuthorization } from "@itwin/core-frontend";
import { BrowserAuthorizationClient, BrowserAuthorizationClientConfiguration } from "@bentley/frontend-authorization-client";
import { I18NOptions } from "@itwin/core-i18n";
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
    iModelApp.i18n = { urlTemplate: "locales/en/{{ns}}.json" } as I18NOptions;
    iModelApp.tileAdmin = {
      minimumSpatialTolerance: 0,
      cesiumIonKey: process.env.IMJS_CESIUM_ION_KEY,
    };

    /* eslint-disable @typescript-eslint/naming-convention */
    iModelApp.mapLayerOptions = {
      MapBoxImagery: process.env.IMJS_MAPBOX_KEY ? { key: "access_token", value: process.env.IMJS_MAPBOX_KEY } : undefined,
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
}

async function createOidcClient(sessionProps: SessionProps): Promise<NativeAppAuthorization | BrowserAuthorizationClient> {
  const scope = "openid email profile organization itwinjs";

  if (ProcessDetector.isElectronAppFrontend) {
    const clientId = "imodeljs-electron-test";
    const redirectUri = "http://localhost:3000/signin-callback";
    const oidcConfiguration = { clientId, redirectUri, scope: `${scope} offline_access` };
    const desktopClient = new NativeAppAuthorization(oidcConfiguration);
    await desktopClient.initialize(sessionProps);
    return desktopClient;
  } else {
    const clientId = "imodeljs-spa-test";
    const redirectUri = "http://localhost:3000/signin-callback";
    const oidcConfiguration: BrowserAuthorizationClientConfiguration = { clientId, redirectUri, scope: `${scope} imodeljs-router`, responseType: "code" };
    const browserClient = new BrowserAuthorizationClient(oidcConfiguration);
    return browserClient;
  }
}

// Wraps the signIn process
// In the case of use in web applications:
// - called the first time to start the signIn process - resolves to false
// - called the second time as the Authorization provider redirects to cause the application to refresh/reload - resolves to false
// - called the third time as the application redirects back to complete the authorization - finally resolves to true
// In the case of use in electron applications:
// - promise wraps around a registered call back and resolves to true when the sign in is complete
// @return Promise that resolves to true only after signIn is complete. Resolves to false until then.
async function signIn(): Promise<boolean> {
  const oidcClient = await createOidcClient({
    applicationId: IModelApp.applicationId,
    applicationVersion: IModelApp.applicationVersion,
    sessionId: IModelApp.sessionId,
  });

  IModelApp.authorizationClient = oidcClient;
  if ((await oidcClient.getAccessToken()) !== undefined)
    return true;

  const retPromise = new Promise<boolean>((resolve, _reject) => {
    oidcClient.onAccessTokenChanged.addListener((token) => {
      resolve(token !== "");
    });
  });

  await oidcClient.signIn();
  return retPromise;
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
