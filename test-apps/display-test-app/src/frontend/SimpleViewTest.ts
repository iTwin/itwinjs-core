/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { OpenMode } from "@bentley/bentleyjs-core";
import {
  BentleyCloudRpcManager,
  CloudStorageContainerUrl,
  CloudStorageTileCache,
  ElectronRpcConfiguration,
  ElectronRpcManager,
  IModelReadRpcInterface,
  IModelTileRpcInterface,
  IModelToken,
  MobileRpcConfiguration,
  MobileRpcManager,
  NativeAppRpcInterface,
  OidcDesktopClientConfiguration,
  RpcConfiguration,
  RpcInterfaceDefinition,
  RpcOperation,
  SnapshotIModelRpcInterface,
  TileContentIdentifier,
} from "@bentley/imodeljs-common";
import { OidcFrontendClientConfiguration, IOidcFrontendClient, AccessToken } from "@bentley/imodeljs-clients";
import {
  FrontendRequestContext,
  IModelApp,
  IModelConnection,
  OidcBrowserClient,
  RenderDiagnostics,
  RenderSystem,
  OidcDesktopClientRenderer,
  SnapshotConnection,
} from "@bentley/imodeljs-frontend";
import { WebGLExtensionName } from "@bentley/webgl-compatibility";
import { showStatus } from "./Utils";
import { SVTConfiguration } from "../common/SVTConfiguration";
import { DisplayTestApp } from "./App";
import SVTRpcInterface from "../common/SVTRpcInterface";
import { setTitle } from "./Title";
import { Surface } from "./Surface";
import { Dock } from "./Window";

RpcConfiguration.developmentMode = true; // needed for snapshots in web apps

const configuration = {} as SVTConfiguration;

// Retrieves the configuration for starting SVT from configuration.json file located in the built public folder
async function retrieveConfiguration(): Promise<void> {
  return new Promise<void>((resolve, _reject) => {
    if (MobileRpcConfiguration.isMobileFrontend) {
      const newConfigurationInfo = JSON.parse(window.localStorage.getItem("imodeljs:env")!);
      Object.assign(configuration, newConfigurationInfo);
      resolve();
    } else {
      const request: XMLHttpRequest = new XMLHttpRequest();
      request.open("GET", "configuration.json");
      request.setRequestHeader("Cache-Control", "no-cache");
      request.onreadystatechange = ((_event: Event) => {
        if (request.readyState === XMLHttpRequest.DONE) {
          if (request.status === 200) {
            const newConfigurationInfo: any = JSON.parse(request.responseText);
            Object.assign(configuration, newConfigurationInfo);
            resolve();
          }
        }
      });
      request.send();
    }
  });
}

// opens the configured iModel from disk
async function openSnapshotIModel(filename: string): Promise<IModelConnection> {
  configuration.standalone = true;
  const iModelConnection = await SnapshotConnection.open(filename);
  configuration.iModelName = iModelConnection.name;
  return iModelConnection;
}

function createOidcClient(): IOidcFrontendClient {
  let oidcClient: IOidcFrontendClient;
  const scope = "openid email profile organization imodelhub context-registry-service:read-only reality-data:read product-settings-service projectwise-share urlps-third-party";
  if (ElectronRpcConfiguration.isElectron) {
    const clientId = "imodeljs-electron-test";
    const redirectUri = "http://localhost:3000/signin-callback";
    const oidcConfiguration: OidcDesktopClientConfiguration = { clientId, redirectUri, scope: scope + " offline_access" };
    oidcClient = new OidcDesktopClientRenderer(oidcConfiguration);
  } else {
    const clientId = "imodeljs-spa-test";
    const redirectUri = "http://localhost:3000/signin-callback";
    const oidcConfiguration: OidcFrontendClientConfiguration = { clientId, redirectUri, scope: scope + " imodeljs-router", responseType: "code" };
    oidcClient = new OidcBrowserClient(oidcConfiguration);
  }
  return oidcClient;
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
  const oidcClient: IOidcFrontendClient = createOidcClient();

  const requestContext = new FrontendRequestContext();
  await oidcClient.initialize(requestContext);
  IModelApp.authorizationClient = oidcClient;
  if (oidcClient.isAuthorized)
    return true;

  const retPromise = new Promise<boolean>((resolve, _reject) => {
    oidcClient.onUserStateChanged.addListener((token: AccessToken | undefined) => {
      resolve(token !== undefined);
    });
  });

  await oidcClient.signIn(requestContext);
  return retPromise;
}

class FakeTileCache extends CloudStorageTileCache {
  public constructor() { super(); }

  protected async requestResource(container: CloudStorageContainerUrl, id: TileContentIdentifier): Promise<Response> {
    const init: RequestInit = {
      headers: container.headers,
      method: "GET",
    };

    const url = container.url + `/${this.formResourceName(id)}`;
    return fetch(url, init);
  }
}

// main entry point.
async function main() {
  // retrieve, set, and output the global configuration variable
  await retrieveConfiguration(); // (does a fetch)
  console.log("Configuration", JSON.stringify(configuration)); // tslint:disable-line:no-console

  // Start the app. (This tries to fetch a number of localization json files from the origin.)
  const renderSystemOptions: RenderSystem.Options = {
    disabledExtensions: configuration.disabledExtensions as WebGLExtensionName[],
    preserveShaderSourceCode: true === configuration.preserveShaderSourceCode,
    logarithmicDepthBuffer: false !== configuration.logarithmicZBuffer,
    filterMapTextures: true === configuration.filterMapTextures,
    filterMapDrapeTextures: false !== configuration.filterMapDrapeTextures,
    dpiAwareViewports: false !== configuration.dpiAwareViewports,
    doIdleWork: false !== configuration.doIdleWork,
    useWebGL2: true === configuration.useWebGL2,
    planProjections: true,
  };

  const tileAdminProps = DisplayTestApp.tileAdminProps;
  if (configuration.disableInstancing)
    tileAdminProps.enableInstancing = false;

  if (false === configuration.enableImprovedElision)
    tileAdminProps.enableImprovedElision = false;

  if (configuration.ignoreAreaPatterns)
    tileAdminProps.ignoreAreaPatterns = true;

  if (false === configuration.useProjectExtents)
    tileAdminProps.useProjectExtents = false;

  if (configuration.disableMagnification)
    tileAdminProps.disableMagnification = true;

  tileAdminProps.cancelBackendTileRequests = (configuration.cancelBackendTileRequests !== false);
  tileAdminProps.tileTreeExpirationTime = configuration.tileTreeExpirationSeconds;
  tileAdminProps.maximumLevelsToSkip = configuration.maxTilesToSkip;

  if (configuration.useFakeCloudStorageTileCache)
    (CloudStorageTileCache as any)._instance = new FakeTileCache();

  await DisplayTestApp.startup({ renderSys: renderSystemOptions });
  if (false !== configuration.enableDiagnostics)
    IModelApp.renderSystem.enableDiagnostics(RenderDiagnostics.All);

  // Choose RpcConfiguration based on whether we are in electron or browser
  const rpcInterfaces: RpcInterfaceDefinition[] = [IModelTileRpcInterface, SnapshotIModelRpcInterface, IModelReadRpcInterface, SVTRpcInterface];
  let rpcConfiguration: RpcConfiguration;
  if (ElectronRpcConfiguration.isElectron) {
    rpcInterfaces.push(NativeAppRpcInterface);
    rpcConfiguration = ElectronRpcManager.initializeClient({}, rpcInterfaces);
  } else if (MobileRpcConfiguration.isMobileFrontend) {
    rpcInterfaces.push(NativeAppRpcInterface);
    rpcConfiguration = MobileRpcManager.initializeClient(rpcInterfaces);
  } else {
    const uriPrefix = configuration.customOrchestratorUri || "http://localhost:3001";
    rpcConfiguration = BentleyCloudRpcManager.initializeClient({ info: { title: "SimpleViewApp", version: "v1.0" }, uriPrefix }, rpcInterfaces);

    // WIP: WebAppRpcProtocol seems to require an IModelToken for every RPC request. ECPresentation initialization tries to set active locale using
    // RPC without any imodel and fails...
    for (const definition of rpcConfiguration.interfaces())
      RpcOperation.forEach(definition, (operation) => operation.policy.token = (request) => (request.findTokenPropsParameter() || new IModelToken("test", "test", "test", "test", OpenMode.Readonly)));
  }

  if (!configuration.standalone && !configuration.customOrchestratorUri) {
    alert("Standalone iModel required. Set SVT_STANDALONE_FILENAME in environment");
    return;
  }

  const uiReady = displayUi(); // Get the browser started loading our html page and the svgs that it references but DON'T WAIT

  // while the browser is loading stuff, start work on logging in and downloading the imodel, etc.
  try {
    if ((!configuration.standalone || configuration.signInForStandalone) && !MobileRpcConfiguration.isMobileFrontend) {
      const signedIn: boolean = await signIn();
      if (!signedIn)
        return;
    }

    let iModel: IModelConnection | undefined;
    const iModelName = configuration.iModelName;
    if (undefined !== iModelName) {
      iModel = await openSnapshotIModel(iModelName);
      setTitle(iModelName);
    }

    await uiReady; // Now wait for the HTML UI to finish loading.
    await initView(iModel);
  } catch (reason) {
    alert(reason);
    return;
  }
}

async function documentLoaded(): Promise<void> {
  const readyState = /^complete$/;
  if (readyState.test(document.readyState))
    return Promise.resolve();

  return new Promise<void>((resolve) => {
    const listener = () => {
      if (readyState.test(document.readyState)) {
        document.removeEventListener("readystatechange", listener);
        resolve();
      }
    };

    document.addEventListener("readystatechange", listener);
    listener();
  });
}

async function initView(iModel: IModelConnection | undefined) {
  // open the specified view
  showStatus("opening View", configuration.viewName);

  const fileSelector = undefined !== configuration.standalonePath ? {
    directory: configuration.standalonePath,
    input: document.getElementById("browserFileSelector") as HTMLInputElement,
  } : undefined;

  DisplayTestApp.surface = new Surface(document.getElementById("app-surface")!, document.getElementById("toolBar")!, fileSelector);

  // We need layout to complete so that the div we want to stick our viewport into has non-zero dimensions.
  // Consistently reproducible for some folks, not others...
  await documentLoaded();

  if (undefined !== iModel) {
    const viewer = await DisplayTestApp.surface.createViewer({
      iModel,
      defaultViewName: configuration.viewName,
      disableEdges: true === configuration.disableEdges,
    });

    viewer.dock(Dock.Full);
  }

  showStatus("View Ready");
  hideSpinner();
}

// Set up the HTML UI elements and wire them to our functions
async function displayUi() {
  return new Promise(async (resolve) => {
    showSpinner();
    resolve();
  });
}

function showSpinner() {
  const spinner = document.getElementById("spinner") as HTMLElement;
  spinner.style.display = "block";
}

function hideSpinner() {
  const spinner = document.getElementById("spinner");
  if (spinner)
    spinner.style.display = "none";
}

// Entry point - run the main function
main(); // tslint:disable-line:no-floating-promises
