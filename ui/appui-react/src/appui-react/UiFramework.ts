/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

// cSpell:ignore configurableui clientservices

import { Store } from "redux";
import { GuidString, Logger, ProcessDetector } from "@itwin/core-bentley";
import { Localization, RpcActivity } from "@itwin/core-common";
import { IModelApp, IModelConnection, SnapMode, ViewState } from "@itwin/core-frontend";
import { Presentation } from "@itwin/presentation-frontend";
import { TelemetryEvent } from "@itwin/core-telemetry";
import { getClassName, UiAdmin, UiError, UiEvent } from "@itwin/appui-abstract";
import { LocalStateStorage, SettingsManager, UiStateStorage } from "@itwin/core-react";
import { UiIModelComponents } from "@itwin/imodel-components-react";
import { BackstageManager } from "./backstage/BackstageManager";
import { ChildWindowManager } from "./childwindow/ChildWindowManager";
import { ConfigurableUiManager } from "./configurableui/ConfigurableUiManager";
import { ConfigurableUiActionId } from "./configurableui/state";
import { FrameworkState } from "./redux/FrameworkState";
import { CursorMenuData, PresentationSelectionScope, SessionStateActionId } from "./redux/SessionState";
import { StateManager } from "./redux/StateManager";
import { HideIsolateEmphasizeActionHandler, HideIsolateEmphasizeManager } from "./selection/HideIsolateEmphasizeManager";
import { SyncUiEventDispatcher, SyncUiEventId } from "./syncui/SyncUiEventDispatcher";
import { SYSTEM_PREFERRED_COLOR_THEME, WIDGET_OPACITY_DEFAULT } from "./theme/ThemeManager";
import * as keyinPaletteTools from "./tools/KeyinPaletteTools";
import * as openSettingTools from "./tools/OpenSettingsTool";
import * as restoreLayoutTools from "./tools/RestoreLayoutTool";
import * as toolSettingTools from "./tools/ToolSettingsTools";
import { UiShowHideManager, UiShowHideSettingsProvider } from "./utils/UiShowHideManager";
import { WidgetManager } from "./widgets/WidgetManager";
import { FrontstageManager } from "./frontstage/FrontstageManager";

// cSpell:ignore Mobi

/** Defined that available UI Versions. It is recommended to always use the latest version available.
 * @public
 */
export type FrameworkVersionId = "1" | "2";

/** Interface to be implemented but any classes that wants to load their user settings when the UiStateEntry storage class is set.
 * @public
 */
export interface UserSettingsProvider {
  /** Unique provider Id */
  providerId: string;
  /** Function to load settings from settings storage */
  loadUserSettings(storage: UiStateStorage): Promise<void>;
}

/** UiVisibility Event Args interface.
 * @public
 */
export interface UiVisibilityEventArgs {
  visible: boolean;
}

/** UiVisibility Event class.
 * @public
 */
export class UiVisibilityChangedEvent extends UiEvent<UiVisibilityEventArgs> { }

/** FrameworkVersion Changed Event Args interface.
 * @internal
 */
export interface FrameworkVersionChangedEventArgs {
  oldVersion: FrameworkVersionId;
  version: FrameworkVersionId;
}

/** FrameworkVersion Changed Event class.
 * @internal
 */
export class FrameworkVersionChangedEvent extends UiEvent<FrameworkVersionChangedEventArgs> { }

/** TrackingTime time argument used by our feature tracking manager as an option argument to the TelemetryClient
 * @internal
 */
export interface TrackingTime {
  startTime: Date;
  endTime: Date;
}

/**
 * Manages the Redux store, localization service and iModel, Project and Login services for the ui-framework package.
 * @public
 */
export class UiFramework {
  private static _initialized = false;
  private static _store?: Store<any>;
  private static _complaint = "UiFramework not initialized";
  private static _frameworkStateKeyInStore: string = "frameworkState";  // default name
  private static _backstageManager?: BackstageManager;
  private static _widgetManager?: WidgetManager;
  private static _uiVersion: FrameworkVersionId = "2";
  private static _hideIsolateEmphasizeActionHandler?: HideIsolateEmphasizeActionHandler;
  /** this provides a default state storage handler */
  private static _uiStateStorage: UiStateStorage = new LocalStateStorage();
  private static _settingsManager?: SettingsManager;
  private static _uiSettingsProviderRegistry: Map<string, UserSettingsProvider> = new Map<string, UserSettingsProvider>();
  private static _PopupWindowManager = new ChildWindowManager();
  public static useDefaultPopoutUrl = false;

  /** @public */
  public static get childWindowManager(): ChildWindowManager {
    return UiFramework._PopupWindowManager;
  }

  /** Registers class that will be informed when the UserSettingsStorage location has been set or changed. This allows
   * classes to load any previously saved settings from the new storage location. Common storage locations are the browser's
   * local storage, or the iTwin Product Settings cloud storage available via the SettingsAdmin see `IModelApp.settingsAdmin`.
   * @beta
   */
  public static registerUserSettingsProvider(entry: UserSettingsProvider) {
    if (this._uiSettingsProviderRegistry.has(entry.providerId))
      return false;

    this._uiSettingsProviderRegistry.set(entry.providerId, entry);
    return true;
  }

  /** Get Show Ui event.
   * @public
   */
  public static readonly onUiVisibilityChanged = new UiVisibilityChangedEvent();

  /**
   * Called by the application to initialize the UiFramework. Also initializes UIIModelComponents, UiComponents, UiCore.
   * @param store The single Redux store created by the host application. If this is `undefined` then it is assumed that the [[StateManager]] is being used to provide the Redux store.
   * @param frameworkStateKey The name of the key used by the app when adding the UiFramework state into the Redux store. If not defined "frameworkState" is assumed. This value is ignored if [[StateManager]] is being used. The StateManager use "frameworkState".
   */
  public static async initialize(store: Store<any> | undefined, frameworkStateKey?: string): Promise<void> {
    return this.initializeEx(store, frameworkStateKey);
  }

  /**
   * Called by the application to initialize the UiFramework. Also initializes UIIModelComponents, UiComponents, UiCore.
   * @param store The single Redux store created by the host application. If this is `undefined` then it is assumed that the [[StateManager]] is being used to provide the Redux store.
   * @param frameworkStateKey The name of the key used by the app when adding the UiFramework state into the Redux store. If not defined "frameworkState" is assumed. This value is ignored if [[StateManager]] is being used. The StateManager use "frameworkState".
   *
   * @internal
   */
  public static async initializeEx(store: Store<any> | undefined, frameworkStateKey?: string): Promise<void> {
    if (UiFramework._initialized) {
      Logger.logInfo(UiFramework.loggerCategory(UiFramework), `UiFramework.initialize already called`);
      return;
    }

    /* if store is undefined then the StateManager class should have been initialized by parent app and the apps default set of reducers registered with it.
      If the app has no reducers to add and does not initialize a StateManager then just initialize the StateManager with the default framework reducer now */
    if (undefined === store && !StateManager.isInitialized(true))
      new StateManager();

    UiFramework._store = store;
    // ignore setting _frameworkStateKeyInStore if not using store
    if (frameworkStateKey && store)
      UiFramework._frameworkStateKeyInStore = frameworkStateKey;

    // set up namespace and register all tools from package
    const frameworkNamespace = IModelApp.localization?.registerNamespace(UiFramework.localizationNamespace);
    [
      restoreLayoutTools,
      keyinPaletteTools,
      openSettingTools,
      toolSettingTools,
    ].forEach((tool) => IModelApp.tools.registerModule(tool, this.localizationNamespace));

    UiFramework._backstageManager = new BackstageManager();
    UiFramework._hideIsolateEmphasizeActionHandler = new HideIsolateEmphasizeManager();  // this allows user to override the default HideIsolateEmphasizeManager implementation.
    UiFramework._widgetManager = new WidgetManager();

    // Initialize ui-imodel-components, ui-components, ui-core & ui-abstract
    await UiIModelComponents.initialize();

    UiFramework.settingsManager.onSettingsProvidersChanged.addListener(() => {
      SyncUiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.SettingsProvidersChanged);
    });

    // Initialize the MessagePresenter interface in UiAdmin for Editor notifications
    UiAdmin.messagePresenter = IModelApp.notifications;

    UiFramework._initialized = true;

    // initialize any standalone settings providers that don't need to have defaults set by iModelApp
    UiShowHideSettingsProvider.initialize();

    ConfigurableUiManager.initialize();

    return frameworkNamespace;
  }

  /** Un-registers the UiFramework internationalization service namespace */
  public static terminate() {
    UiFramework._store = undefined;
    UiFramework._frameworkStateKeyInStore = "frameworkState";
    if (StateManager.isInitialized(true))
      StateManager.clearStore();
    // istanbul ignore next
    IModelApp.localization?.unregisterNamespace(UiFramework.localizationNamespace);
    UiFramework._backstageManager = undefined;
    UiFramework._widgetManager = undefined;
    UiFramework._hideIsolateEmphasizeActionHandler = undefined;
    UiFramework._settingsManager = undefined;

    UiIModelComponents.terminate();
    UiShowHideManager.terminate();
    UiFramework._initialized = false;
  }

  /** Determines if UiFramework has been initialized */
  public static get initialized(): boolean { return UiFramework._initialized; }

  /** Property that returns the SettingManager used by AppUI-based applications.
   * @public
   */
  public static get settingsManager() {
    if (undefined === UiFramework._settingsManager)
      UiFramework._settingsManager = new SettingsManager();
    return UiFramework._settingsManager;
  }

  /** @public */
  public static get frameworkStateKey(): string {
    return UiFramework._frameworkStateKeyInStore;
  }

  /** The UiFramework state maintained by Redux
   * @public
   */
  public static get frameworkState(): FrameworkState | undefined {
    try {
      // eslint-disable-next-line dot-notation
      return UiFramework.store.getState()[UiFramework.frameworkStateKey];
    } catch (_e) {
      return undefined;
    }
  }

  /** The Redux store */
  public static get store(): Store<any> {
    if (UiFramework._store)
      return UiFramework._store;

    // istanbul ignore else
    if (!StateManager.isInitialized(true))
      throw new UiError(UiFramework.loggerCategory(this), `Error trying to access redux store before either store or StateManager has been initialized.`);

    // istanbul ignore next
    return StateManager.store;
  }

  /** The internationalization service created by the app.
   * @internal
  */
  public static get localization(): Localization {
    // istanbul ignore next
    if (!IModelApp.localization)
      throw new UiError(UiFramework.loggerCategory(this), `IModelApp.localization has not been defined.`);
    return IModelApp.localization;
  }

  /** The internationalization service namespace. */
  public static get localizationNamespace(): string {
    return "UiFramework";
  }

  /** @public */
  public static get backstageManager(): BackstageManager {
    // istanbul ignore next
    if (!UiFramework._backstageManager)
      throw new UiError(UiFramework.loggerCategory(this), UiFramework._complaint);
    return UiFramework._backstageManager;
  }

  /** @alpha */
  public static get hideIsolateEmphasizeActionHandler(): HideIsolateEmphasizeActionHandler {
    // istanbul ignore next
    if (!UiFramework._hideIsolateEmphasizeActionHandler)
      throw new UiError(UiFramework.loggerCategory(this), UiFramework._complaint);
    return UiFramework._hideIsolateEmphasizeActionHandler;
  }

  /** @alpha */
  public static setHideIsolateEmphasizeActionHandler(handler: HideIsolateEmphasizeActionHandler | undefined) {
    // istanbul ignore else
    if (handler)
      UiFramework._hideIsolateEmphasizeActionHandler = handler;
    else
      UiFramework._hideIsolateEmphasizeActionHandler = new HideIsolateEmphasizeManager();
  }

  /** @alpha */
  public static get widgetManager(): WidgetManager {
    // istanbul ignore next
    if (!UiFramework._widgetManager)
      throw new UiError(UiFramework.loggerCategory(this), UiFramework._complaint);
    return UiFramework._widgetManager;
  }

  /** Calls localization.getLocalizedStringWithNamespace with the "UiFramework" namespace. Do NOT include the namespace in the key.
   * @internal
   */
  public static translate(key: string | string[]): string {
    return IModelApp.localization.getLocalizedStringWithNamespace(UiFramework.localizationNamespace, key);
  }

  /** @internal */
  public static get packageName(): string {
    return "appui-react";
  }

  /** @internal */
  public static loggerCategory(obj: any): string {
    const className = getClassName(obj);
    const category = UiFramework.packageName + (className ? `.${className}` : "");
    return category;
  }

  public static dispatchActionToStore(type: string, payload: any, immediateSync = false) {
    UiFramework.store.dispatch({ type, payload });
    if (immediateSync)
      SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(type);
    else
      SyncUiEventDispatcher.dispatchSyncUiEvent(type);
  }

  public static setAccudrawSnapMode(snapMode: SnapMode) {
    UiFramework.dispatchActionToStore(ConfigurableUiActionId.SetSnapMode, snapMode, true);
  }

  public static getAccudrawSnapMode(): SnapMode {
    return UiFramework.frameworkState ? UiFramework.frameworkState.configurableUiState.snapMode : /* istanbul ignore next */ SnapMode.NearestKeypoint;
  }

  public static getActiveSelectionScope(): string {
    return UiFramework.frameworkState ? UiFramework.frameworkState.sessionState.activeSelectionScope : /* istanbul ignore next */ "element";
  }

  public static setActiveSelectionScope(selectionScopeId: string): void {
    // istanbul ignore else
    if (UiFramework.frameworkState) {
      const foundIndex = UiFramework.frameworkState.sessionState.availableSelectionScopes.findIndex((selectionScope: PresentationSelectionScope) => selectionScope.id === selectionScopeId);
      if (-1 !== foundIndex) {
        const scope = UiFramework.frameworkState.sessionState.availableSelectionScopes[foundIndex];
        UiFramework.dispatchActionToStore(SessionStateActionId.SetSelectionScope, scope.id);
        Presentation.selection.scopes.activeScope = scope.id;
      }
    }
  }

  /** @public */
  public static openCursorMenu(menuData: CursorMenuData | undefined): void {
    UiFramework.dispatchActionToStore(SessionStateActionId.UpdateCursorMenu, menuData);
  }

  /** @public */
  public static closeCursorMenu(): void {
    UiFramework.dispatchActionToStore(SessionStateActionId.UpdateCursorMenu, undefined);
  }

  /** @public */
  public static getCursorMenuData(): CursorMenuData | undefined {
    return UiFramework.frameworkState ? UiFramework.frameworkState.sessionState.cursorMenuData : /* istanbul ignore next */ undefined;
  }

  public static getActiveIModelId(): string {
    return UiFramework.frameworkState ? UiFramework.frameworkState.sessionState.iModelId : /* istanbul ignore next */  "";
  }

  public static setActiveIModelId(iModelId: string): void {
    UiFramework.dispatchActionToStore(SessionStateActionId.SetActiveIModelId, iModelId);
  }

  public static setIModelConnection(iModelConnection: IModelConnection | undefined, immediateSync = false) {
    const oldConnection = UiFramework.getIModelConnection();
    if (oldConnection !== iModelConnection) {
      if (oldConnection?.iModelId)
        FrontstageManager.clearFrontstageDefsForIModelId(oldConnection.iModelId);
      oldConnection && undefined === iModelConnection && SyncUiEventDispatcher.clearConnectionEvents(oldConnection);
      iModelConnection && SyncUiEventDispatcher.initializeConnectionEvents(iModelConnection);
      UiFramework.dispatchActionToStore(SessionStateActionId.SetIModelConnection, iModelConnection, immediateSync);
    }
    UiFramework.setActiveIModelId(iModelConnection?.iModelId ?? "");
  }

  public static getIModelConnection(): IModelConnection | undefined {
    return UiFramework.frameworkState ? UiFramework.frameworkState.sessionState.iModelConnection : /* istanbul ignore next */  undefined;
  }

  /** Called by iModelApp to initialize saved UI state from registered UseSettingsProviders
   * @public
   */
  public static async initializeStateFromUserSettingsProviders(immediateSync = false) {
    // let any registered providers to load values from the new storage location
    const providerKeys = [...this._uiSettingsProviderRegistry.keys()];
    for await (const key of providerKeys) {
      await this._uiSettingsProviderRegistry.get(key)!.loadUserSettings(UiFramework._uiStateStorage);
    }

    // istanbul ignore next
    if (immediateSync)
      SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(SyncUiEventId.UiStateStorageChanged);
    else
      SyncUiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.UiStateStorageChanged);
  }

  /** @public */
  public static async setUiStateStorage(storage: UiStateStorage, immediateSync = false) {
    if (UiFramework._uiStateStorage === storage)
      return;

    UiFramework._uiStateStorage = storage;
    await this.initializeStateFromUserSettingsProviders(immediateSync);
  }

  /** The UI Settings Storage is a convenient wrapper around Local Storage to assist in caching state information across user sessions.
   * It was previously used to conflate both the state information across session and the information driven directly from user explicit action,
   * which are now handled with user preferences.
   * @public
   */
  public static getUiStateStorage(): UiStateStorage {
    return UiFramework._uiStateStorage;
  }

  public static setDefaultIModelViewportControlId(iModelViewportControlId: string, immediateSync = false) {
    UiFramework.dispatchActionToStore(SessionStateActionId.SetDefaultIModelViewportControlId, iModelViewportControlId, immediateSync);
  }

  public static getDefaultIModelViewportControlId(): string | undefined {
    return UiFramework.frameworkState ? UiFramework.frameworkState.sessionState.defaultIModelViewportControlId : /* istanbul ignore next */  undefined;
  }

  public static setDefaultViewId(viewId: string, immediateSync = false) {
    UiFramework.dispatchActionToStore(SessionStateActionId.SetDefaultViewId, viewId, immediateSync);
  }

  public static getDefaultViewId(): string | undefined {
    return UiFramework.frameworkState ? UiFramework.frameworkState.sessionState.defaultViewId : /* istanbul ignore next */  undefined;
  }

  public static setDefaultViewState(viewState: ViewState, immediateSync = false) {
    UiFramework.dispatchActionToStore(SessionStateActionId.SetDefaultViewState, viewState, immediateSync);
  }
  public static getDefaultViewState(): ViewState | undefined {
    return UiFramework.frameworkState ? UiFramework.frameworkState.sessionState.defaultViewState : /* istanbul ignore next */  undefined;
  }

  /** @public */
  public static getAvailableSelectionScopes(): PresentationSelectionScope[] {
    return UiFramework.frameworkState ?
      UiFramework.frameworkState.sessionState.availableSelectionScopes :
      /* istanbul ignore next */
      [{ id: "element", label: "Element" } as PresentationSelectionScope];
  }

  public static getIsUiVisible() {
    return UiShowHideManager.isUiVisible;
  }

  public static setIsUiVisible(visible: boolean) {
    if (UiShowHideManager.isUiVisible !== visible) {
      UiShowHideManager.isUiVisible = visible;
      UiFramework.onUiVisibilityChanged.emit({ visible });
    }
  }

  public static setColorTheme(theme: string) {
    if (UiFramework.getColorTheme() === theme)
      return;

    UiFramework.dispatchActionToStore(ConfigurableUiActionId.SetTheme, theme, true);
  }

  public static getColorTheme(): string {
    return UiFramework.frameworkState ? UiFramework.frameworkState.configurableUiState.theme : /* istanbul ignore next */ SYSTEM_PREFERRED_COLOR_THEME;
  }

  public static setWidgetOpacity(opacity: number) {
    if (UiFramework.getWidgetOpacity() === opacity)
      return;

    UiFramework.dispatchActionToStore(ConfigurableUiActionId.SetWidgetOpacity, opacity, true);
  }

  public static getWidgetOpacity(): number {
    return UiFramework.frameworkState ? UiFramework.frameworkState.configurableUiState.widgetOpacity : /* istanbul ignore next */ WIDGET_OPACITY_DEFAULT;
  }

  public static isMobile() {  // eslint-disable-line @itwin/prefer-get
    return ProcessDetector.isMobileBrowser;
  }

  /** Returns the Ui Version.
   * @public
   */
  public static get uiVersion(): FrameworkVersionId {
    return UiFramework.frameworkState ? UiFramework.frameworkState.configurableUiState.frameworkVersion : this._uiVersion;
  }

  public static setUiVersion(version: FrameworkVersionId) {
    if (UiFramework.uiVersion === version)
      return;

    UiFramework.dispatchActionToStore(ConfigurableUiActionId.SetFrameworkVersion, version === "1" ? "1" : "2", true);
  }

  public static get useDragInteraction(): boolean {
    return UiFramework.frameworkState ? UiFramework.frameworkState.configurableUiState.useDragInteraction : false;
  }

  public static setUseDragInteraction(useDragInteraction: boolean) {
    UiFramework.dispatchActionToStore(ConfigurableUiActionId.SetDragInteraction, useDragInteraction, true);
  }

  /** Send logging message to the telemetry system
   * @internal
   */
  // istanbul ignore next
  public static async postTelemetry(eventName: string, eventId?: GuidString, iTwinId?: GuidString, iModeId?: GuidString, changeSetId?: string, time?: TrackingTime, additionalProperties?: { [key: string]: any }): Promise<void> {
    if (!IModelApp.authorizationClient)
      return;

    try {
      const activity: RpcActivity = {
        sessionId: IModelApp.sessionId,
        activityId: "",
        applicationId: IModelApp.applicationId,
        applicationVersion: IModelApp.applicationVersion,
        accessToken: (await IModelApp.authorizationClient.getAccessToken()) ?? "",
      };
      const telemetryEvent = new TelemetryEvent(eventName, eventId, iTwinId, iModeId, changeSetId, time, additionalProperties);
      await IModelApp.telemetry.postTelemetry(activity, telemetryEvent);
    } catch { }
  }
  private static _handleFrameworkVersionChangedEvent = (args: FrameworkVersionChangedEventArgs) => {
    // Log Ui Version used
    Logger.logInfo(UiFramework.loggerCategory(UiFramework), `Ui Version changed to ${args.version} `);
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    UiFramework.postTelemetry(`Ui Version changed to ${args.version} `, "F2772C81-962D-4755-807C-2D675A5FF399");
    UiFramework.setUiVersion(args.version);
  };

  /** Determines whether a ContextMenu is open
   * @alpha
   * */
  public static get isContextMenuOpen(): boolean {
    const contextMenu = document.querySelector("div.core-context-menu-opened");
    return contextMenu !== null && contextMenu !== undefined;
  }
}
