/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { OpenMode, ActivityLoggingContext, Guid } from "@bentley/bentleyjs-core";
import {
  BentleyCloudRpcManager,
  ElectronRpcConfiguration,
  ElectronRpcManager,
  IModelReadRpcInterface,
  IModelTileRpcInterface,
  IModelToken,
  RpcConfiguration,
  RpcOperation,
  StandaloneIModelRpcInterface,
  MobileRpcConfiguration,
  MobileRpcManager,
} from "@bentley/imodeljs-common";
import { AccessToken, Config, OidcFrontendClientConfiguration } from "@bentley/imodeljs-clients";
import {
  IModelApp,
  IModelConnection,
  OidcClientWrapper,
} from "@bentley/imodeljs-frontend";
import { SimpleViewState } from "./SimpleViewState";
import { showStatus } from "./Utils";
import { SVTConfiguration } from "../common/SVTConfiguration";
import { DisplayTestApp } from "./App";
import { Viewer } from "./Viewer";

const activeViewState: SimpleViewState = new SimpleViewState();
const configuration = {} as SVTConfiguration;

// Retrieves the configuration for starting SVT from configuration.json file located in the built public folder
async function retrieveConfiguration(): Promise<void> {
  return new Promise<void>((resolve, _reject) => {
    const request: XMLHttpRequest = new XMLHttpRequest();
    request.open("GET", "configuration.json", false);
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
  });
}

// opens the configured iModel from disk
async function openStandaloneIModel(state: SimpleViewState, filename: string) {
  configuration.standalone = true;
  state.iModelConnection = await IModelConnection.openStandalone(filename, OpenMode.Readonly);
  configuration.iModelName = state.iModelConnection.name;
  IModelApp.accessToken = state.accessToken;
}

// If we are using a browser, close the current iModel before leaving
window.onbeforeunload = () => {
  if (activeViewState.iModelConnection !== undefined)
    if (configuration.standalone)
      activeViewState.iModelConnection.closeStandalone(); // tslint:disable-line:no-floating-promises
    else
      activeViewState.iModelConnection.close(activeViewState.accessToken!); // tslint:disable-line:no-floating-promises
};

async function initializeOidc(actx: ActivityLoggingContext) {
  actx.enter();

  const clientId = Config.App.get("imjs_browser_test_client_id");
  const redirectUri = Config.App.getString("imjs_browser_test_redirect_uri"); // must be set in config
  const oidcConfig: OidcFrontendClientConfiguration = { clientId, redirectUri };

  await OidcClientWrapper.initialize(actx, oidcConfig);
  actx.enter();

  OidcClientWrapper.oidcClient.onUserStateChanged.addListener((accessToken: AccessToken | undefined) => {
    activeViewState.accessToken = accessToken;
  });

  activeViewState.accessToken = await OidcClientWrapper.oidcClient.getAccessToken(actx);
  actx.enter();
}

// main entry point.
async function main() {
  const actx = new ActivityLoggingContext(Guid.createValue());
  actx.enter();

  if (!MobileRpcConfiguration.isMobileFrontend) {
    // retrieve, set, and output the global configuration variable
    await retrieveConfiguration(); // (does a fetch)
    console.log("Configuration", JSON.stringify(configuration)); // tslint:disable-line:no-console
  }
  // Start the app. (This tries to fetch a number of localization json files from the origin.)
  DisplayTestApp.startup();

  // Choose RpcConfiguration based on whether we are in electron or browser
  let rpcConfiguration: RpcConfiguration;
  if (ElectronRpcConfiguration.isElectron) {
    rpcConfiguration = ElectronRpcManager.initializeClient({}, [IModelTileRpcInterface, StandaloneIModelRpcInterface, IModelReadRpcInterface]);
  } else if (MobileRpcConfiguration.isMobileFrontend) {
    Object.assign(configuration, { standalone: true, iModelName: "sample_documents/04_Plant.i.ibim" });
    rpcConfiguration = MobileRpcManager.initializeClient([IModelTileRpcInterface, StandaloneIModelRpcInterface, IModelReadRpcInterface]);
  } else {
    const uriPrefix = configuration.customOrchestratorUri || "http://localhost:3001";
    rpcConfiguration = BentleyCloudRpcManager.initializeClient({ info: { title: "SimpleViewApp", version: "v1.0" }, uriPrefix }, [IModelTileRpcInterface, StandaloneIModelRpcInterface, IModelReadRpcInterface]);
    // WIP: WebAppRpcProtocol seems to require an IModelToken for every RPC request. ECPresentation initialization tries to set active locale using
    // RPC without any imodel and fails...
    for (const definition of rpcConfiguration.interfaces())
      RpcOperation.forEach(definition, (operation) => operation.policy.token = (_request) => new IModelToken("test", "test", "test", "test", OpenMode.Readonly));
  }

  if (!configuration.standalone) {
    alert("Standalone iModel required. Set SVT_STANDALONE_FILENAME in environment");
    return;
  }

  const uiReady = displayUi(); // Get the browser started loading our html page and the svgs that it references but DON'T WAIT

  // while the browser is loading stuff, start work on logging in and downloading the imodel, etc.
  try {
    if (configuration.standalone && !configuration.signInForStandalone) {
      await openStandaloneIModel(activeViewState, configuration.iModelName!);
      await uiReady; // Now wait for the HTML UI to finish loading.
      await initView();
      return;
    }

    await initializeOidc(actx);
    actx.enter();

    if (!activeViewState.accessToken)
      OidcClientWrapper.oidcClient.signIn(actx);
    else {
      await openStandaloneIModel(activeViewState, configuration.iModelName!);
      await uiReady; // Now, wait for the HTML UI to finish loading.
      await initView();
    }
  } catch (reason) {
    alert(reason);
    return;
  }
}

async function initView() {
  // open the specified view
  showStatus("opening View", configuration.viewName);
  await Viewer.create({
    iModel: activeViewState.iModelConnection!,
    defaultViewName: configuration.viewName,
    fileDirectoryPath: configuration.standalonePath,
  });

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
