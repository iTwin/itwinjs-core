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
import { BrowserAuthorizationCallbackHandler, BrowserAuthorizationClient } from "@itwin/browser-authorization";
import { IModelHubClient, IModelHubFrontend, IModelQuery } from "@bentley/imodelhub-client";
import { ProgressInfo } from "@bentley/itwin-client";
import { Project as ITwin, ProjectsAccessClient, ProjectsSearchableProperty } from "@itwin/projects-client";
import { RealityDataAccessClient } from "@itwin/reality-data-client";
import { getClassName } from "@itwin/appui-abstract";
import { SafeAreaInsets } from "@itwin/appui-layout-react";
import {
  ActionsUnion, AppNotificationManager, AppUiSettings, ConfigurableUiContent, createAction, DeepReadonly, FrameworkAccuDraw, FrameworkReducer,
  FrameworkRootState, FrameworkToolAdmin, FrameworkUiAdmin, FrameworkVersion, FrontstageDeactivatedEventArgs, FrontstageDef, FrontstageManager,
  InitialAppUiSettings,
  ModalFrontstageClosedEventArgs, SafeAreaContext, StateManager, SyncUiEventDispatcher, SYSTEM_PREFERRED_COLOR_THEME, ThemeManager,
  ToolbarDragInteractionContext, UiFramework, UiStateStorageHandler,
} from "@itwin/appui-react";
import { BeDragDropContext } from "@itwin/components-react";
import { Id64String, Logger, LogLevel, ProcessDetector } from "@itwin/core-bentley";
import { BentleyCloudRpcManager, BentleyCloudRpcParams, IModelVersion, RpcConfiguration, SyncMode } from "@itwin/core-common";
import { ElectronApp } from "@itwin/core-electron/lib/cjs/ElectronFrontend";
import { ElectronAppAuthorization } from "@itwin/electron-authorization/lib/cjs/ElectronFrontend";
import {
  AccuSnap, BriefcaseConnection, IModelApp, IModelConnection, LocalUnitFormatProvider, NativeApp, NativeAppLogger,
  NativeAppOpts, SelectionTool, SnapMode, ToolAdmin, ViewClipByPlaneTool,
} from "@itwin/core-frontend";
import { MarkupApp } from "@itwin/core-markup";
import { AndroidApp, IOSApp } from "@itwin/core-mobile/lib/cjs/MobileFrontend";
import { EditTools } from "@itwin/editor-frontend";
import { FrontendDevTools } from "@itwin/frontend-devtools";
import { HyperModeling } from "@itwin/hypermodeling-frontend";
import { MapLayersUI } from "@itwin/map-layers";
import { createFavoritePropertiesStorage, DefaultFavoritePropertiesStorageTypes, Presentation } from "@itwin/presentation-frontend";
import { getSupportedRpcs } from "../common/rpcs";
import { loggerCategory, TestAppConfiguration } from "../common/TestAppConfiguration";
import { BearingQuantityType } from "./api/BearingQuantityType";
import { ErrorHandling } from "./api/ErrorHandling";
import { AppUi } from "./appui/AppUi";
import { AppBackstageComposer } from "./appui/backstage/AppBackstageComposer";
import { IModelViewportControl } from "./appui/contentviews/IModelViewport";
import { ExternalIModel } from "./appui/ExternalIModel";
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
  SaveContentLayoutTool, TestExtensionUiProviderTool,
} from "./tools/ImmediateTools";
import { IModelOpenFrontstage } from "./appui/frontstages/IModelOpenFrontstage";
import { IModelIndexFrontstage } from "./appui/frontstages/IModelIndexFrontstage";
import { SignInFrontstage } from "./appui/frontstages/SignInFrontstage";

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
  isIModelLocal: true,  // initialize to true to hide iModelIndex from enabling which should only occur if External iModel is open.
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

  // Favorite Properties Support
  private static _selectionSetListener = new ElementSelectionListener(true);

  public static get store(): Store<RootState> {
    return StateManager.store as Store<RootState>;
  }

  public static async startup(opts: NativeAppOpts): Promise<void> {

    const iModelAppOpts = {
      ...opts.iModelApp,
    };

    if (ProcessDetector.isElectronAppFrontend) {
      const authClient: ElectronAppAuthorization = new ElectronAppAuthorization();
      iModelAppOpts.authorizationClient = authClient;
      await ElectronApp.startup({ ...opts, iModelApp: iModelAppOpts });
      NativeAppLogger.initialize();
    } else if (ProcessDetector.isIOSAppFrontend) {
      await IOSApp.startup(opts);
    } else if (ProcessDetector.isAndroidAppFrontend) {
      await AndroidApp.startup(opts);
    } else {
      // if an auth client has not already been configured, use a default Browser client
      const redirectUri = process.env.IMJS_OIDC_BROWSER_TEST_REDIRECT_URI ?? "";
      const urlObj = new URL(redirectUri);
      if (urlObj.pathname === window.location.pathname) {
        await BrowserAuthorizationCallbackHandler.handleSigninCallback(redirectUri);
        return;
      }

      if (undefined === process.env.IMJS_OIDC_BROWSER_TEST_CLIENT_ID && undefined === process.env.IMJS_OIDC_BROWSER_TEST_SCOPES) {
        Logger.logWarning(loggerCategory, "Missing IMJS_OIDC_BROWSER_TEST_CLIENT_ID and IMJS_OIDC_BROWSER_TEST_SCOPES environment variables. Authentication will not be possible if not properly set.");
        await IModelApp.startup(iModelAppOpts);
        return;
      }

      const auth = new BrowserAuthorizationClient({
        clientId: process.env.IMJS_OIDC_BROWSER_TEST_CLIENT_ID ?? "",
        redirectUri,
        scope: process.env.IMJS_OIDC_BROWSER_TEST_SCOPES ?? "",
        responseType: "code",
      });
      try {
        await auth.signInSilent();
      } catch (err) { }

      const rpcParams: BentleyCloudRpcParams =
        undefined !== process.env.IMJS_UITESTAPP_GP_BACKEND ?
          { info: { title: "general-purpose-core-backend", version: "v2.0" }, uriPrefix: `https://${process.env.IMJS_URL_PREFIX ?? ""}api.bentley.com` }
          : { info: { title: "ui-test-app", version: "v1.0" }, uriPrefix: "http://localhost:3001" };
      BentleyCloudRpcManager.initializeClient(rpcParams, opts.iModelApp!.rpcInterfaces!);

      await IModelApp.startup({
        ...iModelAppOpts,
        authorizationClient: auth,
      });
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
        activeLocale: IModelApp.localization.getLanguageList()[0],
      },
      favorites: {
        storage: createFavoritePropertiesStorage(SampleAppIModelApp.testAppConfiguration?.useLocalSettings
          ? DefaultFavoritePropertiesStorageTypes.BrowserLocalStorage
          : DefaultFavoritePropertiesStorageTypes.UserPreferencesStorage),
      },
    });
    Presentation.selection.scopes.activeScope = "top-assembly";

    // Register tools.
    Tool1.register(this.sampleAppNamespace);
    Tool2.register(this.sampleAppNamespace);
    ToolWithSettings.register(this.sampleAppNamespace);
    AnalysisAnimationTool.register(this.sampleAppNamespace);
    TestExtensionUiProviderTool.register(this.sampleAppNamespace);
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
    const defaults: InitialAppUiSettings = {
      colorTheme: lastTheme ?? SYSTEM_PREFERRED_COLOR_THEME,
      dragInteraction: false,
      frameworkVersion: "2",
      widgetOpacity: 0.8,
    };

    // initialize any settings providers that may need to have defaults set by iModelApp
    UiFramework.registerUserSettingsProvider(new AppUiSettings(defaults));

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

    Logger.logInfo(SampleAppIModelApp.loggerCategory(this),
      `openIModelAndViews: iTwinId=${iTwinId}&iModelId=${iModelId} mode=${this.allowWrite ? "ReadWrite" : "Readonly"}`);

    let iModelConnection: IModelConnection | undefined;
    if (ProcessDetector.isMobileAppFrontend) {
      const req = await NativeApp.requestDownloadBriefcase(iTwinId, iModelId, { syncMode: SyncMode.PullOnly }, IModelVersion.latest(), async (progress: ProgressInfo) => {
        Logger.logInfo(SampleAppIModelApp.loggerCategory(this), `Progress (${progress.loaded}/${progress.total}) -> ${progress.percent}%`);
      });
      await req.downloadPromise;
      iModelConnection = await BriefcaseConnection.openFile({ fileName: req.fileName, readonly: true });
      SampleAppIModelApp.setIsIModelLocal(true, true);
    } else {
      const iModel = await ExternalIModel.create({ iTwinId, iModelId });
      await iModel.openIModel();
      iModelConnection = iModel.iModelConnection!;
      SampleAppIModelApp.setIsIModelLocal(false, true);
    }

    await this.openViews(iModelConnection, viewIdsSelected);
  }

  public static async closeCurrentIModel() {
    if (SampleAppIModelApp.isIModelLocal) {
      const currentIModelConnection = UiFramework.getIModelConnection();
      if (currentIModelConnection) {
        SyncUiEventDispatcher.clearConnectionEvents(currentIModelConnection);
        await currentIModelConnection.close();
        UiFramework.setIModelConnection(undefined);
        SampleAppIModelApp.setIsIModelLocal(true, true); // set to true to hide iModelIndex option which should only show if External imodel is open.
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
          const iModel = await ExternalIModel.create({ iTwinId, iModelId });
          await iModel.openIModel();
          iModelConnection = iModel.iModelConnection!;
        } catch (e: any) {
          alert(`Error opening selected iModel: ${e.message}`);
          iModelConnection = undefined;
          await LocalFileOpenFrontstage.open();
          return;
        }
      }

      SampleAppIModelApp.setIsIModelLocal(!!iModelConnection?.isBriefcaseConnection, true);

      // store the IModelConnection in the sample app store
      UiFramework.setIModelConnection(iModelConnection, true);
    }

    await SampleAppIModelApp.showFrontstage(IModelIndexFrontstage.stageId);
  }

  public static async showIModelOpen() {
    await SampleAppIModelApp.showFrontstage(IModelOpenFrontstage.stageId);
  }

  public static async showSignInPage() {
    await SampleAppIModelApp.showFrontstage(SignInFrontstage.stageId);
  }

  // called after the user has signed in (or access token is still valid)
  public static async showSignedIn() {
    SampleAppIModelApp.iModelParams = SampleAppIModelApp._usingParams();

    if (process.env.IMJS_UITESTAPP_IMODEL_NAME && process.env.IMJS_UITESTAPP_ITWIN_NAME) {
      const viewId: string | undefined = process.env.IMJS_UITESTAPP_IMODEL_VIEWID;

      const iTwinName = process.env.IMJS_UITESTAPP_ITWIN_NAME ?? "";
      const iModelName = process.env.IMJS_UITESTAPP_IMODEL_NAME ?? "";

      const accessToken = await IModelApp.getAccessToken();
      const iTwinList: ITwin[] = await (new ProjectsAccessClient()).getAll(accessToken, {
        search: {
          searchString: iTwinName,
          propertyName: ProjectsSearchableProperty.Name,
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
    return SampleAppIModelApp.isEnvVarOn("IMJS_UITESTAPP_ALLOW_WRITE");
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
    <FrameworkVersion>
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

const SampleAppViewer2 = () => {
  const [isAuthorized, setIsAuthorized] = React.useState<boolean>(false);

  React.useEffect(() => {
    AppUi.initialize();

    if (IModelApp.authorizationClient instanceof BrowserAuthorizationClient || IModelApp.authorizationClient instanceof ElectronAppAuthorization) {
      setIsAuthorized(IModelApp.authorizationClient.isAuthorized);
    }
  }, []);

  React.useEffect(() => {
    // Load the correct Frontstage based on whether or not you're authorized.
    isAuthorized ? SampleAppIModelApp.showSignedIn() : SampleAppIModelApp.showSignInPage(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }, [isAuthorized]);

  const _onAccessTokenChanged = () => {
    if (IModelApp.authorizationClient instanceof BrowserAuthorizationClient || IModelApp.authorizationClient instanceof ElectronAppAuthorization) {
      setIsAuthorized(IModelApp.authorizationClient.isAuthorized); // forces the effect above to re-run and check the actual client...
    }
  };

  const _handleFrontstageDeactivatedEvent = (args: FrontstageDeactivatedEventArgs): void => {
    Logger.logInfo(SampleAppIModelApp.loggerCategory(this), `Frontstage exit: id=${args.deactivatedFrontstageDef.id} totalTime=${args.totalTime} engagementTime=${args.engagementTime} idleTime=${args.idleTime}`);
  };

  const _handleModalFrontstageClosedEvent = (args: ModalFrontstageClosedEventArgs): void => {
    Logger.logInfo(SampleAppIModelApp.loggerCategory(this), `Modal Frontstage close: title=${args.modalFrontstage.title} totalTime=${args.totalTime} engagementTime=${args.engagementTime} idleTime=${args.idleTime}`);
  };

  React.useEffect(() => {
    if (IModelApp.authorizationClient instanceof BrowserAuthorizationClient || IModelApp.authorizationClient instanceof ElectronAppAuthorization)
      IModelApp.authorizationClient.onAccessTokenChanged.addListener(_onAccessTokenChanged);
    FrontstageManager.onFrontstageDeactivatedEvent.addListener(_handleFrontstageDeactivatedEvent);
    FrontstageManager.onModalFrontstageClosedEvent.addListener(_handleModalFrontstageClosedEvent);
    return () => {
      if (IModelApp.authorizationClient instanceof BrowserAuthorizationClient || IModelApp.authorizationClient instanceof ElectronAppAuthorization)
        IModelApp.authorizationClient.onAccessTokenChanged.removeListener(_onAccessTokenChanged);
      FrontstageManager.onFrontstageDeactivatedEvent.removeListener(_handleFrontstageDeactivatedEvent);
      FrontstageManager.onModalFrontstageClosedEvent.removeListener(_handleModalFrontstageClosedEvent);
    };
  }, []);

  return (
    <Provider store={SampleAppIModelApp.store} >
      <ThemeManager>
        {/* eslint-disable-next-line deprecation/deprecation */}
        <BeDragDropContext>
          <SafeAreaContext.Provider value={SafeAreaInsets.All}>
            <AppDragInteraction>
              <AppFrameworkVersion>
                <UiStateStorageHandler>
                  <ConfigurableUiContent
                    appBackstage={<AppBackstageComposer />}
                  />
                </UiStateStorageHandler>
              </AppFrameworkVersion>
            </AppDragInteraction>
          </SafeAreaContext.Provider>
        </BeDragDropContext>
      </ThemeManager>
    </Provider >
  );
};

// If we are using a browser, close the current iModel before leaving
window.addEventListener("beforeunload", async () => { // eslint-disable-line @typescript-eslint/no-misused-promises
  await SampleAppIModelApp.closeCurrentIModel();
});

// main entry point.
async function main() {
  // initialize logging
  Logger.initializeToConsole();
  Logger.setLevelDefault(LogLevel.Warning);
  Logger.setLevel(loggerCategory, LogLevel.Info);
  Logger.setLevel("ui-framework.UiFramework", LogLevel.Info);
  Logger.setLevel("ViewportComponent", LogLevel.Info);

  ToolAdmin.exceptionHandler = async (err: any) => Promise.resolve(ErrorHandling.onUnexpectedError(err));

  // retrieve, set, and output the global configuration variable
  SampleAppIModelApp.testAppConfiguration = {};
  SampleAppIModelApp.testAppConfiguration.snapshotPath = process.env.IMJS_UITESTAPP_SNAPSHOT_FILEPATH;
  SampleAppIModelApp.testAppConfiguration.bingMapsKey = process.env.IMJS_BING_MAPS_KEY;
  SampleAppIModelApp.testAppConfiguration.mapBoxKey = process.env.IMJS_MAPBOX_KEY;
  SampleAppIModelApp.testAppConfiguration.cesiumIonKey = process.env.IMJS_CESIUM_ION_KEY;
  SampleAppIModelApp.testAppConfiguration.startWithSnapshots = SampleAppIModelApp.isEnvVarOn("IMJS_UITESTAPP_START_WITH_SNAPSHOTS");
  SampleAppIModelApp.testAppConfiguration.reactAxeConsole = SampleAppIModelApp.isEnvVarOn("IMJS_TESTAPP_REACT_AXE_CONSOLE");
  SampleAppIModelApp.testAppConfiguration.useLocalSettings = SampleAppIModelApp.isEnvVarOn("IMJS_UITESTAPP_USE_LOCAL_SETTINGS");
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

  ReactDOM.render(<SampleAppViewer2 />, document.getElementById("root") as HTMLElement);
}

// Entry point - run the main function
main(); // eslint-disable-line @typescript-eslint/no-floating-promises
