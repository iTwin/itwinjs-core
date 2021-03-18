/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./index.scss";
// Mobx demo
import { configure as mobxConfigure } from "mobx";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { connect, Provider } from "react-redux";
import { Store } from "redux"; // createStore,
import reactAxe from "@axe-core/react";
import { ClientRequestContext, Config, Id64String, Logger, LogLevel, OpenMode, ProcessDetector } from "@bentley/bentleyjs-core";
import { ContextRegistryClient } from "@bentley/context-registry-client";
import { ElectronApp } from "@bentley/electron-manager/lib/ElectronFrontend";
import { FrontendApplicationInsightsClient } from "@bentley/frontend-application-insights-client";
import {
  BrowserAuthorizationClientConfiguration, isFrontendAuthorizationClient,
} from "@bentley/frontend-authorization-client";
import { FrontendDevTools } from "@bentley/frontend-devtools";
import { HyperModeling } from "@bentley/hypermodeling-frontend";
import { IModelHubClient, IModelQuery } from "@bentley/imodelhub-client";
import { BentleyCloudRpcParams, IModelVersion, NativeAppAuthorizationConfiguration, RpcConfiguration, SyncMode } from "@bentley/imodeljs-common";
import {
  AccuSnap, AuthorizedFrontendRequestContext, BriefcaseConnection, ExternalServerExtensionLoader, IModelApp, IModelConnection, LocalUnitFormatProvider, NativeApp,
  NativeAppLogger, NativeAppOpts, SelectionTool, SnapMode, ToolAdmin, ViewClipByPlaneTool, ViewState, WebViewerApp, WebViewerAppOpts,
} from "@bentley/imodeljs-frontend";
import { I18NNamespace } from "@bentley/imodeljs-i18n";
import { MarkupApp } from "@bentley/imodeljs-markup";
import { AccessToken, ProgressInfo, UrlDiscoveryClient } from "@bentley/itwin-client";
// To test map-layer extension comment out the following and ensure ui-test-app\build\imjs_extensions contains map-layers, if not see Readme.md in map-layers package.
import { MapLayersUI } from "@bentley/map-layers";
import { AndroidApp, IOSApp } from "@bentley/mobile-manager/lib/MobileFrontend";
import { PresentationUnitSystem } from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";
import { getClassName } from "@bentley/ui-abstract";
import { BeDragDropContext } from "@bentley/ui-components";
import { LocalUiSettings, UiSettings } from "@bentley/ui-core";
import {
  ActionsUnion, AppNotificationManager, ConfigurableUiContent, createAction, DeepReadonly, DragDropLayerRenderer, FrameworkAccuDraw, FrameworkReducer,
  FrameworkRootState, FrameworkToolAdmin, FrameworkUiAdmin, FrameworkVersion, FrontstageDeactivatedEventArgs, FrontstageDef, FrontstageManager,
  IModelAppUiSettings, IModelInfo, ModalFrontstageClosedEventArgs, SafeAreaContext, StateManager, SyncUiEventDispatcher, ThemeManager,
  ToolbarDragInteractionContext, UiFramework, UiSettingsProvider,
} from "@bentley/ui-framework";
import { SafeAreaInsets } from "@bentley/ui-ninezone";
import { getSupportedRpcs } from "../common/rpcs";
import { TestAppConfiguration } from "../common/TestAppConfiguration";
import { ActiveSettingsManager } from "./api/ActiveSettingsManager";
import { BearingQuantityType } from "./api/BearingQuantityType";
import { ErrorHandling } from "./api/ErrorHandling";
import { AppUi } from "./appui/AppUi";
import { AppBackstageComposer } from "./appui/backstage/AppBackstageComposer";
import { IModelViewportControl } from "./appui/contentviews/IModelViewport";
import { EditFrontstage } from "./appui/frontstages/editing/EditFrontstage";
import { LocalFileOpenFrontstage } from "./appui/frontstages/LocalFileStage";
import { ViewsFrontstage } from "./appui/frontstages/ViewsFrontstage";
import { AppSettingsProvider } from "./appui/uiproviders/AppSettingsProvider";
import { AppUiSettings } from "./AppUiSettings";
import { AppViewManager } from "./favorites/AppViewManager"; // Favorite Properties Support
import { ElementSelectionListener } from "./favorites/ElementSelectionListener"; // Favorite Properties Support
import { AnalysisAnimationTool } from "./tools/AnalysisAnimation";
import { DeleteElementTool } from "./tools/editing/DeleteElementTool";
import { MoveElementTool } from "./tools/editing/MoveElementTool";
import { PlaceBlockTool } from "./tools/editing/PlaceBlockTool";
import { PlaceLineStringTool } from "./tools/editing/PlaceLineStringTool";
import { Tool1 } from "./tools/Tool1";
import { Tool2 } from "./tools/Tool2";
import { ToolWithDynamicSettings } from "./tools/ToolWithDynamicSettings";
import { ToolWithSettings } from "./tools/ToolWithSettings";
import { UiProviderTool } from "./tools/UiProviderTool";

// Initialize my application gateway configuration for the frontend
RpcConfiguration.developmentMode = true;

// cSpell:ignore setTestProperty sampleapp uitestapp setisimodellocal projectwise mobx hypermodeling testapp urlps
// cSpell:ignore toggledraginteraction toggleframeworkversion setdraginteraction setframeworkversion

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
      const snapMode = SampleAppIModelApp.store.getState().frameworkState.configurableUiState.snapMode;
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
  public static iModelParams: SampleIModelParams | undefined;
  public static testAppConfiguration: TestAppConfiguration | undefined;
  private static _appStateManager: StateManager | undefined;
  private static _appUiSettings = new AppUiSettings();

  // Favorite Properties Support
  private static _selectionSetListener = new ElementSelectionListener(true);

  public static get store(): Store<RootState> {
    return StateManager.store as Store<RootState>;
  }

  public static get uiSettings(): UiSettings {
    return UiFramework.getUiSettings();
  }

  public static set uiSettings(v: UiSettings) {
    UiFramework.setUiSettings(v);
    SampleAppIModelApp._appUiSettings.apply(v);  // eslint-disable-line @typescript-eslint/no-floating-promises
  }

  public static get appUiSettings(): AppUiSettings { return SampleAppIModelApp._appUiSettings; }

  public static async startup(opts: WebViewerAppOpts & NativeAppOpts): Promise<void> {
    if (ProcessDetector.isElectronAppFrontend) {
      await ElectronApp.startup(opts);
      NativeAppLogger.initialize();
    } else if (ProcessDetector.isIOSAppFrontend) {
      await IOSApp.startup(opts);
    } else if (ProcessDetector.isAndroidAppFrontend)
      await AndroidApp.startup(opts);
    else
      await WebViewerApp.startup(opts);

    // For testing local extensions only, should not be used in production.
    IModelApp.extensionAdmin.addExtensionLoaderFront(new ExternalServerExtensionLoader("http://localhost:3000"));

    this.sampleAppNamespace = IModelApp.i18n.registerNamespace("SampleApp");

    // use new state manager that allows dynamic additions from extensions and snippets
    if (!this._appStateManager) {
      this._appStateManager = new StateManager({
        sampleAppState: SampleAppReducer,
        frameworkState: FrameworkReducer,
      });
    }

    // register local commands.
    // register core commands not automatically registered
    ViewClipByPlaneTool.register();

    // Mobx configuration
    mobxConfigure({ enforceActions: "observed" });

    if (SampleAppIModelApp.testAppConfiguration?.reactAxeConsole) {
      if (process.env.NODE_ENV !== "production") {
        await reactAxe(React, ReactDOM, 1000);
      }
    }
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
    ToolWithDynamicSettings.register(this.sampleAppNamespace);

    // Register editing tools
    if (this.allowWrite) {
      MoveElementTool.register(this.sampleAppNamespace);
      DeleteElementTool.register(this.sampleAppNamespace);
      PlaceLineStringTool.register(this.sampleAppNamespace);
      PlaceBlockTool.register(this.sampleAppNamespace);
    }

    IModelApp.toolAdmin.defaultToolId = SelectionTool.toolId;
    IModelApp.uiAdmin.updateFeatureFlags({ allowKeyinPalette: true });

    // store name of this registered control in Redux store so it can be access by extensions
    UiFramework.setDefaultIModelViewportControlId(IModelViewportControl.id);

    await MarkupApp.initialize();
    await FrontendDevTools.initialize();
    // Favorite Properties Support
    SampleAppIModelApp._selectionSetListener.initialize();

    // default to showing imperial formatted units
    await IModelApp.quantityFormatter.setActiveUnitSystem("imperial");
    Presentation.presentation.activeUnitSystem = PresentationUnitSystem.BritishImperial;
    await IModelApp.quantityFormatter.setUnitFormattingSettingsProvider(new LocalUnitFormatProvider(IModelApp.quantityFormatter, true)); // pass true to save per imodel

    await FrontendDevTools.initialize();
    await HyperModeling.initialize();
    // To test map-layer extension comment out the following and ensure ui-test-app\build\imjs_extensions contains map-layers, if not see Readme.md in map-layers package.
    await MapLayersUI.initialize(false); // if false then add widget in FrontstageDef

    AppSettingsProvider.initializeAppSettingProvider();
    // try starting up event loop if not yet started so key-in palette can be opened
    IModelApp.startEventLoop();
  }

  public static loggerCategory(obj: any): string {
    const className = getClassName(obj);
    const category = `ui-test-app.${className}`;
    return category;
  }

  public static async openIModelAndViews(projectId: string, iModelId: string, viewIdsSelected: Id64String[]) {
    // Close the current iModelConnection
    await SampleAppIModelApp.closeCurrentIModel();

    // open the imodel
    Logger.logInfo(SampleAppIModelApp.loggerCategory(this),
      `openIModelAndViews: projectId=${projectId}&iModelId=${iModelId} mode=${this.allowWrite ? "ReadWrite" : "Readonly"}`);

    let iModelConnection: IModelConnection | undefined;
    if (ProcessDetector.isMobileAppFrontend) {
      const req = await NativeApp.requestDownloadBriefcase(projectId, iModelId, { syncMode: SyncMode.PullOnly }, IModelVersion.latest(), async (progress: ProgressInfo) => {
        // eslint-disable-next-line no-console
        console.log(`Progress (${progress.loaded}/${progress.total}) -> ${progress.percent}%`);
      });
      await req.downloadPromise;
      iModelConnection = await BriefcaseConnection.openFile({ fileName: req.fileName, readonly: true });
    } else {
      iModelConnection = await UiFramework.iModelServices.openIModel(projectId, iModelId, this.allowWrite ? OpenMode.ReadWrite : OpenMode.Readonly);
    }

    SampleAppIModelApp.setIsIModelLocal(false, true);
    await this.openViews(iModelConnection, viewIdsSelected);
  }

  public static async closeCurrentIModel() {
    if (SampleAppIModelApp.isIModelLocal) {
      const currentIModelConnection = UiFramework.getIModelConnection();
      if (currentIModelConnection) {
        SyncUiEventDispatcher.clearConnectionEvents(currentIModelConnection);

        await currentIModelConnection.close();
        UiFramework.setIModelConnection(undefined);
      }
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

    // store the first selected viewId as default - mostly used by frontstages defined in extensions that want to open a IModelViewport
    if (viewIdsSelected && viewIdsSelected.length > 0) {
      for (const viewId of viewIdsSelected) {
        const viewState = await iModelConnection.views.load(viewId);
        if (viewState) {
          if (!defaultViewState) {
            defaultViewState = viewState;
            ActiveSettingsManager.onViewOpened(viewState); // Review TODO
          }
          viewStates.push(viewState);
        }
      }
      if (defaultViewState)
        UiFramework.setDefaultViewState(defaultViewState);
    }

    // we create a Frontstage that contains the views that we want.
    let stageId: string;
    const defaultFrontstage = this.allowWrite ? EditFrontstage.stageId : ViewsFrontstage.stageId;

    if (this.iModelParams && this.iModelParams.stageId)
      stageId = this.iModelParams.stageId;
    else
      stageId = defaultFrontstage;

    let frontstageDef: FrontstageDef | undefined;
    if (stageId === defaultFrontstage) {
      if (stageId === ViewsFrontstage.stageId) {
        const frontstageProvider = new ViewsFrontstage(viewStates, iModelConnection);
        FrontstageManager.addFrontstageProvider(frontstageProvider);
        frontstageDef = frontstageProvider.frontstageDef;
      } else {
        const frontstageProvider = new EditFrontstage(viewStates, iModelConnection);
        FrontstageManager.addFrontstageProvider(frontstageProvider);
        frontstageDef = frontstageProvider.frontstageDef;
      }
    } else {
      frontstageDef = FrontstageManager.findFrontstageDef(stageId);
    }

    if (frontstageDef) {
      FrontstageManager.setActiveFrontstageDef(frontstageDef).then(() => { // eslint-disable-line @typescript-eslint/no-floating-promises
        // Frontstage & ScreenViewports are ready
        Logger.logInfo(SampleAppIModelApp.loggerCategory(this), `Frontstage & ScreenViewports are ready`);
      });
    } else {
      throw new Error(`Frontstage with id "${stageId}" does not exist`);
    }
  }

  public static async handleWorkOffline() {
    await LocalFileOpenFrontstage.open();
  }

  public static async showIModelIndex(contextId: string, iModelId: string) {
    const currentConnection = UiFramework.getIModelConnection();
    if (!currentConnection || (currentConnection.iModelId !== iModelId)) {
      // Close the current iModelConnection
      await SampleAppIModelApp.closeCurrentIModel();

      // open the imodel
      Logger.logInfo(SampleAppIModelApp.loggerCategory(this),
        `showIModelIndex: projectId=${contextId}&iModelId=${iModelId} mode=${this.allowWrite ? "ReadWrite" : "Readonly"}`);

      let iModelConnection: IModelConnection | undefined;
      if (ProcessDetector.isMobileAppFrontend) {
        const req = await NativeApp.requestDownloadBriefcase(contextId, iModelId, { syncMode: SyncMode.PullOnly }, IModelVersion.latest(), async (progress: ProgressInfo) => {
          // eslint-disable-next-line no-console
          console.log(`Progress (${progress.loaded}/${progress.total}) -> ${progress.percent}%`);
        });
        await req.downloadPromise;
        iModelConnection = await BriefcaseConnection.openFile({ fileName: req.fileName, readonly: true });
      } else {
        iModelConnection = await UiFramework.iModelServices.openIModel(contextId, iModelId, this.allowWrite ? OpenMode.ReadWrite : OpenMode.Readonly);
      }

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
    SampleAppIModelApp.iModelParams = SampleAppIModelApp._usingParams();

    if (Config.App.has("imjs_uitestapp_imodel_name") && Config.App.has("imjs_uitestapp_imodel_project_name")) {
      let viewId: string | undefined;
      if (Config.App.has("imjs_uitestapp_imodel_viewId"))
        viewId = Config.App.get("imjs_uitestapp_imodel_viewId");

      const projectName = Config.App.getString("imjs_uitestapp_imodel_project_name");
      const iModelName = Config.App.getString("imjs_uitestapp_imodel_name");

      const requestContext = await AuthorizedFrontendRequestContext.create();
      const project = await (new ContextRegistryClient()).getProject(requestContext, {
        $select: "*",
        $filter: `Name+eq+'${projectName}'`,
      });

      const iModel = (await (new IModelHubClient()).iModels.get(requestContext, project.wsgId, new IModelQuery().byName(iModelName)))[0];

      if (viewId) {
        // open directly into the iModel (view)
        await SampleAppIModelApp.openIModelAndViews(project.wsgId, iModel.wsgId, [viewId]);
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
    } else if (SampleAppIModelApp.testAppConfiguration?.startWithSnapshots) {
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

  public static isEnvVarOn(envVar: string): boolean {
    return Config.App.has(envVar) && (Config.App.get(envVar) === "1" || Config.App.get(envVar) === "true");
  }

  public static get allowWrite() {
    return SampleAppIModelApp.isEnvVarOn("imjs_TESTAPP_ALLOW_WRITE");
  }

  public static setTestProperty(value: string, immediateSync = false) {
    if (value !== SampleAppIModelApp.getTestProperty()) {
      UiFramework.dispatchActionToStore(SampleAppUiActionId.setTestProperty, value, immediateSync);
    }
  }

  public static getTestProperty(): string {
    return SampleAppIModelApp.store.getState().sampleAppState.testProperty;
  }

  public static getUiFrameworkProperty(): string {
    return SampleAppIModelApp.store.getState().sampleAppState.frameworkVersion;
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
    FrontstageManager.setActiveFrontstageDef(frontstageDef); // eslint-disable-line @typescript-eslint/no-floating-promises
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

const AppDragInteraction = connect(mapDragInteractionStateToProps)(AppDragInteractionComponent);
const AppFrameworkVersion = connect(mapFrameworkVersionStateToProps)(AppFrameworkVersionComponent);

class SampleAppViewer extends React.Component<any, { authorized: boolean, uiSettings: UiSettings }> {
  constructor(props: any) {
    super(props);

    AppUi.initialize();

    const authorized = !!IModelApp.authorizationClient && IModelApp.authorizationClient.isAuthorized;
    this._initializeSignin(authorized); // eslint-disable-line @typescript-eslint/no-floating-promises

    this.state = {
      authorized,
      uiSettings: this.getUiSettings(authorized),
    };
  }

  private _initializeSignin = async (authorized: boolean): Promise<void> => {
    return authorized ? SampleAppIModelApp.showSignedIn() : SampleAppIModelApp.showSignedOut();
  };

  private _onUserStateChanged = (_accessToken: AccessToken | undefined) => {
    const authorized = !!IModelApp.authorizationClient && IModelApp.authorizationClient.isAuthorized;
    this.setState({ authorized, uiSettings: this.getUiSettings(authorized) });
    this._initializeSignin(authorized); // eslint-disable-line @typescript-eslint/no-floating-promises
  };

  private getUiSettings(authorized: boolean): UiSettings {
    if (SampleAppIModelApp.testAppConfiguration?.useLocalSettings || !authorized) {
      SampleAppIModelApp.uiSettings = new LocalUiSettings();
    } else {
      SampleAppIModelApp.uiSettings = new IModelAppUiSettings();
    }

    return SampleAppIModelApp.uiSettings;
  }

  private _handleFrontstageDeactivatedEvent = (args: FrontstageDeactivatedEventArgs): void => {
    Logger.logInfo(SampleAppIModelApp.loggerCategory(this), `Frontstage exit: id=${args.deactivatedFrontstageDef.id} totalTime=${args.totalTime} engagementTime=${args.engagementTime} idleTime=${args.idleTime}`);
  };

  private _handleModalFrontstageClosedEvent = (args: ModalFrontstageClosedEventArgs): void => {
    Logger.logInfo(SampleAppIModelApp.loggerCategory(this), `Modal Frontstage close: title=${args.modalFrontstage.title} totalTime=${args.totalTime} engagementTime=${args.engagementTime} idleTime=${args.idleTime}`);
  };

  public componentDidMount() {
    const oidcClient = IModelApp.authorizationClient;
    if (isFrontendAuthorizationClient(oidcClient))
      oidcClient.onUserStateChanged.addListener(this._onUserStateChanged);
    FrontstageManager.onFrontstageDeactivatedEvent.addListener(this._handleFrontstageDeactivatedEvent);
    FrontstageManager.onModalFrontstageClosedEvent.addListener(this._handleModalFrontstageClosedEvent);
  }

  public componentWillUnmount() {
    const oidcClient = IModelApp.authorizationClient;
    if (isFrontendAuthorizationClient(oidcClient))
      oidcClient.onUserStateChanged.removeListener(this._onUserStateChanged);
    FrontstageManager.onFrontstageDeactivatedEvent.removeListener(this._handleFrontstageDeactivatedEvent);
    FrontstageManager.onModalFrontstageClosedEvent.removeListener(this._handleModalFrontstageClosedEvent);
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
                  <UiSettingsProvider uiSettings={this.state.uiSettings}>
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
window.addEventListener("beforeunload", async () => { // eslint-disable-line @typescript-eslint/no-misused-promises
  await SampleAppIModelApp.closeCurrentIModel();
});

function getOidcConfiguration(): BrowserAuthorizationClientConfiguration | NativeAppAuthorizationConfiguration {
  let redirectUri = "http://localhost:3000/signin-callback";
  if (ProcessDetector.isMobileAppFrontend) {
    redirectUri = "imodeljs://app/signin-callback";
  }
  const baseOidcScopes = [
    "openid",
    "email",
    "profile",
    "organization",
    "imodelhub",
    "context-registry-service:read-only",
    "product-settings-service",
    "projectwise-share",
    "urlps-third-party",
    "imodel-extension-service-api",
  ];

  return ProcessDetector.isElectronAppFrontend || ProcessDetector.isMobileAppFrontend
    ? {
      clientId: "imodeljs-electron-test",
      redirectUri,
      scope: baseOidcScopes.concat(["offline_access"]).join(" "),
    }
    : {
      clientId: "imodeljs-spa-test",
      redirectUri,
      scope: baseOidcScopes.concat("imodeljs-router").join(" "),
      responseType: "code",
    };
}

// main entry point.
async function main() {
  // initialize logging
  Logger.initializeToConsole();
  Logger.setLevelDefault(LogLevel.Warning);
  Logger.setLevel("ui-test-app", LogLevel.Info);
  Logger.setLevel("ui-framework.UiFramework", LogLevel.Info);

  ToolAdmin.exceptionHandler = async (err: any) => Promise.resolve(ErrorHandling.onUnexpectedError(err));

  // Logger.setLevel("ui-framework.Toolbar", LogLevel.Info);  // used to show minimal output calculating toolbar overflow
  // Logger.setLevel("ui-framework.Toolbar", LogLevel.Trace);  // used to show detailed output calculating toolbar overflow
  // Logger.setLevel("ui-framework.DefaultToolSettings", LogLevel.Trace);  // used to show detailed output calculating default toolsettings

  // retrieve, set, and output the global configuration variable
  SampleAppIModelApp.testAppConfiguration = {};
  const envVar = "imjs_TESTAPP_SNAPSHOT_FILEPATH";
  SampleAppIModelApp.testAppConfiguration.snapshotPath = Config.App.has(envVar) && Config.App.get(envVar);
  SampleAppIModelApp.testAppConfiguration.startWithSnapshots = SampleAppIModelApp.isEnvVarOn("imjs_TESTAPP_START_WITH_SNAPSHOTS");
  SampleAppIModelApp.testAppConfiguration.reactAxeConsole = SampleAppIModelApp.isEnvVarOn("imjs_TESTAPP_REACT_AXE_CONSOLE");
  SampleAppIModelApp.testAppConfiguration.useLocalSettings = SampleAppIModelApp.isEnvVarOn("imjs_TESTAPP_USE_LOCAL_SETTINGS");
  Logger.logInfo("Configuration", JSON.stringify(SampleAppIModelApp.testAppConfiguration)); // eslint-disable-line no-console

  let rpcParams: BentleyCloudRpcParams;
  if (process.env.imjs_gp_backend) {
    const urlClient = new UrlDiscoveryClient();
    const requestContext = new ClientRequestContext();
    const orchestratorUrl = await urlClient.discoverUrl(requestContext, "iModelJsOrchestrator.K8S", undefined);
    rpcParams = { info: { title: "general-purpose-imodeljs-backend", version: "v2.0" }, uriPrefix: orchestratorUrl };
  } else {
    rpcParams = { info: { title: "ui-test-app", version: "v1.0" }, uriPrefix: "http://localhost:3001" };
  }

  const authConfig = getOidcConfiguration();
  const opts: WebViewerAppOpts & NativeAppOpts = {
    iModelApp: {
      accuSnap: new SampleAppAccuSnap(),
      toolAdmin: new FrameworkToolAdmin(),
      notifications: new AppNotificationManager(),
      uiAdmin: new FrameworkUiAdmin(),
      accuDraw: new FrameworkAccuDraw(),
      viewManager: new AppViewManager(true),  // Favorite Properties Support
      renderSys: { displaySolarShadows: true },
      rpcInterfaces: getSupportedRpcs(),
    },
    webViewerApp: {
      rpcParams,
      authConfig,
    },
    nativeApp: {
      authConfig,
    },
  };

  // Start the app.
  await SampleAppIModelApp.startup(opts);

  // Add ApplicationInsights telemetry client
  const iModelJsApplicationInsightsKey = Config.App.getString("imjs_telemetry_application_insights_instrumentation_key", "");
  if (iModelJsApplicationInsightsKey) {
    const applicationInsightsClient = new FrontendApplicationInsightsClient(iModelJsApplicationInsightsKey);
    IModelApp.telemetry.addClient(applicationInsightsClient);
  }

  // wait for both our i18n namespaces to be read.
  await SampleAppIModelApp.initialize();

  // register new QuantityType
  await BearingQuantityType.registerQuantityType();

  ReactDOM.render(<SampleAppViewer />, document.getElementById("root") as HTMLElement);
}

// Entry point - run the main function
main(); // eslint-disable-line @typescript-eslint/no-floating-promises
