/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ClientRequestContext, Config, Id64String, isElectronRenderer, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { ContextRegistryClient } from "@bentley/context-registry-client";
import { BrowserAuthorizationCallbackHandler, BrowserAuthorizationClient, BrowserAuthorizationClientConfiguration, FrontendAuthorizationClient, isFrontendAuthorizationClient } from "@bentley/frontend-authorization-client";
import { IModelHubClient, IModelQuery } from "@bentley/imodelhub-client";
import { BentleyCloudRpcManager, DesktopAuthorizationClientConfiguration, ElectronRpcManager, RpcConfiguration } from "@bentley/imodeljs-common";
import { AccuSnap, AuthorizedFrontendRequestContext, DesktopAuthorizationClient, ExternalServerExtensionLoader, IModelApp, IModelAppOptions, IModelConnection, RenderSystem, SelectionTool, SnapMode, ViewClipByPlaneTool, ViewState } from "@bentley/imodeljs-frontend";
import { I18NNamespace } from "@bentley/imodeljs-i18n";
import { MarkupApp } from "@bentley/imodeljs-markup";
import { AccessToken } from "@bentley/itwin-client";
import { Presentation } from "@bentley/presentation-frontend";
import { getClassName } from "@bentley/ui-abstract";
import { BeDragDropContext } from "@bentley/ui-components";
import { LocalUiSettings, UiSettings } from "@bentley/ui-core";
import { ActionsUnion, AppNotificationManager, ConfigurableUiContent, createAction, DeepReadonly, DragDropLayerRenderer, FrameworkReducer, FrameworkRootState, FrameworkUiAdmin, FrameworkVersion, FrontstageDef, FrontstageManager, IModelAppUiSettings, IModelInfo, SafeAreaContext, StateManager, SyncUiEventDispatcher, ThemeManager, ToolbarDragInteractionContext, UiFramework, UiSettingsProvider } from "@bentley/ui-framework";
import { SafeAreaInsets } from "@bentley/ui-ninezone";
// Mobx demo
import { configure as mobxConfigure } from "mobx";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { connect, Provider } from "react-redux";
import { Store } from "redux"; // createStore,
import getSupportedRpcs from "../common/rpcs";
import { TestAppConfiguration } from "../common/TestAppConfiguration";
import { AppUi } from "./appui/AppUi";
import { AppBackstageComposer } from "./appui/backstage/AppBackstageComposer";
import { IModelViewportControl } from "./appui/contentviews/IModelViewport";
import { LocalFileOpenFrontstage } from "./appui/frontstages/LocalFileStage";
import { ViewsFrontstage } from "./appui/frontstages/ViewsFrontstage";
import { AppUiSettings } from "./AppUiSettings";
import { AppViewManager } from "./favorites/AppViewManager"; // Favorite Properties Support
import { ElementSelectionListener } from "./favorites/ElementSelectionListener"; // Favorite Properties Support
import "./index.scss";
import { AnalysisAnimationTool } from "./tools/AnalysisAnimation";
import { LayoutManagerRestoreLayoutTool } from "./tools/LayoutManagerTool";
import { Tool1 } from "./tools/Tool1";
import { Tool2 } from "./tools/Tool2";
import { ToolWithSettings } from "./tools/ToolWithSettings";
import { UiProviderTool } from "./tools/UiProviderTool";

// Initialize my application gateway configuration for the frontend
RpcConfiguration.developmentMode = true;
const rpcInterfaces = getSupportedRpcs();
if (isElectronRenderer) {
  ElectronRpcManager.initializeClient({}, rpcInterfaces);
} else {
  BentleyCloudRpcManager.initializeClient({ info: { title: "ui-test-app", version: "v1.0" }, uriPrefix: "http://localhost:3001" }, rpcInterfaces);
}

// cSpell:ignore setTestProperty sampleapp uitestapp setisimodellocal projectwise toggledraginteraction toggleframeworkversion
// cSpell:ignore mobx setdraginteraction setframeworkversion
/** Action Ids used by redux and to send sync UI components. Typically used to refresh visibility or enable state of control.
 * Use lower case strings to be compatible with SyncUi processing.
 */
export enum SampleAppUiActionId {
  setTestProperty = "sampleapp:settestproperty",
  setAnimationViewId = "sampleapp:setAnimationViewId",
  setIsIModelLocal = "sampleapp:setisimodellocal",
  toggleDragInteraction = "sampleapp:toggledraginteraction",
  toggleFrameworkVersion = "sampleapp:toggleframeworkversion",
  setDragInteraction = "sampleapp:setdraginteraction",
  setFrameworkVersion = "sampleapp:setframeworkversion",
}

export interface SampleAppState {
  testProperty: string;
  animationViewId: string;
  dragInteraction: boolean;
  frameworkVersion: string;
  isIModelLocal: boolean;
}

const initialState: SampleAppState = {
  testProperty: "",
  animationViewId: "",
  dragInteraction: true,
  frameworkVersion: "1",
  isIModelLocal: false,
};

// An object with a function that creates each OpenIModelAction that can be handled by our reducer.
// tslint:disable-next-line:variable-name
export const SampleAppActions = {
  setTestProperty: (testProperty: string) => createAction(SampleAppUiActionId.setTestProperty, testProperty),
  setAnimationViewId: (viewId: string) => createAction(SampleAppUiActionId.setAnimationViewId, viewId),
  setIsIModelLocal: (isIModelLocal: boolean) => createAction(SampleAppUiActionId.setIsIModelLocal, isIModelLocal),
  toggleDragInteraction: () => createAction(SampleAppUiActionId.toggleDragInteraction),
  toggleFrameworkVersion: () => createAction(SampleAppUiActionId.toggleFrameworkVersion),
  setDragInteraction: (dragInteraction: boolean) => createAction(SampleAppUiActionId.setDragInteraction, dragInteraction),
  setFrameworkVersion: (frameworkVersion: string) => createAction(SampleAppUiActionId.setFrameworkVersion, frameworkVersion),
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
    case SampleAppUiActionId.toggleFrameworkVersion: {
      return { ...state, frameworkVersion: state.frameworkVersion === "1" ? "2" : "1" };
    }
    case SampleAppUiActionId.setDragInteraction: {
      return { ...state, dragInteraction: action.payload };
    }
    case SampleAppUiActionId.setFrameworkVersion: {
      return { ...state, frameworkVersion: action.payload };
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
  // If we use the StateManager, then the app supports combining reducers from extensions and snippets. If we use the StateManage then don't explicitly setup redux store in app,
  // just pass the app's reducers to the StateManager constructor.
  // deprecated - public static store: Store<RootState>;
  // deprecated - public static rootReducer: any;
  public static iModelParams: SampleIModelParams | undefined;
  private static _appStateManager: StateManager | undefined;
  private static _uiSettings: UiSettings | undefined;
  private static _appUiSettings = new AppUiSettings();

  // Favorite Properties Support
  private static _selectionSetListener = new ElementSelectionListener(true);

  public static get store(): Store<RootState> {
    return StateManager.store as Store<RootState>;
  }

  public static get uiSettings(): UiSettings { return SampleAppIModelApp._uiSettings || new LocalUiSettings(); }
  public static set uiSettings(v: UiSettings) {
    SampleAppIModelApp._uiSettings = v;

    SampleAppIModelApp._appUiSettings.apply(v);  // tslint:disable-line: no-floating-promises
  }

  public static get appUiSettings(): AppUiSettings { return SampleAppIModelApp._appUiSettings; }

  public static async startup(opts?: IModelAppOptions): Promise<void> {
    opts = opts ? opts : {};
    opts.accuSnap = new SampleAppAccuSnap();
    opts.notifications = new AppNotificationManager();
    opts.uiAdmin = new FrameworkUiAdmin();
    opts.viewManager = new AppViewManager(true);  // Favorite Properties Support
    await IModelApp.startup(opts);

    // For testing local extensions only, should not be used in production.
    IModelApp.extensionAdmin.addExtensionLoaderFront(new ExternalServerExtensionLoader("http://localhost:3000"));

    this.sampleAppNamespace = IModelApp.i18n.registerNamespace("SampleApp");

    // use new state manager that allows dynamic additions from plugins and snippets
    if (!this._appStateManager) {
      this._appStateManager = new StateManager({
        sampleAppState: SampleAppReducer,
        frameworkState: FrameworkReducer,
      });
    }

    //////////////////////////////////////////////////////////////////////////////
    // Deprecated way of handling state locally. See use of StateManager above.
    // Using the StateManager allows extensions and snippet packages to incrementally
    // add their reducers to the global Redux store.
    //////////////////////////////////////////////////////////////////////////////
    // this is the rootReducer for the sample application.
    // this.rootReducer = combineReducers({
    //   sampleAppState: SampleAppReducer,
    //   frameworkState: FrameworkReducer,
    // });
    //
    // create the Redux Store.
    // this.store = createStore(this.rootReducer,
    //  (window as any).__REDUX_DEVTOOLS_EXTENSION__ && (window as any).__REDUX_DEVTOOLS_EXTENSION__());
    //////////////////////////////////////////////////////////////////////////////

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
    await UiFramework.initialize(undefined);

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
    LayoutManagerRestoreLayoutTool.register(this.sampleAppNamespace);

    IModelApp.toolAdmin.defaultToolId = SelectionTool.toolId;

    // store name of this registered control in Redux store so it can be access by plugins
    UiFramework.setDefaultIModelViewportControlId(IModelViewportControl.id);

    await MarkupApp.initialize();

    // Favorite Properties Support
    SampleAppIModelApp._selectionSetListener.initialize();
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
    if (!currentConnection || (currentConnection.iModelId !== iModelId)) {
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
    let viewId: string | undefined;
    if (Config.App.has("imjs_uitestapp_imodel_viewId"))
      viewId = Config.App.get("imjs_uitestapp_imodel_viewId");

    SampleAppIModelApp.iModelParams = SampleAppIModelApp._usingParams();

    if (Config.App.has("imjs_uitestapp_imodel_name") && Config.App.has("imjs_uitestapp_imodel_project_name")) {
      const projectName = Config.App.getString("imjs_uitestapp_imodel_project_name");
      const iModelName = Config.App.getString("imjs_uitestapp_imodel_name");

      const requestContext = await AuthorizedFrontendRequestContext.create();
      const project = await (new ContextRegistryClient()).getProject(requestContext, {
        $select: "*",
        $filter: "Name+eq+'" + projectName + "'",
      });

      const iModel = (await (new IModelHubClient()).iModels.get(requestContext, project.wsgId, new IModelQuery().byName(iModelName)))[0];

      if (viewId) {
        // open directly into the iModel (view)
        await SampleAppIModelApp.openIModelAndViews(project.wsgId, iModel.wsgId, [viewId!]);
      } else {
        // open to the IModelIndex frontstage
        await SampleAppIModelApp.showIModelIndex(project.wsgId, iModel.wsgId);
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

function AppFrameworkVersionComponent(props: { frameworkVersion: string, children: React.ReactNode }) {
  return (
    <FrameworkVersion version={props.frameworkVersion === "2" ? "2" : "1"}>
      {props.children}
    </FrameworkVersion>
  );
}

function mapDragInteractionStateToProps(state: RootState) {
  return { dragInteraction: state.sampleAppState.dragInteraction };
}

function mapFrameworkVersionStateToProps(state: RootState) {
  return { frameworkVersion: state.sampleAppState.frameworkVersion };
}

// tslint:disable-next-line:variable-name
const AppDragInteraction = connect(mapDragInteractionStateToProps)(AppDragInteractionComponent);
// tslint:disable-next-line: variable-name
const AppFrameworkVersion = connect(mapFrameworkVersionStateToProps)(AppFrameworkVersionComponent);

class SampleAppViewer extends React.Component<any, { authorized: boolean }> {
  constructor(props: any) {
    super(props);

    AppUi.initialize();

    const authorized = !!IModelApp.authorizationClient && IModelApp.authorizationClient.isAuthorized;
    this._initializeSignin(authorized); // tslint:disable-line:no-floating-promises

    this.state = {
      authorized,
    };
  }

  private _initializeSignin = async (authorized: boolean): Promise<void> => {
    this.setUiSettings(authorized);
    return authorized ? SampleAppIModelApp.showSignedIn() : SampleAppIModelApp.showSignedOut();
  }

  private _onUserStateChanged = (_accessToken: AccessToken | undefined) => {
    const authorized = !!IModelApp.authorizationClient && IModelApp.authorizationClient.isAuthorized;

    this.setState({ authorized });
    this._initializeSignin(authorized); // tslint:disable-line:no-floating-promises
  }

  private setUiSettings(authorized: boolean): void {
    SampleAppIModelApp.uiSettings = authorized ? new IModelAppUiSettings() : new LocalUiSettings();
  }

  public componentDidMount() {
    const oidcClient = IModelApp.authorizationClient;
    if (isFrontendAuthorizationClient(oidcClient))
      oidcClient.onUserStateChanged.addListener(this._onUserStateChanged);
  }

  public componentWillUnmount() {
    const oidcClient = IModelApp.authorizationClient;
    if (isFrontendAuthorizationClient(oidcClient))
      oidcClient.onUserStateChanged.removeListener(this._onUserStateChanged);
  }

  public render(): JSX.Element {
    return (
      <Provider store={SampleAppIModelApp.store} >
        <ThemeManager>
          <BeDragDropContext>
            <SafeAreaContext.Provider value={SafeAreaInsets.All}>
              <AppDragInteraction>
                <AppFrameworkVersion>
                  {/** UiSettingsProvider is optional. By default LocalUiSettings is used to store UI settings. */}
                  <UiSettingsProvider uiSettings={SampleAppIModelApp.uiSettings}>
                    <ConfigurableUiContent
                      appBackstage={<AppBackstageComposer />}
                    />
                  </UiSettingsProvider>
                </AppFrameworkVersion>
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

function getOidcConfiguration(): BrowserAuthorizationClientConfiguration | DesktopAuthorizationClientConfiguration {
  const redirectUri = "http://localhost:3000/signin-callback";
  const baseOidcScope = "openid email profile organization imodelhub context-registry-service:read-only product-settings-service projectwise-share urlps-third-party imodel-extension-service-api";

  return isElectronRenderer
    ? {
      clientId: "imodeljs-electron-test",
      redirectUri,
      scope: baseOidcScope + " offline_access",
    }
    : {
      clientId: "imodeljs-spa-test",
      redirectUri,
      scope: baseOidcScope + " imodeljs-router",
      responseType: "code",
    };
}

async function handleOidcCallback(oidcConfiguration: BrowserAuthorizationClientConfiguration): Promise<void> {
  if (!isElectronRenderer) {
    await BrowserAuthorizationCallbackHandler.handleSigninCallback(oidcConfiguration.redirectUri);
  }
}

async function createOidcClient(requestContext: ClientRequestContext, oidcConfiguration: BrowserAuthorizationClientConfiguration | DesktopAuthorizationClientConfiguration): Promise<FrontendAuthorizationClient> {
  if (isElectronRenderer) {
    const desktopClient = new DesktopAuthorizationClient(oidcConfiguration as DesktopAuthorizationClientConfiguration);
    await desktopClient.initialize(requestContext);
    return desktopClient;
  } else {
    const browserClient = new BrowserAuthorizationClient(oidcConfiguration as BrowserAuthorizationClientConfiguration);
    try {
      await browserClient.signInSilent(requestContext);
    } catch (err) { }
    return browserClient;
  }
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
  Logger.setLevel("ui-framework.UiFramework", LogLevel.Info);

  // Logger.setLevel("ui-framework.Toolbar", LogLevel.Info);  // used to show minimal output calculating toolbar overflow
  // Logger.setLevel("ui-framework.Toolbar", LogLevel.Trace);  // used to show detailed output calculating toolbar overflow
  // Logger.setLevel("ui-framework.DefaultToolSettings", LogLevel.Trace);  // used to show detailed output calculating default toolsettings

  const oidcConfig = getOidcConfiguration();
  await handleOidcCallback(oidcConfig);
  const oidcClient = await createOidcClient(new ClientRequestContext(), oidcConfig);

  // Set up render option to displaySolarShadows.
  const renderSystemOptions: RenderSystem.Options = {
    displaySolarShadows: true,
  };

  // Start the app.
  await SampleAppIModelApp.startup({ renderSys: renderSystemOptions, authorizationClient: oidcClient });

  // wait for both our i18n namespaces to be read.
  await SampleAppIModelApp.initialize();
  ReactDOM.render(<SampleAppViewer />, document.getElementById("root") as HTMLElement);
}

// Entry point - run the main function
main(); // tslint:disable-line:no-floating-promises
