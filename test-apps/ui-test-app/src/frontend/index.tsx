/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as ReactDOM from "react-dom";
import { createStore, combineReducers, Store } from "redux";
import { Provider } from "react-redux";
import {
  RpcConfiguration, RpcOperation, IModelToken,
  ElectronRpcManager, ElectronRpcConfiguration, BentleyCloudRpcManager,
} from "@bentley/imodeljs-common";
import { IModelApp, IModelConnection, SnapMode, AccuSnap } from "@bentley/imodeljs-frontend";
import { I18NNamespace } from "@bentley/imodeljs-i18n";
import { Config, OidcFrontendClientConfiguration } from "@bentley/imodeljs-clients";
import { Presentation } from "@bentley/presentation-frontend";

import { WebFontIcon, UiCore } from "@bentley/ui-core";
import { UiComponents } from "@bentley/ui-components";
import {
  UiFramework,
  FrameworkState,
  FrameworkReducer,
  OverallContent,
  AppNotificationManager,
  IModelInfo,
  FrontstageManager,
  createAction, ActionsUnion, DeepReadonly, SyncUiEventDispatcher,
} from "@bentley/ui-framework";
import { Id64String } from "@bentley/bentleyjs-core";

import getSupportedRpcs from "../common/rpcs";
import { AppUi } from "./appui/AppUi";
import AppBackstage, { BackstageShow, BackstageHide } from "./appui/AppBackstage";
import { ViewsFrontstage } from "./appui/frontstages/ViewsFrontstage";
import { Tool1 } from "./tools/Tool1";
import { Tool2 } from "./tools/Tool2";
import { AppSelectTool } from "./tools/AppSelectTool";

// Mobx demo
import { configure as mobxConfigure } from "mobx";

import "./index.scss";

// Initialize my application gateway configuration for the frontend
let rpcConfiguration: RpcConfiguration;
const rpcInterfaces = getSupportedRpcs();
if (ElectronRpcConfiguration.isElectron)
  rpcConfiguration = ElectronRpcManager.initializeClient({}, rpcInterfaces);
else
  rpcConfiguration = BentleyCloudRpcManager.initializeClient({ info: { title: "ui-test-app", version: "v1.0" }, uriPrefix: "http://localhost:3001" }, rpcInterfaces);

// WIP: WebAppRpcProtocol seems to require an IModelToken for every RPC request
for (const definition of rpcConfiguration.interfaces())
  RpcOperation.forEach(definition, (operation) => operation.policy.token = (_request) => new IModelToken("test", "test", "test", "test"));

// cSpell:ignore BACKSTAGESHOW BACKSTAGEHIDE SETIMODELCONNECTION setTestProperty
/** Action Ids used by redux and to send sync UI components. Typically used to refresh visibility or enable state of control.
 * Use lower case strings to be compatible with SyncUi processing.
 */
export const enum SampleAppUiActionId {
  showBackstage = "sampleapp:backstageshow",
  hideBackstage = "sampleapp:backstagehide",
  setIModelConnection = "sampleapp:setimodelconnection",
  setTestProperty = "sampleapp:settestproperty",
}

export interface SampleAppState {
  backstageVisible: boolean;
  currentIModelConnection?: IModelConnection;
  testProperty: string;
}

const initialState: SampleAppState = {
  backstageVisible: false,
  testProperty: "",
};

// An object with a function that creates each OpenIModelAction that can be handled by our reducer.
// tslint:disable-next-line:variable-name
export const SampleAppActions = {
  showBackstage: () => createAction(SampleAppUiActionId.showBackstage),
  hideBackstage: () => createAction(SampleAppUiActionId.hideBackstage),
  setIModelConnection: (iModelConnection: IModelConnection) => createAction(SampleAppUiActionId.setIModelConnection, { iModelConnection }),
  setTestProperty: (testProperty: string) => createAction(SampleAppUiActionId.setTestProperty, testProperty),
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
    case SampleAppUiActionId.showBackstage: {
      return { ...state, backstageVisible: true };
    }
    case SampleAppUiActionId.hideBackstage: {
      return { ...state, backstageVisible: false };
    }
    case SampleAppUiActionId.setIModelConnection: {
      return { ...state, currentIModelConnection: action.payload.iModelConnection };
    }
    case SampleAppUiActionId.setTestProperty: {
      return { ...state, testProperty: action.payload };
    }
  }

  return state;
}

// React-redux interface stuff
export interface RootState {
  sampleAppState: SampleAppState;
  frameworkState?: FrameworkState;
}

// subclass of IModelApp needed to use IModelJs API
export class SampleAppIModelApp extends IModelApp {
  public static sampleAppNamespace: I18NNamespace;
  public static store: Store<RootState>;
  public static rootReducer: any;

  protected static onStartup() {
    IModelApp.notifications = new AppNotificationManager();
    IModelApp.accuSnap = new SampleAppAccuSnap();

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

    // Configure a CORS proxy in development mode.
    if (process.env.NODE_ENV === "development")
      Config.App.set("imjs_dev_cors_proxy_server", `http://${window.location.hostname}:3001`); // By default, this will run on port 3001

    // Mobx configuration
    mobxConfigure({ enforceActions: "observed" });
  }

  public static async initialize() {
    Presentation.initialize();
    UiCore.initialize(SampleAppIModelApp.i18n); // tslint:disable-line:no-floating-promises
    UiComponents.initialize(SampleAppIModelApp.i18n); // tslint:disable-line:no-floating-promises

    let oidcConfiguration: OidcFrontendClientConfiguration;
    const scope = "openid email profile organization feature_tracking imodelhub context-registry-service imodeljs-router reality-data:read";
    if (ElectronRpcConfiguration.isElectron) {
      const clientId = Config.App.get("imjs_electron_test_client_id");
      const redirectUri = Config.App.get("imjs_electron_test_redirect_uri");
      oidcConfiguration = { clientId, redirectUri, scope };
    } else {
      const clientId = Config.App.get("imjs_browser_test_client_id");
      const redirectUri = Config.App.get("imjs_browser_test_redirect_uri");
      oidcConfiguration = { clientId, redirectUri, scope };
    }

    await UiFramework.initialize(SampleAppIModelApp.store, SampleAppIModelApp.i18n, oidcConfiguration, "frameworkState");

    // initialize Presentation
    Presentation.initialize({
      activeLocale: IModelApp.i18n.languageList()[0],
    });

    // Register tools.
    BackstageShow.register(this.sampleAppNamespace);
    BackstageHide.register(this.sampleAppNamespace);
    Tool1.register(this.sampleAppNamespace);
    Tool2.register(this.sampleAppNamespace);
    AppSelectTool.register();
    IModelApp.toolAdmin.defaultToolId = AppSelectTool.toolId;
  }

  public static async handleIModelViewsSelected(iModelInfo: IModelInfo, viewIdsSelected: Id64String[]) {

    const accessToken = SampleAppIModelApp.store.getState().frameworkState!.overallContentState.accessToken!;
    const projectInfo = iModelInfo.projectInfo;
    const wsgId = iModelInfo.wsgId;

    // open the imodel
    const iModelConnection = await UiFramework.iModelServices.openIModel(accessToken, projectInfo, wsgId);

    const payload = { iModelConnection };
    SampleAppIModelApp.store.dispatch({ type: SampleAppUiActionId.setIModelConnection, payload });
    SyncUiEventDispatcher.initializeConnectionEvents(iModelConnection);

    // we create a FrontStage that contains the views that we want.
    const frontstageProvider = new ViewsFrontstage(viewIdsSelected, iModelConnection);
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef).then(() => { // tslint:disable-line:no-floating-promises
      // Frontstage & ScreenViewports are ready
      // tslint:disable-next-line:no-console
      console.log("Frontstage is ready");
    });
  }

  public static handleWorkOffline() {
    if (!FrontstageManager.activeFrontstageDef) {
      const frontstageDef = FrontstageManager.findFrontstageDef("Test4");
      FrontstageManager.setActiveFrontstageDef(frontstageDef); // tslint:disable-line:no-floating-promises
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
}

SampleAppIModelApp.startup();

// wait for both our i18n namespaces to be read.
SampleAppIModelApp.initialize().then(() => { // tslint:disable-line:no-floating-promises
  //  create the application icon.
  const applicationIconStyle: React.CSSProperties = {
    width: "50px",
    height: "50px",
    fontSize: "50px",
    color: "red",
    marginLeft: "10px",
  };
  const applicationIcon = React.createElement(WebFontIcon, { iconName: "icon-construction-worker", style: applicationIconStyle });
  const overallContentProps = {
    appHeaderIcon: applicationIcon,
    appHeaderMessage: SampleAppIModelApp.i18n.translate("SampleApp:Header.welcome"),
    appBackstage: <AppBackstage />,
    onIModelViewsSelected: SampleAppIModelApp.handleIModelViewsSelected,
    onWorkOffline: SampleAppIModelApp.handleWorkOffline,
  };

  AppUi.initialize();

  // tslint:disable-next-line:no-console
  console.log("Versions:", (window as any).iModelJsVersions);

  ReactDOM.render(
    <Provider store={SampleAppIModelApp.store} >
      <OverallContent {...overallContentProps} />
    </Provider >,
    document.getElementById("root") as HTMLElement,
  );
});
