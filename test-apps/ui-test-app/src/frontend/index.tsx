/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as ReactDOM from "react-dom";
import { CSSProperties } from "react";
import { createStore, combineReducers, Store } from "redux";
import { Provider } from "react-redux";

import {
  RpcConfiguration, RpcOperation, IModelToken, IModelReadRpcInterface, IModelTileRpcInterface,
  ElectronRpcManager, ElectronRpcConfiguration, BentleyCloudRpcManager,
} from "@bentley/imodeljs-common";
import { IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { I18NNamespace } from "@bentley/imodeljs-i18n";
import { Config as ClientConfig } from "@bentley/imodeljs-clients/lib/Config";

import { WebFontIcon } from "@bentley/ui-core";
import { UiCore } from "@bentley/ui-core";
import { UiComponents } from "@bentley/ui-components";
import { UiFramework, FrameworkState, FrameworkReducer, OverallContent, AppNotificationManager, ProjectInfo, ConfigurableUiManager, FrontstageManager, FrontstageProps } from "@bentley/ui-framework";
import { Id64Props } from "@bentley/bentleyjs-core";

import { AppUi } from "./appui/AppUi";
import AppBackstage, { BackstageShow, BackstageHide, BackstageToggle } from "./appui/AppBackstage";
import "./index.scss";
import { ViewsFrontstage } from "./appui/frontstages/ViewsFrontstage";

// @ts-ignore
import { createAction, Action, ActionsUnion, ActionWithPayload, DeepReadonlyObject, DeepReadonly } from "./utils/redux-ts";

// Initialize my application gateway configuration for the frontend
let rpcConfiguration: RpcConfiguration;
const rpcInterfaces = [IModelTileRpcInterface, IModelReadRpcInterface];
if (ElectronRpcConfiguration.isElectron)
  rpcConfiguration = ElectronRpcManager.initializeClient({}, rpcInterfaces);
else
  rpcConfiguration = BentleyCloudRpcManager.initializeClient({ info: { title: "sampleApp", version: "v1.0" } }, rpcInterfaces);

// WIP: WebAppRpcProtocol seems to require an IModelToken for every RPC request
for (const definition of rpcConfiguration.interfaces())
  RpcOperation.forEach(definition, (operation) => operation.policy.token = (_request) => new IModelToken("test", "test", "test", "test"));

export interface SampleAppState {
  backstageVisible?: boolean;
  currentIModelConnection?: IModelConnection;
}

const initialState: SampleAppState = {
  backstageVisible: false,
};

// An object with a function that creates each OpenIModelAction that can be handled by our reducer.
// tslint:disable-next-line:variable-name
export const SampleAppActions = {
  showBackstage: () => createAction("SampleApp:BACKSTAGESHOW"),
  hideBackstage: () => createAction("SampleApp:BACKSTAGEHIDE"),
  setIModelConnection: (iModelConnection: IModelConnection) => createAction("SampleApp:SETIMODELCONNECTION", { iModelConnection }),
};

export type SampleAppActionsUnion = ActionsUnion<typeof SampleAppActions>;

function SampleAppReducer(state: SampleAppState = initialState, action: SampleAppActionsUnion): DeepReadonly<SampleAppState> {
  switch (action.type) {
    case "SampleApp:BACKSTAGESHOW": {
      return { ...state, backstageVisible: true };
    }
    case "SampleApp:BACKSTAGEHIDE": {
      return { ...state, backstageVisible: false };
    }
    case "SampleApp:SETIMODELCONNECTION": {
      return { ...state, currentIModelConnection: action.payload.iModelConnection };
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
      ClientConfig.devCorsProxyServer = `http://${window.location.hostname}:${process.env.CORS_PROXY_PORT}`; // By default, this will run on port 3001

    UiCore.initialize(SampleAppIModelApp.i18n);
    UiComponents.initialize(SampleAppIModelApp.i18n);
    UiFramework.initialize(SampleAppIModelApp.store, SampleAppIModelApp.i18n);

    // Register tools.
    BackstageShow.register(this.sampleAppNamespace);
    BackstageHide.register(this.sampleAppNamespace);
    BackstageToggle.register(this.sampleAppNamespace);
  }

  public static handleIModelViewsSelected(_project: ProjectInfo, iModelConnection: IModelConnection, viewIdsSelected: Id64Props[]): void {
    // we create a FrontStage that contains the views that we want.
    const frontstageProps: FrontstageProps | undefined = new ViewsFrontstage(viewIdsSelected, iModelConnection).defineProps();
    if (frontstageProps) {
      ConfigurableUiManager.loadFrontstage(frontstageProps);
      const frontstageDef = FrontstageManager.findFrontstageDef(frontstageProps.id);
      FrontstageManager.setActiveFrontstageDef(frontstageDef);

      const payload = { iModelConnection };
      SampleAppIModelApp.store.dispatch({ type: "SampleApp:SETIMODELCONNECTION", payload });
    }
  }
}

SampleAppIModelApp.startup();
// wait for both our i18n namespaces to be read.
Promise.all([SampleAppIModelApp.sampleAppNamespace.readFinished]).then(() => {
  //  create the application icon.
  const applicationIconStyle: CSSProperties = {
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
  };

  AppUi.initialize();

  ReactDOM.render(
    <Provider store={SampleAppIModelApp.store} >
      <OverallContent {...overallContentProps} />
    </Provider >,
    document.getElementById("root") as HTMLElement,
  );
});
