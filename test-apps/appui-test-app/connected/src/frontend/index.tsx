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
import { Project as ITwin, ProjectsAccessClient, ProjectsSearchableProperty } from "@itwin/projects-client";
import { RealityDataAccessClient, RealityDataClientOptions } from "@itwin/reality-data-client";
import { getClassName, UiItemsManager } from "@itwin/appui-abstract";
import { TargetOptions, TargetOptionsContext } from "@itwin/appui-layout-react/lib/cjs/appui-layout-react/target/TargetOptions";
import {
  ActionsUnion, AppNotificationManager, AppUiSettings, BackstageComposer, ConfigurableUiContent, createAction, DeepReadonly, FrameworkAccuDraw, FrameworkReducer,
  FrameworkRootState, FrameworkToolAdmin, FrameworkUiAdmin, FrameworkVersion, FrontstageDeactivatedEventArgs, FrontstageDef, FrontstageManager,
  IModelViewportControl,
  InitialAppUiSettings,
  ModalFrontstageClosedEventArgs, SafeAreaContext, SafeAreaInsets, StateManager, SyncUiEventDispatcher, SYSTEM_PREFERRED_COLOR_THEME, ThemeManager,
  ToolbarDragInteractionContext, UiFramework, UiStateStorageHandler,
} from "@itwin/appui-react";
import { Id64String, Logger, LogLevel, ProcessDetector, UnexpectedErrors } from "@itwin/core-bentley";
import { BentleyCloudRpcManager, BentleyCloudRpcParams, RpcConfiguration } from "@itwin/core-common";
import { ElectronApp } from "@itwin/core-electron/lib/cjs/ElectronFrontend";
import { ElectronRendererAuthorization } from "@itwin/electron-authorization/lib/cjs/ElectronRenderer";
import {
  AccuSnap, IModelApp, IModelConnection, LocalUnitFormatProvider, NativeAppLogger,
  NativeAppOpts, SelectionTool, SnapMode, ToolAdmin, ViewClipByPlaneTool,
} from "@itwin/core-frontend";
import { MobileApp, MobileAppOpts } from "@itwin/core-mobile/lib/cjs/MobileFrontend";
// import { SchemaUnitProvider } from "@itwin/ecschema-metadata";
import { createFavoritePropertiesStorage, DefaultFavoritePropertiesStorageTypes, Presentation } from "@itwin/presentation-frontend";
import { IModelsClient } from "@itwin/imodels-client-management";
import { AccessTokenAdapter, FrontendIModelsAccess } from "@itwin/imodels-access-frontend";
import { getSupportedRpcs } from "../common/rpcs";
import { loggerCategory, TestAppConfiguration } from "../common/TestAppConfiguration";
import { AppUi } from "./appui/AppUi";
import { ExternalIModel } from "./appui/ExternalIModel";
import { MainFrontstage } from "./appui/frontstages/MainFrontstage";
import { AppSettingsTabsProvider } from "./appui/settingsproviders/AppSettingsTabsProvider";
// import { ECSchemaRpcLocater } from "@itwin/ecschema-rpcinterface-common";
import { IModelOpenFrontstage } from "./appui/frontstages/IModelOpenFrontstage";
import { SignInFrontstage } from "./appui/frontstages/SignInFrontstage";
import {
  AbstractUiItemsProvider, AppUiTestProviders, ContentLayoutStage, CustomContentFrontstage,
  FloatingWidgetsUiItemsProvider, InspectUiItemInfoToolProvider, SynchronizedFloatingViewportStage, WidgetApiStage,
} from "@itwin/appui-test-providers";
import { MapLayersFormats } from "@itwin/map-layers-formats";

// Initialize my application gateway configuration for the frontend
RpcConfiguration.developmentMode = true;

// cSpell:ignore setTestProperty sampleapp uitestapp projectwise hypermodeling testapp urlps
// cSpell:ignore toggledraginteraction toggleframeworkversion set-drag-interaction set-framework-version

/** Action Ids used by redux and to send sync UI components. Typically used to refresh visibility or enable state of control.
 * Use lower case strings to be compatible with SyncUi processing.
 */
export enum SampleAppUiActionId {
  setTestProperty = "sampleapp:settestproperty",
  setAnimationViewId = "sampleapp:setAnimationViewId",
  setInitialViewIds = "sampleapp:setInitialViewIds",
}

/* ----------------------------------------------------------------------------
* The following variable is used to test initializing UiFramework to use UI 1.0
* and using that initial value in ui-test-app. By default UiFramework initializes
* the Redux state to UI 2.0 mode.
----------------------------------------------------------------------------- */
export interface SampleAppState {
  testProperty: string;
  animationViewId: string;
  isIModelLocal: boolean;
  initialViewIds: string[];
}

const initialState: SampleAppState = {
  testProperty: "",
  animationViewId: "",
  isIModelLocal: true,
  initialViewIds: [],
};

// An object with a function that creates each OpenIModelAction that can be handled by our reducer.
export const SampleAppActions = {
  setTestProperty: (testProperty: string) => createAction(SampleAppUiActionId.setTestProperty, testProperty),
  setAnimationViewId: (viewId: string) => createAction(SampleAppUiActionId.setAnimationViewId, viewId),
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
  public static hubClient?: IModelsClient;
  private static _appStateManager: StateManager | undefined;

  public static get store(): Store<RootState> {
    return StateManager.store as Store<RootState>;
  }

  public static async startup(opts: NativeAppOpts, hubClient?: IModelsClient): Promise<void> {

    this.hubClient = hubClient;

    const iModelAppOpts = {
      ...opts.iModelApp,
    };

    if (ProcessDetector.isElectronAppFrontend) {
      const authClient: ElectronRendererAuthorization = new ElectronRendererAuthorization();
      iModelAppOpts.authorizationClient = authClient;
      await ElectronApp.startup({ ...opts, iModelApp: iModelAppOpts });
      NativeAppLogger.initialize();
    } else if (ProcessDetector.isMobileAppFrontend) {
      await MobileApp.startup(opts as MobileAppOpts);
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
          { info: { title: "imodel/rpc", version: "" }, uriPrefix: `https://${process.env.IMJS_URL_PREFIX ?? ""}api.bentley.com` }
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
    await UiFramework.initialize(undefined, undefined);

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

    IModelApp.toolAdmin.defaultToolId = SelectionTool.toolId;
    IModelApp.uiAdmin.updateFeatureFlags({ allowKeyinPalette: true });

    MapLayersFormats.initialize();

    // store name of this registered control in Redux store so it can be access by extensions
    UiFramework.setDefaultIModelViewportControlId(IModelViewportControl.id);

    // default to showing imperial formatted units
    await IModelApp.quantityFormatter.setActiveUnitSystem("imperial");
    Presentation.presentation.activeUnitSystem = "imperial";
    await IModelApp.quantityFormatter.setUnitFormattingSettingsProvider(new LocalUnitFormatProvider(IModelApp.quantityFormatter, true)); // pass true to save per imodel

    AppSettingsTabsProvider.initializeAppSettingProvider();

    // Create and register the AppUiSettings instance to provide default for ui settings in Redux store
    const lastTheme = (window.localStorage && window.localStorage.getItem("uifw:defaultTheme")) ?? SYSTEM_PREFERRED_COLOR_THEME;
    const defaults: InitialAppUiSettings = {
      colorTheme: lastTheme ?? SYSTEM_PREFERRED_COLOR_THEME,
      dragInteraction: false,
      frameworkVersion: "2",
      widgetOpacity: 0.8,
      showWidgetIcon: true,
      autoCollapseUnpinnedPanels: false,
      toolbarOpacity: 0.5,
    };

    // initialize any settings providers that may need to have defaults set by iModelApp
    UiFramework.registerUserSettingsProvider(new AppUiSettings(defaults));

    UiFramework.useDefaultPopoutUrl = true;

    // initialize state from all registered UserSettingsProviders
    await UiFramework.initializeStateFromUserSettingsProviders();

    // register the localized strings for the package and set up that contains the sample UiItems providers
    await AppUiTestProviders.initializeLocalizationAndState();

    // initialize UI Item providers
    UiItemsManager.register(new AbstractUiItemsProvider(AppUiTestProviders.localizationNamespace));
    UiItemsManager.register(new FloatingWidgetsUiItemsProvider(), { providerId: "widget-api-stage-floating-widget", stageIds: [WidgetApiStage.stageId] });
    UiItemsManager.register(new InspectUiItemInfoToolProvider(AppUiTestProviders.localizationNamespace));
    CustomContentFrontstage.register(AppUiTestProviders.localizationNamespace); // Frontstage and item providers
    WidgetApiStage.register(AppUiTestProviders.localizationNamespace); // Frontstage and item providers
    ContentLayoutStage.register(AppUiTestProviders.localizationNamespace); // Frontstage and item providers
    SynchronizedFloatingViewportStage.register(AppUiTestProviders.localizationNamespace); // Frontstage and item providers

    // try starting up event loop if not yet started so key-in palette can be opened
    IModelApp.startEventLoop();
  }

  public static loggerCategory(obj: any): string {
    const className = getClassName(obj);
    const category = `appui-test-app.${className}`;
    return category;
  }

  public static async openIModelAndViews(iTwinId: string, iModelId: string, viewIdsSelected?: Id64String[]) {
    // Close the current iModelConnection
    await SampleAppIModelApp.closeCurrentIModel();

    Logger.logInfo(SampleAppIModelApp.loggerCategory(this),
      `openIModelAndViews: iTwinId=${iTwinId}&iModelId=${iModelId} mode=${this.allowWrite ? "ReadWrite" : "Readonly"}`);

    let iModelConnection: IModelConnection | undefined;
    try {
      const iModel = await ExternalIModel.create({ iTwinId, iModelId });
      await iModel.openIModel();
      if (!iModel.iModelConnection || iModel.iModelConnection.isClosed) {
        alert(`Unable to open selected iModel`);
        await this.showIModelOpen();
        return;
      }
      iModelConnection = iModel.iModelConnection!;
      if ((undefined === viewIdsSelected || 0 === viewIdsSelected.length) && iModel.viewId) {
        viewIdsSelected = [iModel.viewId];
      }
      if (viewIdsSelected) {
        await this.openViews(iModelConnection, viewIdsSelected);
      } else {
        alert(`Unable to find view to open in selected iModel`);
        await this.showIModelOpen();
        return;
      }
    } catch (e: any) {
      alert(`Error opening selected iModel: ${e.message}`);
      iModelConnection = undefined;
      await this.showIModelOpen();
      return;
    }
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
    // we create a Frontstage that contains the views that we want.
    let stageId: string;
    const defaultFrontstage = MainFrontstage.stageId;

    // Reset QuantityFormatter UnitsProvider with new iModelConnection
    // Remove comments once RPC error processing is fixed
    // const schemaLocater = new ECSchemaRpcLocater(iModelConnection);
    // await IModelApp.quantityFormatter.setUnitsProvider(new SchemaUnitProvider(schemaLocater));

    // store the IModelConnection in the sample app store - this may trigger redux connected components
    UiFramework.setIModelConnection(iModelConnection, true);

    if (viewIdsSelected.length) {
      SampleAppIModelApp.setInitialViewIds(viewIdsSelected);
      Logger.logInfo(SampleAppIModelApp.loggerCategory(this),
        `openViews: iTwinId=${iModelConnection.iTwinId} iModelId=${iModelConnection.iModelId} viewIdsSelected=${JSON.stringify(viewIdsSelected)}`);
    }

    if (this.iModelParams && this.iModelParams.stageId)
      stageId = this.iModelParams.stageId;
    else
      stageId = defaultFrontstage;

    let frontstageDef: FrontstageDef | undefined;
    if (stageId === defaultFrontstage) {
      if (stageId === MainFrontstage.stageId) {
        MainFrontstage.register();
      }
      frontstageDef = await FrontstageManager.getFrontstageDef(stageId);
    } else {
      frontstageDef = await FrontstageManager.getFrontstageDef(stageId);
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

  public static async showIModel(iTwinId: string, iModelId: string) {
    const currentConnection = UiFramework.getIModelConnection();
    let iModelConnection: IModelConnection | undefined;

    if (!currentConnection || (currentConnection.iModelId !== iModelId)) {
      // Close the current iModelConnection
      await SampleAppIModelApp.closeCurrentIModel();

      // open the imodel
      Logger.logInfo(SampleAppIModelApp.loggerCategory(this),
        `showIModel: iTwinId = ${iTwinId}& iModelId=${iModelId} mode = ${this.allowWrite ? "ReadWrite" : "Readonly"} `);

      try {
        const iModel = await ExternalIModel.create({ iTwinId, iModelId });
        await iModel.openIModel();
        iModelConnection = iModel.iModelConnection;

        if (!iModelConnection || !iModelConnection.isOpen || !iModel.viewId) {
          alert(`Unable to open specified iModel`);
          await this.showIModelOpen();
          return;
        }

        // store the IModelConnection in the sample app store
        UiFramework.setIModelConnection(iModelConnection, true);
        await this.openViews(iModelConnection, [iModel.viewId]);
      } catch (e: any) {
        alert(`Error opening selected iModel: ${e.message} `);
        await this.showIModelOpen();
        return;
      }
    }
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

    if (undefined === SampleAppIModelApp.iModelParams && process.env.IMJS_UITESTAPP_IMODEL_NAME && process.env.IMJS_UITESTAPP_ITWIN_NAME) {
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

      if (!SampleAppIModelApp.hubClient)
        return;

      let iModel;
      for await (const imodel of SampleAppIModelApp.hubClient.iModels.getRepresentationList({
        urlParams: {
          name: iModelName,
          projectId: iTwin.id,
          $top: 1,
        },
        authorization: AccessTokenAdapter.toAuthorizationCallback(accessToken),
      }))
        iModel = imodel;

      if (!iModel)
        throw new Error(`No iModel with the name ${iModelName} `);

      if (viewId) {
        // open directly into the iModel (view)
        await SampleAppIModelApp.openIModelAndViews(iTwin.id, iModel?.id, [viewId]);
      } else {
        // open directly into the iModel with default viewId
        await SampleAppIModelApp.showIModel(iTwin.id, iModel.id);
      }
    } else if (SampleAppIModelApp.iModelParams) {
      // open directly into the iModel (view)
      await SampleAppIModelApp.openIModelAndViews(SampleAppIModelApp.iModelParams.iTwinId, SampleAppIModelApp.iModelParams.iModelId, SampleAppIModelApp.iModelParams.viewIds);
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

    if (process.env.IMJS_UITESTAPP_IMODEL_ID && process.env.IMJS_UITESTAPP_ITWIN_ID) {
      const envITwinId = process.env.IMJS_UITESTAPP_ITWIN_ID;
      const envIModelId = process.env.IMJS_UITESTAPP_IMODEL_ID;
      const viewIds = process.env.IMJS_UITESTAPP_IMODEL_VIEWID ? [process.env.IMJS_UITESTAPP_IMODEL_VIEWID] : undefined;
      return { iTwinId: envITwinId, iModelId: envIModelId, viewIds };
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
    return SampleAppIModelApp.store.getState().frameworkState.configurableUiState.frameworkVersion; // eslint-disable-line deprecation/deprecation
  }

  public static saveAnimationViewId(value: string, immediateSync = false) {
    if (value !== SampleAppIModelApp.getTestProperty()) {
      UiFramework.dispatchActionToStore(SampleAppUiActionId.setAnimationViewId, value, immediateSync);
    }
  }

  public static getAnimationViewId(): string {
    return SampleAppIModelApp.store.getState().sampleAppState.animationViewId;
  }

  public static setInitialViewIds(viewIds: string[], immediateSync = false) {
    UiFramework.dispatchActionToStore(SampleAppUiActionId.setInitialViewIds, viewIds, immediateSync);
  }

  public static get isIModelLocal(): boolean {
    return SampleAppIModelApp.store.getState().sampleAppState.isIModelLocal;
  }

  public static async showFrontstage(frontstageId: string) {
    const frontstageDef = await FrontstageManager.getFrontstageDef(frontstageId);
    if (frontstageDef !== FrontstageManager.activeFrontstageDef)
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
    <FrameworkVersion> {/* eslint-disable-line deprecation/deprecation */}
      {props.children}
    </FrameworkVersion>
  );
}

function TargetOptionsProvider({ children }: React.PropsWithChildren<{}>) {
  const value = React.useMemo<TargetOptions>(() => ({ version: "2" }), []);
  return (
    <TargetOptionsContext.Provider value={value}>
      {children}
    </TargetOptionsContext.Provider>
  );
}

function mapDragInteractionStateToProps(state: RootState) {
  return { dragInteraction: state.frameworkState.configurableUiState.useDragInteraction };
}

function mapFrameworkVersionStateToProps(state: RootState) {
  return { frameworkVersion: state.frameworkState.configurableUiState.frameworkVersion }; // eslint-disable-line deprecation/deprecation
}

const AppDragInteraction = connect(mapDragInteractionStateToProps)(AppDragInteractionComponent);
const AppFrameworkVersion = connect(mapFrameworkVersionStateToProps)(AppFrameworkVersionComponent);

const SampleAppViewer2 = () => {
  const [isAuthorized, setIsAuthorized] = React.useState<boolean>(false);

  React.useEffect(() => {
    AppUi.initialize();

    if (IModelApp.authorizationClient instanceof BrowserAuthorizationClient || IModelApp.authorizationClient instanceof ElectronRendererAuthorization) {
      setIsAuthorized(IModelApp.authorizationClient.isAuthorized);
    }
  }, []);

  React.useEffect(() => {
    // Load the correct Frontstage based on whether or not you're authorized.
    isAuthorized ? SampleAppIModelApp.showSignedIn() : SampleAppIModelApp.showSignInPage(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }, [isAuthorized]);

  const _onAccessTokenChanged = () => {
    if (IModelApp.authorizationClient instanceof BrowserAuthorizationClient || IModelApp.authorizationClient instanceof ElectronRendererAuthorization) {
      setIsAuthorized(IModelApp.authorizationClient.isAuthorized); // forces the effect above to re-run and check the actual client...
    }
  };

  const _handleFrontstageDeactivatedEvent = (args: FrontstageDeactivatedEventArgs): void => {
    Logger.logInfo(SampleAppIModelApp.loggerCategory(this), `Frontstage exit: id = ${args.deactivatedFrontstageDef.id} totalTime = ${args.totalTime} engagementTime = ${args.engagementTime} idleTime = ${args.idleTime} `);
  };

  const _handleModalFrontstageClosedEvent = (args: ModalFrontstageClosedEventArgs): void => {
    Logger.logInfo(SampleAppIModelApp.loggerCategory(this), `Modal Frontstage close: title = ${args.modalFrontstage.title} totalTime = ${args.totalTime} engagementTime = ${args.engagementTime} idleTime = ${args.idleTime} `);
  };

  React.useEffect(() => {
    if (IModelApp.authorizationClient instanceof BrowserAuthorizationClient || IModelApp.authorizationClient instanceof ElectronRendererAuthorization)
      IModelApp.authorizationClient.onAccessTokenChanged.addListener(_onAccessTokenChanged);
    FrontstageManager.onFrontstageDeactivatedEvent.addListener(_handleFrontstageDeactivatedEvent);
    FrontstageManager.onModalFrontstageClosedEvent.addListener(_handleModalFrontstageClosedEvent);
    return () => {
      if (IModelApp.authorizationClient instanceof BrowserAuthorizationClient || IModelApp.authorizationClient instanceof ElectronRendererAuthorization)
        IModelApp.authorizationClient.onAccessTokenChanged.removeListener(_onAccessTokenChanged);
      FrontstageManager.onFrontstageDeactivatedEvent.removeListener(_handleFrontstageDeactivatedEvent);
      FrontstageManager.onModalFrontstageClosedEvent.removeListener(_handleModalFrontstageClosedEvent);
    };
  }, []);

  return (
    <Provider store={SampleAppIModelApp.store} >
      <ThemeManager>
        <SafeAreaContext.Provider value={SafeAreaInsets.All}>
          <AppDragInteraction>
            <AppFrameworkVersion>
              <TargetOptionsProvider>
                <UiStateStorageHandler>
                  <ConfigurableUiContent
                    appBackstage={<BackstageComposer />}
                  />
                </UiStateStorageHandler>
              </TargetOptionsProvider>
            </AppFrameworkVersion>
          </AppDragInteraction>
        </SafeAreaContext.Provider>
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

  ToolAdmin.exceptionHandler = async (err: any) => Promise.resolve(UnexpectedErrors.handle(err));

  // retrieve, set, and output the global configuration variable
  SampleAppIModelApp.testAppConfiguration = {};
  SampleAppIModelApp.testAppConfiguration.snapshotPath = process.env.IMJS_UITESTAPP_SNAPSHOT_FILEPATH;
  SampleAppIModelApp.testAppConfiguration.bingMapsKey = process.env.IMJS_BING_MAPS_KEY;
  SampleAppIModelApp.testAppConfiguration.mapBoxKey = process.env.IMJS_MAPBOX_KEY;
  SampleAppIModelApp.testAppConfiguration.cesiumIonKey = process.env.IMJS_CESIUM_ION_KEY;
  SampleAppIModelApp.testAppConfiguration.reactAxeConsole = SampleAppIModelApp.isEnvVarOn("IMJS_TESTAPP_REACT_AXE_CONSOLE");
  SampleAppIModelApp.testAppConfiguration.useLocalSettings = SampleAppIModelApp.isEnvVarOn("IMJS_UITESTAPP_USE_LOCAL_SETTINGS");
  Logger.logInfo("Configuration", JSON.stringify(SampleAppIModelApp.testAppConfiguration)); // eslint-disable-line no-console

  const mapLayerOpts = {
    BingMaps: SampleAppIModelApp.testAppConfiguration.bingMapsKey ? { key: "key", value: SampleAppIModelApp.testAppConfiguration.bingMapsKey } : undefined,
    MapboxImagery: SampleAppIModelApp.testAppConfiguration.mapBoxKey ? { key: "access_token", value: SampleAppIModelApp.testAppConfiguration.mapBoxKey } : undefined,
  };

  const iModelClient = new IModelsClient({ api: { baseUrl: `https://${process.env.IMJS_URL_PREFIX ?? ""}api.bentley.com/imodels` } });

  const realityDataClientOptions: RealityDataClientOptions = {
    /** API Version. v1 by default */
    // version?: ApiVersion;
    /** API Url. Used to select environment. Defaults to "https://api.bentley.com/realitydata" */
    baseUrl: `https://${process.env.IMJS_URL_PREFIX}api.bentley.com/realitydata`,
  };
  const opts: NativeAppOpts = {
    iModelApp: {
      accuSnap: new SampleAppAccuSnap(),
      toolAdmin: new FrameworkToolAdmin(),
      notifications: new AppNotificationManager(),
      uiAdmin: new FrameworkUiAdmin(),
      accuDraw: new FrameworkAccuDraw(),
      realityDataAccess: new RealityDataAccessClient(realityDataClientOptions),
      renderSys: { displaySolarShadows: true },
      rpcInterfaces: getSupportedRpcs(),
      hubAccess: new FrontendIModelsAccess(iModelClient),
      mapLayerOptions: mapLayerOpts,
      tileAdmin: { cesiumIonKey: SampleAppIModelApp.testAppConfiguration.cesiumIonKey },
    },
  };

  // Start the app.
  await SampleAppIModelApp.startup(opts, iModelClient);

  await SampleAppIModelApp.initialize();

  ReactDOM.render(<SampleAppViewer2 />, document.getElementById("root") as HTMLElement);
}

// Entry point - run the main function
main(); // eslint-disable-line @typescript-eslint/no-floating-promises
