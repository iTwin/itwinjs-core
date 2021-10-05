/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./index.scss";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { connect, Provider } from "react-redux";
import { Store } from "redux"; // createStore,
import reactAxe from "@axe-core/react";
import { I18N } from "@itwin/core-i18n";
import { AccessToken, Id64String, Logger, LogLevel, ProcessDetector } from "@itwin/core-bentley";
import { ITwin, ITwinAccessClient, ITwinSearchableProperty } from "@bentley/itwin-registry-client";
import { ElectronApp } from "@itwin/core-electron/lib/ElectronFrontend";
import {
  BrowserAuthorizationCallbackHandler, BrowserAuthorizationClient, isFrontendAuthorizationClient,
} from "@bentley/frontend-authorization-client";
import { FrontendDevTools } from "@itwin/frontend-devtools";
import { HyperModeling } from "@itwin/hypermodeling-frontend";
import { IModelHubClient, IModelHubFrontend, IModelQuery } from "@bentley/imodelhub-client";
import { BentleyCloudRpcManager, BentleyCloudRpcParams, IModelVersion, RpcConfiguration, SyncMode } from "@itwin/core-common";
import { EditTools } from "@itwin/editor-frontend";
import {
  AccuSnap, BriefcaseConnection, IModelApp, IModelConnection, LocalUnitFormatProvider, NativeApp, NativeAppLogger, NativeAppOpts, SelectionTool,
  SnapMode, ToolAdmin, ViewClipByPlaneTool,
} from "@itwin/core-frontend";
import { MarkupApp } from "@itwin/core-markup";
import { MapLayersUI } from "@itwin/map-layers";
import { AndroidApp, IOSApp } from "@itwin/core-mobile/lib/MobileFrontend";
import { createFavoritePropertiesStorage, DefaultFavoritePropertiesStorageTypes, Presentation } from "@itwin/presentation-frontend";
import { getClassName } from "@itwin/appui-abstract";
import { BeDragDropContext } from "@itwin/components-react";
import { LocalSettingsStorage, UiSettings } from "@itwin/core-react";
import {
  ActionsUnion, AppNotificationManager, AppUiSettings, ConfigurableUiContent, createAction, DeepReadonly, FrameworkAccuDraw, FrameworkReducer,
  FrameworkRootState, FrameworkToolAdmin, FrameworkUiAdmin, FrameworkVersion, FrontstageDeactivatedEventArgs, FrontstageDef, FrontstageManager,
  ModalFrontstageClosedEventArgs, SafeAreaContext, StateManager, SyncUiEventDispatcher, SYSTEM_PREFERRED_COLOR_THEME, ThemeManager,
  ToolbarDragInteractionContext, UiFramework, UiSettingsProvider, UserSettingsStorage,
} from "@itwin/appui-react";
import { SafeAreaInsets } from "@itwin/appui-layout-react";
import { RealityDataAccessClient } from "@bentley/reality-data-client";
import { getSupportedRpcs } from "../common/rpcs";
import { loggerCategory, TestAppConfiguration } from "../common/TestAppConfiguration";
import { BearingQuantityType } from "./api/BearingQuantityType";
import { ErrorHandling } from "./api/ErrorHandling";
import { AppUi } from "./appui/AppUi";
import { AppBackstageComposer } from "./appui/backstage/AppBackstageComposer";
import { IModelViewportControl } from "./appui/contentviews/IModelViewport";
import { EditFrontstage } from "./appui/frontstages/editing/EditFrontstage";
import { LocalFileOpenFrontstage } from "./appui/frontstages/LocalFileStage";
import { ViewsFrontstage } from "./appui/frontstages/ViewsFrontstage";
import { AppSettingsTabsProvider } from "./appui/uiproviders/AppSettingsTabsProvider";
import { AppViewManager } from "./favorites/AppViewManager"; // Favorite Properties Support
import { ElementSelectionListener } from "./favorites/ElementSelectionListener"; // Favorite Properties Support
import { AnalysisAnimationTool } from "./tools/AnalysisAnimation";
import { EditingScopeTool } from "./tools/editing/EditingTools";
import { PlaceBlockTool } from "./tools/editing/PlaceBlockTool";
import { Tool1 } from "./tools/Tool1";
import { Tool2 } from "./tools/Tool2";
import { ToolWithDynamicSettings } from "./tools/ToolWithDynamicSettings";
import { ToolWithSettings } from "./tools/ToolWithSettings";
import {
  OpenComponentExamplesPopoutTool, OpenCustomPopoutTool, OpenViewPopoutTool, RemoveSavedContentLayoutTool, RestoreSavedContentLayoutTool,
  SaveContentLayoutTool, UiProviderTool,
} from "./tools/UiProviderTool";
import { ExternalIModel } from "./appui/ExternalIModel";
import { ProgressInfo } from "@bentley/itwin-client";

// Initialize my application gateway configuration for the frontend
RpcConfiguration.developmentMode = true;

// cSpell:ignore setTestProperty sampleapp uitestapp setisimodellocal projectwise hypermodeling testapp urlps
// cSpell:ignore toggledraginteraction toggleframeworkversion set-drag-interaction set-framework-version

/** Action Ids used by redux and to send sync UI components. Typically used to refresh visibility or enable state of control.
 * Use lower case strings to be compatible with SyncUi processing.
 */
export enum SampleAppUiActionId {
  setTestProperty = "sampleapp:settestproperty",
  setAnimationViewId = "sampleapp:setAnimationViewId",
  setIsIModelLocal = "sampleapp:setisimodellocal",
  setInitialViewIds = "sampleapp:setInitialViewIds",
}

export interface SampleAppState {
  testProperty: string;
  animationViewId: string;
  isIModelLocal: boolean;
  initialViewIds: string[];
}

const initialState: SampleAppState = {
  testProperty: "",
  animationViewId: "",
  isIModelLocal: false,
  initialViewIds: [],
};

// An object with a function that creates each OpenIModelAction that can be handled by our reducer.
export const SampleAppActions = {
  setTestProperty: (testProperty: string) => createAction(SampleAppUiActionId.setTestProperty, testProperty),
  setAnimationViewId: (viewId: string) => createAction(SampleAppUiActionId.setAnimationViewId, viewId),
  setIsIModelLocal: (isIModelLocal: boolean) => createAction(SampleAppUiActionId.setIsIModelLocal, isIModelLocal),
  setInitialViewIds: (viewIds: string[]) => createAction(SampleAppUiActionId.setInitialViewIds, viewIds),
};

class SampleAppAccuSnap extends AccuSnap {
  public override getActiveSnapModes(): SnapMode[] {
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
    case SampleAppUiActionId.setInitialViewIds: {
      return { ...state, initialViewIds: action.payload };
    }
  }
  return state;
}

// React-redux interface stuff
export interface RootState extends FrameworkRootState {
  sampleAppState: SampleAppState;
}

interface SampleIModelParams {
  iTwinId: string;
  iModelId: string;
  viewIds?: string[];
  stageId?: string;
}

export class SampleAppIModelApp {
  public static sampleAppNamespace?: string;
  public static iModelParams: SampleIModelParams | undefined;
  public static testAppConfiguration: TestAppConfiguration | undefined;
  private static _appStateManager: StateManager | undefined;
  private static _localUiSettings = new LocalSettingsStorage();
  private static _UserUiSettingsStorage = new UserSettingsStorage();

  // Favorite Properties Support
  private static _selectionSetListener = new ElementSelectionListener(true);

  public static get store(): Store<RootState> {
    return StateManager.store as Store<RootState>;
  }

  public static getUiSettingsStorage(): UiSettings {
    const authorized = !!IModelApp.authorizationClient;
    if (SampleAppIModelApp.testAppConfiguration?.useLocalSettings || !authorized) {
      return SampleAppIModelApp._localUiSettings;
    }
    return SampleAppIModelApp._UserUiSettingsStorage;
  }

  public static async startup(opts: NativeAppOpts): Promise<void> {

    const iModelAppOpts = {
      ...opts.iModelApp,
      localization: new I18N("iModeljs", { urlTemplate: "locales/en/{{ns}}.json" }),
    };

    if (ProcessDetector.isElectronAppFrontend) {
      await ElectronApp.startup({ ...opts, iModelApp: iModelAppOpts });
      NativeAppLogger.initialize();
    } else if (ProcessDetector.isIOSAppFrontend) {
      await IOSApp.startup(opts);
    } else if (ProcessDetector.isAndroidAppFrontend) {
      await AndroidApp.startup(opts);
    } else {
      const redirectUri = "http://localhost:3000/signin-callback";
      const urlObj = new URL(redirectUri);
      if (urlObj.pathname === window.location.pathname) {
        await BrowserAuthorizationCallbackHandler.handleSigninCallback(redirectUri);
        return;
      }

      const rpcParams: BentleyCloudRpcParams =
        undefined !== process.env.IMJS_GP_BACKEND ?
          { info: { title: "general-purpose-core-backend", version: "v2.0" }, uriPrefix: `https://${process.env.IMJS_URL_PREFIX ?? ""}api.bentley.com` }
          : { info: { title: "ui-test-app", version: "v1.0" }, uriPrefix: "http://localhost:3001" };
      BentleyCloudRpcManager.initializeClient(rpcParams, opts.iModelApp!.rpcInterfaces!);

      await IModelApp.startup(iModelAppOpts);
    }

    window.onerror = function (error) {
      // eslint-disable-next-line no-console
      console.log(error);
    };

    this.sampleAppNamespace = "SampleApp";
    await IModelApp.localization.registerNamespace(this.sampleAppNamespace);

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
      presentation: {
        activeLocale: IModelApp.localization.languageList()[0],
      },
      favorites: {
        storage: createFavoritePropertiesStorage(SampleAppIModelApp.testAppConfiguration?.useLocalSettings
          ? DefaultFavoritePropertiesStorageTypes.BrowserLocalStorage
          : DefaultFavoritePropertiesStorageTypes.UserSettingsServiceStorage),
      },
    });
    Presentation.selection.scopes.activeScope = "top-assembly";

    // Register tools.
    Tool1.register(this.sampleAppNamespace);
    Tool2.register(this.sampleAppNamespace);
    ToolWithSettings.register(this.sampleAppNamespace);
    AnalysisAnimationTool.register(this.sampleAppNamespace);
    UiProviderTool.register(this.sampleAppNamespace);
    ToolWithDynamicSettings.register(this.sampleAppNamespace);
    OpenComponentExamplesPopoutTool.register(this.sampleAppNamespace);
    OpenCustomPopoutTool.register(this.sampleAppNamespace);
    OpenViewPopoutTool.register(this.sampleAppNamespace);
    RemoveSavedContentLayoutTool.register(this.sampleAppNamespace);
    RestoreSavedContentLayoutTool.register(this.sampleAppNamespace);
    SaveContentLayoutTool.register(this.sampleAppNamespace);

    // Register editing tools
    if (this.allowWrite) {
      EditingScopeTool.register(this.sampleAppNamespace);
      PlaceBlockTool.register(this.sampleAppNamespace);
    }

    IModelApp.toolAdmin.defaultToolId = SelectionTool.toolId;
    IModelApp.uiAdmin.updateFeatureFlags({ allowKeyinPalette: true });

    // store name of this registered control in Redux store so it can be access by extensions
    UiFramework.setDefaultIModelViewportControlId(IModelViewportControl.id);

    await MarkupApp.initialize();
    await FrontendDevTools.initialize();
    await EditTools.initialize({ registerAllTools: true });

    // Favorite Properties Support
    SampleAppIModelApp._selectionSetListener.initialize();

    // default to showing imperial formatted units
    await IModelApp.quantityFormatter.setActiveUnitSystem("imperial");
    Presentation.presentation.activeUnitSystem = "imperial";
    await IModelApp.quantityFormatter.setUnitFormattingSettingsProvider(new LocalUnitFormatProvider(IModelApp.quantityFormatter, true)); // pass true to save per imodel

    await FrontendDevTools.initialize();
    await HyperModeling.initialize();
    // To test map-layer extension comment out the following and ensure ui-test-app\build\imjs_extensions contains map-layers, if not see Readme.md in map-layers package.
    await MapLayersUI.initialize(false); // if false then add widget in FrontstageDef

    AppSettingsTabsProvider.initializeAppSettingProvider();

    // Create and register the AppUiSettings instance to provide default for ui settings in Redux store
    const lastTheme = (window.localStorage && window.localStorage.getItem("uifw:defaultTheme")) ?? SYSTEM_PREFERRED_COLOR_THEME;
    const defaults = {
      colorTheme: lastTheme ?? SYSTEM_PREFERRED_COLOR_THEME,
      dragInteraction: false,
      frameworkVersion: "2",
      widgetOpacity: 0.8,
    };

    // initialize any settings providers that may need to have defaults set by iModelApp
    UiFramework.registerUserSettingsProvider(new AppUiSettings(defaults));

    // go ahead and initialize settings before login or in case login is by-passed
    await UiFramework.setUiSettingsStorage(SampleAppIModelApp.getUiSettingsStorage());

    UiFramework.useDefaultPopoutUrl = true;

    // try starting up event loop if not yet started so key-in palette can be opened
    IModelApp.startEventLoop();
  }

  public static loggerCategory(obj: any): string {
    const className = getClassName(obj);
    const category = `ui-test-app.${className}`;
    return category;
  }

  public static async openIModelAndViews(iTwinId: string, iModelId: string, viewIdsSelected: Id64String[]) {
    // Close the current iModelConnection
    await SampleAppIModelApp.closeCurrentIModel();

    // open the imodel
    Logger.logInfo(SampleAppIModelApp.loggerCategory(this),
      `openIModelAndViews: iTwinId=${iTwinId}&iModelId=${iModelId} mode=${this.allowWrite ? "ReadWrite" : "Readonly"}`);

    let iModelConnection: IModelConnection | undefined;
    if (ProcessDetector.isMobileAppFrontend) {
      const req = await NativeApp.requestDownloadBriefcase(iTwinId, iModelId, { syncMode: SyncMode.PullOnly }, IModelVersion.latest(), async (progress: ProgressInfo) => {
        // eslint-disable-next-line no-console
        console.log(`Progress (${progress.loaded}/${progress.total}) -> ${progress.percent}%`);
      });
      await req.downloadPromise;
      iModelConnection = await BriefcaseConnection.openFile({ fileName: req.fileName, readonly: true });
    } else {
      const iModel = new ExternalIModel(iTwinId, iModelId);
      await iModel.openIModel();
      iModelConnection = iModel.iModelConnection!;
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
    // we create a Frontstage that contains the views that we want.
    let stageId: string;
    const defaultFrontstage = this.allowWrite ? EditFrontstage.stageId : ViewsFrontstage.stageId;

    // store the IModelConnection in the sample app store - this may trigger redux connected components
    UiFramework.setIModelConnection(iModelConnection, true);
    if (viewIdsSelected.length) {
      SampleAppIModelApp.setInitialViewIds(viewIdsSelected);
    }

    if (this.iModelParams && this.iModelParams.stageId)
      stageId = this.iModelParams.stageId;
    else
      stageId = defaultFrontstage;

    let frontstageDef: FrontstageDef | undefined;
    if (stageId === defaultFrontstage) {
      if (stageId === ViewsFrontstage.stageId) {
        const frontstageProvider = new ViewsFrontstage();
        FrontstageManager.addFrontstageProvider(frontstageProvider);
      } else {
        const frontstageProvider = new EditFrontstage();
        FrontstageManager.addFrontstageProvider(frontstageProvider);
      }
      frontstageDef = await FrontstageManager.getFrontstageDef(stageId);

    } else {
      frontstageDef = await FrontstageManager.getFrontstageDef(stageId);
    }

    if (frontstageDef) {
      FrontstageManager.setActiveFrontstageDef(frontstageDef).then(() => { // eslint-disable-line @typescript-eslint/no-floating-promises
        // Frontstage & ScreenViewports are ready
        Logger.logInfo(SampleAppIModelApp.loggerCategory(this), `Frontstage & ScreenViewports are ready`);
        if (false && ProcessDetector.isElectronAppFrontend) { // used for testing pop-out support
          // delay 5 seconds to see if window opens - since web browser will block pop-out if we wait. Also web browser will not allow multiple pop-outs.
          setTimeout(() => { void IModelApp.tools.run(OpenCustomPopoutTool.toolId); /* IModelApp.tools.run(OpenWidgetPopoutTool.toolId); */ }, 5000);
        }
      });
    } else {
      throw new Error(`Frontstage with id "${stageId}" does not exist`);
    }
  }

  public static async handleWorkOffline() {
    await LocalFileOpenFrontstage.open();
  }

  public static async showIModelIndex(iTwinId: string, iModelId: string) {
    const currentConnection = UiFramework.getIModelConnection();
    if (!currentConnection || (currentConnection.iModelId !== iModelId)) {
      // Close the current iModelConnection
      await SampleAppIModelApp.closeCurrentIModel();

      // open the imodel
      Logger.logInfo(SampleAppIModelApp.loggerCategory(this),
        `showIModelIndex: iTwinId=${iTwinId}&iModelId=${iModelId} mode=${this.allowWrite ? "ReadWrite" : "Readonly"}`);

      let iModelConnection: IModelConnection | undefined;
      if (ProcessDetector.isMobileAppFrontend) {
        const req = await NativeApp.requestDownloadBriefcase(iTwinId, iModelId, { syncMode: SyncMode.PullOnly }, IModelVersion.latest(), async (progress: ProgressInfo) => {
          // eslint-disable-next-line no-console
          console.log(`Progress (${progress.loaded}/${progress.total}) -> ${progress.percent}%`);
        });
        await req.downloadPromise;
        iModelConnection = await BriefcaseConnection.openFile({ fileName: req.fileName, readonly: true });
      } else {
        try {
          const iModel = new ExternalIModel(iTwinId, iModelId);
          await iModel.openIModel();
          iModelConnection = iModel.iModelConnection!;
        } catch (_e) {
          alert("Error opening selected iModel");
          iModelConnection = undefined;
          await LocalFileOpenFrontstage.open();
          return;
        }
      }

      SampleAppIModelApp.setIsIModelLocal(!!iModelConnection?.isBriefcaseConnection, true);

      // store the IModelConnection in the sample app store
      UiFramework.setIModelConnection(iModelConnection, true);
    }

    await SampleAppIModelApp.showFrontstage("IModelIndex");
  }

  public static async showIModelOpen() {
    await SampleAppIModelApp.showFrontstage("IModelOpen");
  }

  public static async showSignedOut() {
    await SampleAppIModelApp.showFrontstage("SignIn");
  }

  // called after the user has signed in (or access token is still valid)
  public static async showSignedIn() {
    SampleAppIModelApp.iModelParams = SampleAppIModelApp._usingParams();

    if (process.env.IMJS_UITESTAPP_IMODEL_NAME && process.env.IMJS_UITESTAPP_IMODEL_ITWIN_NAME) {
      const viewId: string | undefined = process.env.IMJS_UITESTAPP_IMODEL_VIEWID;

      const iTwinName = process.env.IMJS_UITESTAPP_IMODEL_ITWIN_NAME ?? "";
      const iModelName = process.env.IMJS_UITESTAPP_IMODEL_NAME ?? "";

      const accessToken = await IModelApp.getAccessToken();
      const iTwinList: ITwin[] = await (new ITwinAccessClient()).getAll(accessToken, {
        search: {
          searchString: iTwinName,
          propertyName: ITwinSearchableProperty.Name,
          exactMatch: true,
        },
      });

      if (iTwinList.length === 0)
        throw new Error(`ITwin ${iTwinName} was not found for the user.`);
      else if (iTwinList.length > 1)
        throw new Error(`Multiple iTwins named ${iTwinName} were found for the user.`);

      const iTwin: ITwin = iTwinList[0];

      const iModel = (await (new IModelHubClient()).iModels.get(accessToken, iTwin.id, new IModelQuery().byName(iModelName)))[0];

      if (viewId) {
        // open directly into the iModel (view)
        await SampleAppIModelApp.openIModelAndViews(iTwin.id, iModel.wsgId, [viewId]);
      } else {
        // open to the IModelIndex frontstage
        await SampleAppIModelApp.showIModelIndex(iTwin.id, iModel.wsgId);
      }
    } else if (SampleAppIModelApp.iModelParams) {
      if (SampleAppIModelApp.iModelParams.viewIds && SampleAppIModelApp.iModelParams.viewIds.length > 0) {
        // open directly into the iModel (view)
        await SampleAppIModelApp.openIModelAndViews(SampleAppIModelApp.iModelParams.iTwinId, SampleAppIModelApp.iModelParams.iModelId, SampleAppIModelApp.iModelParams.viewIds);
      } else {
        // open to the IModelIndex frontstage
        await SampleAppIModelApp.showIModelIndex(SampleAppIModelApp.iModelParams.iTwinId, SampleAppIModelApp.iModelParams.iModelId);
      }
    } else if (SampleAppIModelApp.testAppConfiguration?.startWithSnapshots) {
      // open to the Local File frontstage
      await LocalFileOpenFrontstage.open();
    } else {
      // open to the IModelOpen frontstage
      await SampleAppIModelApp.showIModelOpen();
    }
  }

  private static _usingParams(): SampleIModelParams | undefined {
    const urlParams = new URLSearchParams(window.location.search);
    const iTwinId = urlParams.get("iTwinId");
    const iModelId = urlParams.get("iModelId");

    if (iTwinId && iModelId) {
      const viewIds = urlParams.getAll("viewId");
      const stageId = urlParams.get("stageId") || undefined;

      return { iTwinId, iModelId, viewIds, stageId };
    }

    return undefined;
  }

  public static isEnvVarOn(envVar: string): boolean {
    return process.env[envVar] === "1" || process.env[envVar] === "true";
  }

  public static get allowWrite() {
    return SampleAppIModelApp.isEnvVarOn("IMJS_TESTAPP_ALLOW_WRITE");
  }

  public static setTestProperty(value: string, immediateSync = false) {
    if (value !== SampleAppIModelApp.getTestProperty()) {
      UiFramework.dispatchActionToStore(SampleAppUiActionId.setTestProperty, value, immediateSync);
    }
  }

  public static getInitialViewIds() {
    return SampleAppIModelApp.store.getState().sampleAppState.initialViewIds;
  }

  public static getTestProperty(): string {
    return SampleAppIModelApp.store.getState().sampleAppState.testProperty;
  }

  public static getUiFrameworkProperty(): string {
    return SampleAppIModelApp.store.getState().frameworkState.configurableUiState.frameworkVersion;
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

  public static setInitialViewIds(viewIds: string[], immediateSync = false) {
    UiFramework.dispatchActionToStore(SampleAppUiActionId.setInitialViewIds, viewIds, immediateSync);
  }

  public static get isIModelLocal(): boolean {
    return SampleAppIModelApp.store.getState().sampleAppState.isIModelLocal;
  }

  public static async showFrontstage(frontstageId: string) {
    const frontstageDef = await FrontstageManager.getFrontstageDef(frontstageId);
    await FrontstageManager.setActiveFrontstageDef(frontstageDef);
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
  return { dragInteraction: state.frameworkState.configurableUiState.useDragInteraction };
}

function mapFrameworkVersionStateToProps(state: RootState) {
  return { frameworkVersion: state.frameworkState.configurableUiState.frameworkVersion };
}

const AppDragInteraction = connect(mapDragInteractionStateToProps)(AppDragInteractionComponent);
const AppFrameworkVersion = connect(mapFrameworkVersionStateToProps)(AppFrameworkVersionComponent);

class SampleAppViewer extends React.Component<any, { authorized: boolean, uiSettingsStorage: UiSettings }> {
  constructor(props: any) {
    super(props);

    AppUi.initialize();
    this._initializeSignin(); // eslint-disable-line @typescript-eslint/no-floating-promises

    const authorized = !!IModelApp.authorizationClient;
    this.state = {
      authorized,
      uiSettingsStorage: SampleAppIModelApp.getUiSettingsStorage(),
    };
  }

  private _initializeSignin = async (): Promise<void> => {
    let authorized = !!IModelApp.authorizationClient;
    if (!authorized) {
      const auth = new BrowserAuthorizationClient({
        clientId: "imodeljs-spa-test",
        redirectUri: "http://localhost:3000/signin-callback",
        scope: baseOidcScopes.join(" "),
        responseType: "code",
      });
      try {
        await auth.signInSilent();
      } catch (err) { }

      authorized = auth.isAuthorized;
      IModelApp.authorizationClient = auth;
    }
    return authorized ? SampleAppIModelApp.showSignedIn() : SampleAppIModelApp.showSignedOut();
  };

  private _onAccessTokenChanged = async (_accessToken: AccessToken) => {
    const authorized = !!IModelApp.authorizationClient;
    const uiSettingsStorage = SampleAppIModelApp.getUiSettingsStorage();
    await UiFramework.setUiSettingsStorage(uiSettingsStorage);
    this.setState({ authorized, uiSettingsStorage });
    this._initializeSignin(); // eslint-disable-line @typescript-eslint/no-floating-promises
  };

  private _handleFrontstageDeactivatedEvent = (args: FrontstageDeactivatedEventArgs): void => {
    Logger.logInfo(SampleAppIModelApp.loggerCategory(this), `Frontstage exit: id=${args.deactivatedFrontstageDef.id} totalTime=${args.totalTime} engagementTime=${args.engagementTime} idleTime=${args.idleTime}`);
  };

  private _handleModalFrontstageClosedEvent = (args: ModalFrontstageClosedEventArgs): void => {
    Logger.logInfo(SampleAppIModelApp.loggerCategory(this), `Modal Frontstage close: title=${args.modalFrontstage.title} totalTime=${args.totalTime} engagementTime=${args.engagementTime} idleTime=${args.idleTime}`);
  };

  public override componentDidMount() {
    const oidcClient = IModelApp.authorizationClient;
    if (isFrontendAuthorizationClient(oidcClient))
      oidcClient.onAccessTokenChanged.addListener(this._onAccessTokenChanged);
    FrontstageManager.onFrontstageDeactivatedEvent.addListener(this._handleFrontstageDeactivatedEvent);
    FrontstageManager.onModalFrontstageClosedEvent.addListener(this._handleModalFrontstageClosedEvent);
  }

  public override componentWillUnmount() {
    const oidcClient = IModelApp.authorizationClient;
    if (isFrontendAuthorizationClient(oidcClient))
      oidcClient.onAccessTokenChanged.removeListener(this._onAccessTokenChanged);
    FrontstageManager.onFrontstageDeactivatedEvent.removeListener(this._handleFrontstageDeactivatedEvent);
    FrontstageManager.onModalFrontstageClosedEvent.removeListener(this._handleModalFrontstageClosedEvent);
  }

  public override render(): JSX.Element {
    return (
      <Provider store={SampleAppIModelApp.store} >
        <ThemeManager>
          {/* eslint-disable-next-line deprecation/deprecation */}
          <BeDragDropContext>
            <SafeAreaContext.Provider value={SafeAreaInsets.All}>
              <AppDragInteraction>
                <AppFrameworkVersion>
                  {/** UiSettingsProvider is optional. By default LocalUiSettings is used to store UI settings. */}
                  <UiSettingsProvider settingsStorage={this.state.uiSettingsStorage}>
                    <ConfigurableUiContent
                      appBackstage={<AppBackstageComposer />}
                    />
                  </UiSettingsProvider>
                </AppFrameworkVersion>
              </AppDragInteraction>
            </SafeAreaContext.Provider>
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

const baseOidcScopes = [
  "openid",
  "email",
  "profile",
  "organization",
  "itwinjs",
];

// main entry point.
async function main() {
  // initialize logging
  Logger.initializeToConsole();
  Logger.setLevelDefault(LogLevel.Warning);
  Logger.setLevel(loggerCategory, LogLevel.Info);
  Logger.setLevel("ui-framework.UiFramework", LogLevel.Info);

  ToolAdmin.exceptionHandler = async (err: any) => Promise.resolve(ErrorHandling.onUnexpectedError(err));

  // retrieve, set, and output the global configuration variable
  SampleAppIModelApp.testAppConfiguration = {};
  const envVar = "IMJS_TESTAPP_SNAPSHOT_FILEPATH";
  SampleAppIModelApp.testAppConfiguration.snapshotPath = process.env[envVar];
  SampleAppIModelApp.testAppConfiguration.bingMapsKey = process.env.IMJS_BING_MAPS_KEY;
  SampleAppIModelApp.testAppConfiguration.mapBoxKey = process.env.IMJS_MAPBOX_KEY;
  SampleAppIModelApp.testAppConfiguration.cesiumIonKey = process.env.IMJS_CESIUM_ION_KEY;
  SampleAppIModelApp.testAppConfiguration.startWithSnapshots = SampleAppIModelApp.isEnvVarOn("IMJS_TESTAPP_START_WITH_SNAPSHOTS");
  SampleAppIModelApp.testAppConfiguration.reactAxeConsole = SampleAppIModelApp.isEnvVarOn("IMJS_TESTAPP_REACT_AXE_CONSOLE");
  SampleAppIModelApp.testAppConfiguration.useLocalSettings = SampleAppIModelApp.isEnvVarOn("IMJS_TESTAPP_USE_LOCAL_SETTINGS");
  Logger.logInfo("Configuration", JSON.stringify(SampleAppIModelApp.testAppConfiguration)); // eslint-disable-line no-console

  const mapLayerOpts = {
    BingMaps: SampleAppIModelApp.testAppConfiguration.bingMapsKey ? { key: "key", value: SampleAppIModelApp.testAppConfiguration.bingMapsKey } : undefined,
    Mapbox: SampleAppIModelApp.testAppConfiguration.mapBoxKey ? { key: "key", value: SampleAppIModelApp.testAppConfiguration.mapBoxKey } : undefined,
  };
  const opts: NativeAppOpts = {
    iModelApp: {
      accuSnap: new SampleAppAccuSnap(),
      toolAdmin: new FrameworkToolAdmin(),
      notifications: new AppNotificationManager(),
      uiAdmin: new FrameworkUiAdmin(),
      accuDraw: new FrameworkAccuDraw(),
      viewManager: new AppViewManager(true),  // Favorite Properties Support
      realityDataAccess: new RealityDataAccessClient(),
      renderSys: { displaySolarShadows: true },
      rpcInterfaces: getSupportedRpcs(),
      hubAccess: new IModelHubFrontend(),
      mapLayerOptions: mapLayerOpts,
      tileAdmin: { cesiumIonKey: SampleAppIModelApp.testAppConfiguration.cesiumIonKey },
    },
  };

  // Start the app.
  await SampleAppIModelApp.startup(opts);

  await SampleAppIModelApp.initialize();

  // register new QuantityType
  await BearingQuantityType.registerQuantityType();

  ReactDOM.render(<SampleAppViewer />, document.getElementById("root") as HTMLElement);
}

// Entry point - run the main function
main(); // eslint-disable-line @typescript-eslint/no-floating-promises
