/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as ReactDOM from "react-dom";
import { Store } from "redux";  // createStore,
import { Provider, connect } from "react-redux";
import { Id64String, OpenMode, Logger, LogLevel, isElectronRenderer } from "@bentley/bentleyjs-core";
import { Config, OidcFrontendClientConfiguration, AccessToken, isIOidcFrontendClient } from "@bentley/imodeljs-clients";
import {
  RpcConfiguration, RpcOperation, IModelToken, ElectronRpcManager,
  BentleyCloudRpcManager, OidcDesktopClientConfiguration,
} from "@bentley/imodeljs-common";
import {
  IModelApp, IModelConnection, SnapMode, AccuSnap, ViewClipByPlaneTool, RenderSystem,
  IModelAppOptions, SelectionTool, ViewState,
} from "@bentley/imodeljs-frontend";
import { MarkupApp } from "@bentley/imodeljs-markup";
import { I18NNamespace } from "@bentley/imodeljs-i18n";
import { Presentation } from "@bentley/presentation-frontend";
import { getClassName } from "@bentley/ui-abstract";
import { UiCore } from "@bentley/ui-core";
import { UiComponents, BeDragDropContext } from "@bentley/ui-components";
import {
  UiFramework, FrameworkReducer, AppNotificationManager, FrameworkUiAdmin,   // , FrameworkState
  IModelInfo, FrontstageManager, createAction, ActionsUnion, DeepReadonly, ProjectInfo,
  ConfigurableUiContent, ThemeManager, DragDropLayerRenderer, SyncUiEventDispatcher, // combineReducers,
  FrontstageDef,
  SafeAreaContext,
  ToolbarDragInteractionContext,
  StateManager,
  FrameworkRootState,
  FrameworkVersion,
} from "@bentley/ui-framework";
import getSupportedRpcs from "../common/rpcs";
import { AppUi } from "./appui/AppUi";
import { ViewsFrontstage } from "./appui/frontstages/ViewsFrontstage";
import { Tool1 } from "./tools/Tool1";
import { Tool2 } from "./tools/Tool2";
import { ToolWithSettings } from "./tools/ToolWithSettings";
import { AnalysisAnimationTool } from "./tools/AnalysisAnimation";
import { UiProviderTool } from "./tools/UiProviderTool";
import { IModelViewportControl } from "./appui/contentviews/IModelViewport";

// Mobx demo
import { configure as mobxConfigure } from "mobx";

import "./index.scss";
import { TestAppConfiguration } from "../common/TestAppConfiguration";
import { LocalFileOpenFrontstage } from "./appui/frontstages/LocalFileStage";
import { SafeAreaInsets } from "@bentley/ui-ninezone";
import { AppBackstageComposer } from "./appui/backstage/AppBackstageComposer";

// Initialize my application gateway configuration for the frontend
RpcConfiguration.developmentMode = true;
let rpcConfiguration: RpcConfiguration;
const rpcInterfaces = getSupportedRpcs();
if (isElectronRenderer)
  rpcConfiguration = ElectronRpcManager.initializeClient({}, rpcInterfaces);
else
  rpcConfiguration = BentleyCloudRpcManager.initializeClient({ info: { title: "ui-test-app", version: "v1.0" }, uriPrefix: "http://localhost:3001" }, rpcInterfaces);

// WIP: WebAppRpcProtocol seems to require an IModelToken for every RPC request
for (const definition of rpcConfiguration.interfaces())
  RpcOperation.forEach(definition, (operation) => operation.policy.token = (request) => (request.findTokenPropsParameter() || new IModelToken("test", "test", "test", "test", OpenMode.Readonly)));

// cSpell:ignore setTestProperty sampleapp uitestapp setisimodellocal projectwise
/** Action Ids used by redux and to send sync UI components. Typically used to refresh visibility or enable state of control.
 * Use lower case strings to be compatible with SyncUi processing.
 */
export enum SampleAppUiActionId {
  setTestProperty = "sampleapp:settestproperty",
  setAnimationViewId = "sampleapp:setAnimationViewId",
  setIsIModelLocal = "sampleapp:setisimodellocal",
  toggleDragInteraction = "sampleapp:toggledraginteraction",
}

export interface SampleAppState {
  testProperty: string;
  animationViewId: string;
  dragInteraction: boolean;
  isIModelLocal: boolean;
}

const initialState: SampleAppState = {
  testProperty: "",
  animationViewId: "",
  dragInteraction: true,
  isIModelLocal: false,
};

// An object with a function that creates each OpenIModelAction that can be handled by our reducer.
// tslint:disable-next-line:variable-name
export const SampleAppActions = {
  setTestProperty: (testProperty: string) => createAction(SampleAppUiActionId.setTestProperty, testProperty),
  setAnimationViewId: (viewId: string) => createAction(SampleAppUiActionId.setAnimationViewId, viewId),
  setIsIModelLocal: (isIModelLocal: boolean) => createAction(SampleAppUiActionId.setIsIModelLocal, isIModelLocal),
  toggleDragInteraction: () => createAction(SampleAppUiActionId.toggleDragInteraction),
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
    case SampleAppUiActionId.setTestProperty: {
      return { ...state, testProperty: action.payload };
    }
    case SampleAppUiActionId.setAnimationViewId: {
      return { ...state, animationViewId: action.payload };
    }
    case SampleAppUiActionId.setIsIModelLocal: {
      return { ...state, isIModelLocal: action.payload };
    }
    case SampleAppUiActionId.toggleDragInteraction: {
      return { ...state, dragInteraction: !state.dragInteraction };
    }
  }

  return state;
}

// React-redux interface stuff
export interface RootState extends FrameworkRootState {
  sampleAppState: SampleAppState;
}

interface SampleIModelParams {
  projectId: string;
  iModelId: string;
  viewIds?: string[];
  stageId?: string;
}

export class SampleAppIModelApp {
  public static sampleAppNamespace: I18NNamespace;
  // if using StateManager that supports states from plugins and snippets then we don't explicitly setup redux store in app we just
  // pass our reducer map to the StateManager constructor.
  // deprecated - public static store: Store<RootState>;
  // deprecated - public static rootReducer: any;
  public static iModelParams: SampleIModelParams | undefined;
  private static _appStateManager: StateManager | undefined;

  public static get store(): Store<RootState> {
    return StateManager.store as Store<RootState>;
  }

  public static startup(opts?: IModelAppOptions): void {
    opts = opts ? opts : {};
    opts.accuSnap = new SampleAppAccuSnap();
    opts.notifications = new AppNotificationManager();
    opts.uiAdmin = new FrameworkUiAdmin();
    IModelApp.startup(opts);

    this.sampleAppNamespace = IModelApp.i18n.registerNamespace("SampleApp");

    // use new state manager that allows dynamic additions from plugins and snippets
    if (!this._appStateManager) {
      this._appStateManager = new StateManager({
        sampleAppState: SampleAppReducer,
        frameworkState: FrameworkReducer,
      });
    }

    ////////////////////////////////////////////////////////
    // deprecated was of handling state locally.
    ////////////////////////////////////////////////////////
    // this is the rootReducer for the sample application.
    // this.rootReducer = combineReducers({
    //   sampleAppState: SampleAppReducer,
    //   frameworkState: FrameworkReducer,
    // });
    //
    // create the Redux Store.
    // this.store = createStore(this.rootReducer,
    //  (window as any).__REDUX_DEVTOOLS_EXTENSION__ && (window as any).__REDUX_DEVTOOLS_EXTENSION__());

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
    UiCore.initialize(IModelApp.i18n); // tslint:disable-line:no-floating-promises
    UiComponents.initialize(IModelApp.i18n); // tslint:disable-line:no-floating-promises

    const oidcConfiguration = this.getOidcConfiguration();
    await UiFramework.initialize(undefined, IModelApp.i18n, oidcConfiguration);

    // initialize Presentation
    await Presentation.initialize({
      activeLocale: IModelApp.i18n.languageList()[0],
    });
    Presentation.selection.scopes.activeScope = "top-assembly";

    // Register tools.
    Tool1.register(this.sampleAppNamespace);
    Tool2.register(this.sampleAppNamespace);
    ToolWithSettings.register(this.sampleAppNamespace);
    AnalysisAnimationTool.register(this.sampleAppNamespace);
    UiProviderTool.register(this.sampleAppNamespace);

    IModelApp.toolAdmin.defaultToolId = SelectionTool.toolId;

    // store name of this registered control in Redux store so it can be access by plugins
    UiFramework.setDefaultIModelViewportControlId(IModelViewportControl.id);

    await MarkupApp.initialize();
  }

  private static getOidcConfiguration(): OidcFrontendClientConfiguration | OidcDesktopClientConfiguration {
    const scope = "openid email profile organization imodelhub context-registry-service:read-only product-settings-service projectwise-share urlps-third-party";
    if (isElectronRenderer) {
      const clientId = "imodeljs-electron-test";
      const redirectUri = "http://localhost:3000/signin-callback";
      const oidcConfiguration: OidcDesktopClientConfiguration = { clientId, redirectUri, scope: scope + " offline_access" };
      return oidcConfiguration;
    } else {
      const clientId = "imodeljs-spa-test";
      const redirectUri = "http://localhost:3000/signin-callback";
      const postSignoutRedirectUri = "http://localhost:3000/";
      const oidcConfiguration: OidcFrontendClientConfiguration = { clientId, redirectUri, postSignoutRedirectUri, scope: scope + " imodeljs-router", responseType: "code" };
      return oidcConfiguration;
    }
  }

  // cSpell:enable

  public static loggerCategory(obj: any): string {
    const className = getClassName(obj);
    const category = `ui-test-app.${className}`;
    return category;
  }

  public static async openIModelAndViews(projectId: string, iModelId: string, viewIdsSelected: Id64String[]) {
    // Close the current iModelConnection
    await SampleAppIModelApp.closeCurrentIModel();

    // open the imodel
    Logger.logInfo(SampleAppIModelApp.loggerCategory(this), `openIModelAndViews: projectId=${projectId}&iModelId=${iModelId}`);
    const iModelConnection = await UiFramework.iModelServices.openIModel(projectId, iModelId);
    SampleAppIModelApp.setIsIModelLocal(false, true);

    await this.openViews(iModelConnection, viewIdsSelected);
  }

  public static async closeCurrentIModel() {
    const currentIModelConnection = UiFramework.getIModelConnection();
    if (currentIModelConnection) {
      SyncUiEventDispatcher.clearConnectionEvents(currentIModelConnection);

      if (SampleAppIModelApp.isIModelLocal)
        await currentIModelConnection.closeSnapshot();
      else
        await currentIModelConnection.close();
      UiFramework.setIModelConnection(undefined);
    }
  }

  public static async openViews(iModelConnection: IModelConnection, viewIdsSelected: Id64String[]) {
    let viewIdsParam = "";
    viewIdsSelected.forEach((viewId: string, index: number) => {
      if (index > 0)
        viewIdsParam += `&`;
      viewIdsParam += `viewId=${viewId}`;
    });
    Logger.logInfo(SampleAppIModelApp.loggerCategory(this), `openViews: ${viewIdsParam}`);

    SyncUiEventDispatcher.initializeConnectionEvents(iModelConnection);

    // store the IModelConnection in the sample app store - this may trigger redux connected components
    UiFramework.setIModelConnection(iModelConnection, true);
    const viewStates: ViewState[] = [];
    let defaultViewState: ViewState | undefined;

    // store the first selected viewId as default - mostly used by frontstages defined in plugins that want to open a IModelViewport
    if (viewIdsSelected && viewIdsSelected.length > 0) {
      for (const viewId of viewIdsSelected) {
        const viewState = await iModelConnection.views.load(viewId);
        if (viewState) {
          if (!defaultViewState)
            defaultViewState = viewState;
          viewStates.push(viewState);
        }
      }
      if (defaultViewState)
        UiFramework.setDefaultViewState(defaultViewState);
    }

    // we create a Frontstage that contains the views that we want.
    let stageId: string;
    const viewsFrontstage = "ViewsFrontstage";

    if (this.iModelParams && this.iModelParams.stageId)
      stageId = this.iModelParams.stageId;
    else
      stageId = viewsFrontstage;

    let frontstageDef: FrontstageDef | undefined;
    if (stageId === viewsFrontstage) {
      const frontstageProvider = new ViewsFrontstage(viewStates, iModelConnection);
      FrontstageManager.addFrontstageProvider(frontstageProvider);
      frontstageDef = frontstageProvider.frontstageDef;
    } else {
      frontstageDef = FrontstageManager.findFrontstageDef(stageId);
    }

    if (frontstageDef) {
      FrontstageManager.setActiveFrontstageDef(frontstageDef).then(() => { // tslint:disable-line:no-floating-promises
        // Frontstage & ScreenViewports are ready
        Logger.logInfo(SampleAppIModelApp.loggerCategory(this), `Frontstage & ScreenViewports are ready`);
      });
    } else {
      throw new Error(`Frontstage with id "${stageId}" does not exist`);
    }
  }

  public static async handleWorkOffline() {
    await SampleAppIModelApp.showFrontstage("Test4");
  }

  public static async showIModelIndex(contextId: string, iModelId: string) {
    const currentConnection = UiFramework.getIModelConnection();
    if (!currentConnection || (currentConnection.iModelToken.iModelId !== iModelId)) {
      // Close the current iModelConnection
      await SampleAppIModelApp.closeCurrentIModel();

      // open the imodel
      Logger.logInfo(SampleAppIModelApp.loggerCategory(this), `showIModelIndex: projectId=${contextId}&iModelId=${iModelId}`);
      const iModelConnection = await UiFramework.iModelServices.openIModel(contextId, iModelId);
      SampleAppIModelApp.setIsIModelLocal(false, true);

      SyncUiEventDispatcher.initializeConnectionEvents(iModelConnection);

      // store the IModelConnection in the sample app store
      UiFramework.setIModelConnection(iModelConnection, true);
    }

    await SampleAppIModelApp.showFrontstage("IModelIndex");
  }

  public static async showIModelOpen(_iModels: IModelInfo[] | undefined) {
    await SampleAppIModelApp.showFrontstage("IModelOpen");
  }

  public static async showSignedOut() {
    await SampleAppIModelApp.showFrontstage("SignIn");
  }

  // called after the user has signed in (or access token is still valid)
  public static async showSignedIn() {
    // get the default IModel (from imodejs-config)
    let defaultImodel: IModelInfo | undefined;

    let viewId: string | undefined;
    if (Config.App.has("imjs_uitestapp_imodel_viewId"))
      viewId = Config.App.get("imjs_uitestapp_imodel_viewId");

    SampleAppIModelApp.iModelParams = SampleAppIModelApp._usingParams();

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
    } else if (SampleAppIModelApp.iModelParams) {
      if (SampleAppIModelApp.iModelParams.viewIds && SampleAppIModelApp.iModelParams.viewIds.length > 0) {
        // open directly into the iModel (view)
        await SampleAppIModelApp.openIModelAndViews(SampleAppIModelApp.iModelParams.projectId, SampleAppIModelApp.iModelParams.iModelId, SampleAppIModelApp.iModelParams.viewIds);
      } else {
        // open to the IModelIndex frontstage
        await SampleAppIModelApp.showIModelIndex(SampleAppIModelApp.iModelParams.projectId, SampleAppIModelApp.iModelParams.iModelId);
      }
    } else if (testAppConfiguration.startWithSnapshots) {
      // open to the Local File frontstage
      await LocalFileOpenFrontstage.open();
    } else {
      // open to the IModelOpen frontstage
      await SampleAppIModelApp.showIModelOpen(undefined);
    }
  }

  private static _usingParams(): SampleIModelParams | undefined {
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get("projectId");
    const iModelId = urlParams.get("iModelId");

    if (projectId && iModelId) {
      const viewIds = urlParams.getAll("viewId");
      const stageId = urlParams.get("stageId") || undefined;

      return { projectId, iModelId, viewIds, stageId };
    }

    return undefined;
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

  public static setIsIModelLocal(isIModelLocal: boolean, immediateSync = false) {
    UiFramework.dispatchActionToStore(SampleAppUiActionId.setIsIModelLocal, isIModelLocal, immediateSync);
  }

  public static get isIModelLocal(): boolean {
    return SampleAppIModelApp.store.getState().sampleAppState.isIModelLocal;
  }

  public static async showFrontstage(frontstageId: string) {
    const frontstageDef = FrontstageManager.findFrontstageDef(frontstageId);
    FrontstageManager.setActiveFrontstageDef(frontstageDef); // tslint:disable-line:no-floating-promises
  }
}

function AppDragInteractionComponent(props: { dragInteraction: boolean, children: React.ReactNode }) {
  return (
    <ToolbarDragInteractionContext.Provider value={props.dragInteraction}>
      {props.children}
    </ToolbarDragInteractionContext.Provider>
  );
}

function mapStateToProps(state: RootState) {
  return { dragInteraction: state.sampleAppState.dragInteraction };
}

// tslint:disable-next-line:variable-name
const AppDragInteraction = connect(mapStateToProps)(AppDragInteractionComponent);

export class SampleAppViewer extends React.Component<any> {

  constructor(props: any) {
    super(props);

    AppUi.initialize();
    this._initializeSignin(!!IModelApp.authorizationClient && IModelApp.authorizationClient.isAuthorized); // tslint:disable-line:no-floating-promises
  }

  private _initializeSignin = async (isAuthorized: boolean): Promise<void> => {
    return isAuthorized ? SampleAppIModelApp.showSignedIn() : SampleAppIModelApp.showSignedOut();
  }

  private _onUserStateChanged = (accessToken: AccessToken | undefined) => {
    this._initializeSignin(accessToken !== undefined); // tslint:disable-line:no-floating-promises
  }

  public componentDidMount() {
    const oidcClient = IModelApp.authorizationClient;
    if (isIOidcFrontendClient(oidcClient))
      oidcClient.onUserStateChanged.addListener(this._onUserStateChanged);
  }

  public componentWillUnmount() {
    const oidcClient = IModelApp.authorizationClient;
    if (isIOidcFrontendClient(oidcClient))
      oidcClient.onUserStateChanged.removeListener(this._onUserStateChanged);
  }

  public render(): JSX.Element {
    return (
      <Provider store={SampleAppIModelApp.store} >
        <ThemeManager>
          <BeDragDropContext>
            <SafeAreaContext.Provider value={SafeAreaInsets.All}>
              <AppDragInteraction>
                <FrameworkVersion version="2">
                  <ConfigurableUiContent
                    appBackstage={<AppBackstageComposer />}
                  />
                </FrameworkVersion>
              </AppDragInteraction>
            </SafeAreaContext.Provider>
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

// Retrieves the configuration for starting app from configuration.json file located in the built public folder
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
  if (!isElectronRenderer) {
    await retrieveConfiguration(); // (does a fetch)
    console.log("Configuration", JSON.stringify(testAppConfiguration)); // tslint:disable-line:no-console
  }

  // initialize logging
  Logger.initializeToConsole();
  Logger.setLevelDefault(LogLevel.Warning);
  Logger.setLevel("ui-test-app", LogLevel.Info);

  // Logger.setLevel("ui-framework.Toolbar", LogLevel.Info);  // used to show minimal output calculating toolbar overflow
  // Logger.setLevel("ui-framework.Toolbar", LogLevel.Trace);  // used to show detailed output calculating toolbar overflow
  // Logger.setLevel("ui-framework.DefaultToolSettings", LogLevel.Trace);  // used to show detailed output calculating default toolsettings

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
