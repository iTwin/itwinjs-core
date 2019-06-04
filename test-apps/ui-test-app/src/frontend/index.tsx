/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as ReactDOM from "react-dom";
import { createStore, combineReducers, Store } from "redux";
import { Provider } from "react-redux";
import {
  RpcConfiguration, RpcOperation, IModelToken, ElectronRpcManager,
  ElectronRpcConfiguration, BentleyCloudRpcManager,
} from "@bentley/imodeljs-common";

import { IModelApp, IModelConnection, SnapMode, AccuSnap, ViewClipByPlaneTool, RenderSystem, IModelAppOptions } from "@bentley/imodeljs-frontend";
import { I18NNamespace } from "@bentley/imodeljs-i18n";
import { Config, OidcFrontendClientConfiguration, AccessToken } from "@bentley/imodeljs-clients";
import { Presentation } from "@bentley/presentation-frontend";
import { UiCore } from "@bentley/ui-core";
import { UiComponents, BeDragDropContext } from "@bentley/ui-components";
import {
  UiFramework, FrameworkState, FrameworkReducer, AppNotificationManager,
  IModelInfo, FrontstageManager, createAction, ActionsUnion, DeepReadonly, ProjectInfo,
  ConfigurableUiContent, ThemeManager, DragDropLayerRenderer, SyncUiEventDispatcher,
} from "@bentley/ui-framework";
import { Id64String, OpenMode, Logger, LogLevel } from "@bentley/bentleyjs-core";
import getSupportedRpcs from "../common/rpcs";
import { AppUi } from "./appui/AppUi";
import { AppBackstage } from "./appui/AppBackstage";
import { ViewsFrontstage } from "./appui/frontstages/ViewsFrontstage";
import { Tool1 } from "./tools/Tool1";
import { Tool2 } from "./tools/Tool2";
import { AppSelectTool } from "./tools/AppSelectTool";
import { ToolWithSettings } from "./tools/ToolWithSettings";
import { AnalysisAnimationTool } from "./tools/AnalysisAnimation";

// Mobx demo
import { configure as mobxConfigure } from "mobx";

import "./index.scss";
import { TestAppConfiguration } from "../common/TestAppConfiguration";
import { LocalFileOpenFrontstage } from "./appui/frontstages/LocalFileStage";

// Initialize my application gateway configuration for the frontend
RpcConfiguration.developmentMode = true;
let rpcConfiguration: RpcConfiguration;
const rpcInterfaces = getSupportedRpcs();
if (ElectronRpcConfiguration.isElectron)
  rpcConfiguration = ElectronRpcManager.initializeClient({}, rpcInterfaces);
else
  rpcConfiguration = BentleyCloudRpcManager.initializeClient({ info: { title: "ui-test-app", version: "v1.0" }, uriPrefix: "http://localhost:3001" }, rpcInterfaces);

// WIP: WebAppRpcProtocol seems to require an IModelToken for every RPC request
for (const definition of rpcConfiguration.interfaces())
  RpcOperation.forEach(definition, (operation) => operation.policy.token = (request) => (request.findTokenPropsParameter() || new IModelToken("test", "test", "test", "test", OpenMode.Readonly)));

// cSpell:ignore SETIMODELCONNECTION setTestProperty sampleapp setaccesstoken uitestapp setisimodellocal
/** Action Ids used by redux and to send sync UI components. Typically used to refresh visibility or enable state of control.
 * Use lower case strings to be compatible with SyncUi processing.
 */
export enum SampleAppUiActionId {
  setIModelConnection = "sampleapp:setimodelconnection",
  setAccessToken = "sampleapp:setaccesstoken",
  setTestProperty = "sampleapp:settestproperty",
  setAnimationViewId = "sampleapp:setAnimationViewId",
  setIsIModelLocal = "sampleapp:setisimodellocal",
}

export interface SampleAppState {
  iModelConnection?: IModelConnection;
  accessToken?: AccessToken;
  testProperty: string;
  animationViewId: string;
  isIModelLocal: boolean;
}

const initialState: SampleAppState = {
  testProperty: "",
  animationViewId: "",
  isIModelLocal: false,
};

// An object with a function that creates each OpenIModelAction that can be handled by our reducer.
// tslint:disable-next-line:variable-name
export const SampleAppActions = {
  setIModelConnection: (iModelConnection: IModelConnection) => createAction(SampleAppUiActionId.setIModelConnection, iModelConnection),
  setAccessToken: (accessToken: AccessToken) => createAction(SampleAppUiActionId.setAccessToken, accessToken),
  setTestProperty: (testProperty: string) => createAction(SampleAppUiActionId.setTestProperty, testProperty),
  setAnimationViewId: (viewId: string) => createAction(SampleAppUiActionId.setAnimationViewId, viewId),
  setIsIModelLocal: (isIModelLocal: boolean) => createAction(SampleAppUiActionId.setIsIModelLocal, isIModelLocal),
};

class SampleAppAccuSnap extends AccuSnap {
  public getActiveSnapModes(): SnapMode[] {
    const snaps: SnapMode[] = [];
    if (SampleAppIModelApp.store.getState().frameworkState) {
      const snapMode = SampleAppIModelApp.store.getState().frameworkState!.configurableUiState.snapMode;
      if ((snapMode & SnapMode.Bisector) === SnapMode.Bisector as number) snaps.push(SnapMode.Bisector);
      if ((snapMode & SnapMode.Center) === SnapMode.Center as number) snaps.push(SnapMode.Center);
      if ((snapMode & SnapMode.Intersection) === SnapMode.Intersection as number) snaps.push(SnapMode.Intersection);
      if ((snapMode & SnapMode.MidPoint) === SnapMode.MidPoint as number) snaps.push(SnapMode.MidPoint);
      if ((snapMode & SnapMode.Nearest) === SnapMode.Nearest as number) snaps.push(SnapMode.Nearest);
      if ((snapMode & SnapMode.NearestKeypoint) === SnapMode.NearestKeypoint as number) snaps.push(SnapMode.NearestKeypoint);
      if ((snapMode & SnapMode.Origin) === SnapMode.Origin as number) snaps.push(SnapMode.Origin);
    } else {
      snaps.push(SnapMode.NearestKeypoint);
    }
    return snaps;
  }
}

export type SampleAppActionsUnion = ActionsUnion<typeof SampleAppActions>;

function SampleAppReducer(state: SampleAppState = initialState, action: SampleAppActionsUnion): DeepReadonly<SampleAppState> {
  switch (action.type) {
    case SampleAppUiActionId.setIModelConnection: {
      return { ...state, iModelConnection: action.payload };
    }
    case SampleAppUiActionId.setAccessToken: {
      return { ...state, accessToken: action.payload };
    }
    case SampleAppUiActionId.setTestProperty: {
      return { ...state, testProperty: action.payload };
    }
    case SampleAppUiActionId.setAnimationViewId: {
      return { ...state, animationViewId: action.payload };
    }
    case SampleAppUiActionId.setIsIModelLocal: {
      return { ...state, isIModelLocal: action.payload };
    }
  }

  return state;
}

// React-redux interface stuff
export interface RootState {
  sampleAppState: SampleAppState;
  frameworkState?: FrameworkState;
}

export class SampleAppIModelApp {
  public static sampleAppNamespace: I18NNamespace;
  public static store: Store<RootState>;
  public static rootReducer: any;

  public static startup(opts?: IModelAppOptions): void {
    opts = opts ? opts : {};
    opts.accuSnap = new SampleAppAccuSnap();
    opts.notifications = new AppNotificationManager();
    IModelApp.startup(opts);

    this.sampleAppNamespace = IModelApp.i18n.registerNamespace("SampleApp");
    // this is the rootReducer for the sample application.
    this.rootReducer = combineReducers<RootState>({
      sampleAppState: SampleAppReducer,
      frameworkState: FrameworkReducer,
    } as any);

    // create the Redux Store.
    this.store = createStore(this.rootReducer,
      (window as any).__REDUX_DEVTOOLS_EXTENSION__ && (window as any).__REDUX_DEVTOOLS_EXTENSION__());

    // register local commands.
    // register core commands not automatically registered
    ViewClipByPlaneTool.register();

    // Configure a CORS proxy in development mode.
    if (process.env.NODE_ENV === "development")
      Config.App.set("imjs_dev_cors_proxy_server", `http://${window.location.hostname}:3001`); // By default, this will run on port 3001

    // Mobx configuration
    mobxConfigure({ enforceActions: "observed" });
  }

  public static async initialize() {
    Presentation.initialize();
    Presentation.selection.scopes.activeScope = "top-assembly";
    UiCore.initialize(IModelApp.i18n); // tslint:disable-line:no-floating-promises
    UiComponents.initialize(IModelApp.i18n); // tslint:disable-line:no-floating-promises

    let oidcConfiguration: OidcFrontendClientConfiguration;
    const scope = "openid email profile organization feature_tracking imodelhub context-registry-service imodeljs-router reality-data:read product-settings-service";
    if (ElectronRpcConfiguration.isElectron) {
      let clientId = "spa-5lgQRridBuvb8dUm6EVmaQmZL";
      let redirectUri = "electron://frontend/signin-callback";
      if (Config.App.has("imjs_electron_test_client_id"))
        clientId = Config.App.get("imjs_electron_test_client_id");

      if (Config.App.has("imjs_electron_test_redirect_uri"))
        redirectUri = Config.App.get("imjs_electron_test_redirect_uri");
      oidcConfiguration = { clientId, redirectUri, scope };
    } else {
      let clientId = "imodeljs-spa-test-2686";
      let redirectUri = "http://localhost:3000/signin-callback";

      if (Config.App.has("imjs_browser_test_client_id"))
        clientId = Config.App.get("imjs_browser_test_client_id");

      if (Config.App.has("imjs_browser_test_redirect_uri"))
        redirectUri = Config.App.get("imjs_browser_test_redirect_uri");
      oidcConfiguration = { clientId, redirectUri, scope };
    }

    await UiFramework.initialize(SampleAppIModelApp.store, IModelApp.i18n, oidcConfiguration, "frameworkState");

    // initialize Presentation
    Presentation.initialize({
      activeLocale: IModelApp.i18n.languageList()[0],
    });

    // Register tools.
    Tool1.register(this.sampleAppNamespace);
    Tool2.register(this.sampleAppNamespace);
    ToolWithSettings.register(this.sampleAppNamespace);
    AppSelectTool.register();
    AnalysisAnimationTool.register(this.sampleAppNamespace);

    IModelApp.toolAdmin.defaultToolId = AppSelectTool.toolId;
  }

  public static async openIModelAndViews(projectId: string, iModelId: string, viewIdsSelected: Id64String[]) {
    // Close the current iModelConnection
    await SampleAppIModelApp.closeCurrentIModel();

    // open the imodel
    const iModelConnection = await UiFramework.iModelServices.openIModel(projectId, iModelId);
    SampleAppIModelApp.setIsIModelLocal(false, true);

    await this.openViews(iModelConnection, viewIdsSelected);
  }

  public static async closeCurrentIModel() {
    const currentIModelConnection = this.getIModelConnection();
    if (currentIModelConnection) {
      SyncUiEventDispatcher.clearConnectionEvents(currentIModelConnection);

      if (SampleAppIModelApp.isIModelLocal)
        await currentIModelConnection.closeSnapshot();
      else
        await currentIModelConnection.close();
    }
  }

  public static async openViews(iModelConnection: IModelConnection, viewIdsSelected: Id64String[]) {

    SyncUiEventDispatcher.initializeConnectionEvents(iModelConnection);

    // store the IModelConnection in the sample app store - this may trigger redux connected components
    SampleAppIModelApp.setIModelConnection(iModelConnection, true);

    // we create a Frontstage that contains the views that we want.
    const frontstageProvider = new ViewsFrontstage(viewIdsSelected, iModelConnection);
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef).then(() => { // tslint:disable-line:no-floating-promises
      // Frontstage & ScreenViewports are ready
      // tslint:disable-next-line:no-console
      console.log("Frontstage is ready");
    });
  }

  public static async handleWorkOffline() {
    await SampleAppIModelApp.showFrontstage("Test4");
  }

  public static async showIModelIndex(contextId: string, iModelId: string) {
    const currentConnection = SampleAppIModelApp.getIModelConnection();
    if (!currentConnection || (currentConnection.iModelToken.iModelId !== iModelId)) {
      // Close the current iModelConnection
      await SampleAppIModelApp.closeCurrentIModel();

      // open the imodel
      const iModelConnection = await UiFramework.iModelServices.openIModel(contextId, iModelId);
      SampleAppIModelApp.setIsIModelLocal(false, true);

      SyncUiEventDispatcher.initializeConnectionEvents(iModelConnection);

      // store the IModelConnection in the sample app store
      SampleAppIModelApp.setIModelConnection(iModelConnection, true);
    }

    await SampleAppIModelApp.showFrontstage("IModelIndex");
  }

  public static async showIModelOpen(_iModels: IModelInfo[] | undefined) {
    await SampleAppIModelApp.showFrontstage("IModelOpen");
  }

  public static async showSignIn() {
    await SampleAppIModelApp.showFrontstage("SignIn");
  }

  // called after the user has signed in (or access token is still valid)
  public static async onSignedIn() {
    const accessToken = await IModelApp.authorizationClient!.getAccessToken();

    // NOTE: do we need to store access token since its store in OidcClient?
    SampleAppIModelApp.setAccessToken(accessToken);

    if (!accessToken)
      return;

    // get the default IModel (from imodejs-config)
    let defaultImodel: IModelInfo | undefined;

    let viewId: string | undefined;
    if (Config.App.has("imjs_uitestapp_imodel_viewId"))
      viewId = Config.App.get("imjs_uitestapp_imodel_viewId");

    if (Config.App.has("imjs_uitestapp_imodel_name") &&
      Config.App.has("imjs_uitestapp_imodel_wsgId") &&
      Config.App.has("imjs_uitestapp_imodel_project_name") &&
      Config.App.has("imjs_uitestapp_imodel_project_projectNumber") &&
      Config.App.has("imjs_uitestapp_imodel_project_wsgId")) {
      const defaultProject = {
        name: Config.App.get("imjs_uitestapp_imodel_project_name"),
        projectNumber: Config.App.get("imjs_uitestapp_imodel_project_projectNumber"),
        wsgId: Config.App.get("imjs_uitestapp_imodel_project_wsgId"),
        readStatus: 0,
      } as ProjectInfo;

      defaultImodel = {
        name: Config.App.get("imjs_uitestapp_imodel_name"),
        description: Config.App.get("imjs_uitestapp_imodel_name"),
        wsgId: Config.App.get("imjs_uitestapp_imodel_wsgId"),
        projectInfo: defaultProject,
        status: "",
      } as IModelInfo;

      if (viewId) {
        // open directly into the iModel (view)
        await SampleAppIModelApp.openIModelAndViews(defaultImodel.projectInfo.wsgId, defaultImodel.wsgId, [viewId!]);
      } else {
        // open to the IModelIndex frontstage
        await SampleAppIModelApp.showIModelIndex(defaultImodel.projectInfo.wsgId, defaultImodel.wsgId);
      }
    } else if (testAppConfiguration.startWithSnapshots) {
      // open to the Local File frontstage
      await LocalFileOpenFrontstage.open();
    } else {
      // open to the IModelOpen frontstage
      await SampleAppIModelApp.showIModelOpen(undefined);
    }
  }

  public static setTestProperty(value: string, immediateSync = false) {
    if (value !== SampleAppIModelApp.getTestProperty()) {
      UiFramework.dispatchActionToStore(SampleAppUiActionId.setTestProperty, value, immediateSync);
    }
  }

  public static getTestProperty(): string {
    return SampleAppIModelApp.store.getState().sampleAppState.testProperty;
  }

  public static saveAnimationViewId(value: string, immediateSync = false) {
    if (value !== SampleAppIModelApp.getTestProperty()) {
      UiFramework.dispatchActionToStore(SampleAppUiActionId.setAnimationViewId, value, immediateSync);
    }
  }

  public static getAnimationViewId(): string {
    return SampleAppIModelApp.store.getState().sampleAppState.animationViewId;
  }

  public static setIModelConnection(iModelConnection: IModelConnection, immediateSync = false) {
    UiFramework.dispatchActionToStore(SampleAppUiActionId.setIModelConnection, iModelConnection, immediateSync);
  }

  public static setIsIModelLocal(isIModelLocal: boolean, immediateSync = false) {
    UiFramework.dispatchActionToStore(SampleAppUiActionId.setIsIModelLocal, isIModelLocal, immediateSync);
  }

  public static setAccessToken(accessToken: AccessToken, immediateSync = false) {
    UiFramework.dispatchActionToStore(SampleAppUiActionId.setAccessToken, accessToken, immediateSync);
  }

  public static getAccessToken(): AccessToken | undefined {
    return SampleAppIModelApp.store.getState().sampleAppState.accessToken;
  }

  public static getIModelConnection(): IModelConnection | undefined {
    return SampleAppIModelApp.store.getState().sampleAppState.iModelConnection;
  }

  public static get isIModelLocal(): boolean {
    return SampleAppIModelApp.store.getState().sampleAppState.isIModelLocal;
  }

  public static async showFrontstage(frontstageId: string) {
    const frontstageDef = FrontstageManager.findFrontstageDef(frontstageId);
    FrontstageManager.setActiveFrontstageDef(frontstageDef); // tslint:disable-line:no-floating-promises
  }
}

export class SampleAppViewer extends React.Component<any> {
  constructor(props: any) {
    super(props);

    AppUi.initialize();

    // tslint:disable-next-line:no-console
    console.log("Versions:", (window as any).iModelJsVersions);

    if (UiFramework.oidcClient.hasSignedIn) {
      SampleAppIModelApp.onSignedIn(); // tslint:disable-line:no-floating-promises
    } else {
      SampleAppIModelApp.showSignIn(); // tslint:disable-line:no-floating-promises
    }
  }

  public render(): JSX.Element {
    return (
      <Provider store={SampleAppIModelApp.store} >
        <ThemeManager>
          <BeDragDropContext>
            <ConfigurableUiContent appBackstage={<AppBackstage />} />
            <DragDropLayerRenderer />
          </BeDragDropContext>
        </ThemeManager>
      </Provider >
    );
  }
}

// If we are using a browser, close the current iModel before leaving
window.addEventListener("beforeunload", async () => {
  await SampleAppIModelApp.closeCurrentIModel();
});

export const testAppConfiguration = {} as TestAppConfiguration;

// Retrieves the configuration for starting SVT from configuration.json file located in the built public folder
async function retrieveConfiguration(): Promise<void> {
  return new Promise<void>((resolve, _reject) => {
    const request: XMLHttpRequest = new XMLHttpRequest();
    request.open("GET", "testAppConfiguration.json", false);
    request.setRequestHeader("Cache-Control", "no-cache");
    request.onreadystatechange = ((_event: Event) => {
      if (request.readyState === XMLHttpRequest.DONE) {
        if (request.status === 200) {
          const newConfigurationInfo: any = JSON.parse(request.responseText);
          Object.assign(testAppConfiguration, newConfigurationInfo);
          resolve();
        }
      }
    });
    request.send();
  });
}

// main entry point.
async function main() {
  // retrieve, set, and output the global configuration variable
  await retrieveConfiguration(); // (does a fetch)
  console.log("Configuration", JSON.stringify(testAppConfiguration)); // tslint:disable-line:no-console

  // initialize logging
  Logger.initializeToConsole();
  Logger.setLevelDefault(LogLevel.Warning);

  // Set up render option to displaySolarShadows.
  const renderSystemOptions: RenderSystem.Options = {
    displaySolarShadows: true,
  };

  // Start the app.
  SampleAppIModelApp.startup({ renderSys: renderSystemOptions });

  // wait for both our i18n namespaces to be read.
  SampleAppIModelApp.initialize().then(() => { // tslint:disable-line:no-floating-promises
    ReactDOM.render(<SampleAppViewer />, document.getElementById("root") as HTMLElement);
  });
}

// Entry point - run the main function
main(); // tslint:disable-line:no-floating-promises
