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
import { InternalConfigurableUiManager } from "./configurableui/InternalConfigurableUiManager";
import { ConfigurableUiActionId } from "./configurableui/state";
import { FrameworkState } from "./redux/FrameworkState";
import { CursorMenuData, PresentationSelectionScope, SessionStateActionId } from "./redux/SessionState";
import { StateManager } from "./redux/StateManager";
import { HideIsolateEmphasizeActionHandler, HideIsolateEmphasizeManager } from "./selection/HideIsolateEmphasizeManager";
import { InternalSyncUiEventDispatcher } from "./syncui/InternalSyncUiEventDispatcher";
import { SYSTEM_PREFERRED_COLOR_THEME, TOOLBAR_OPACITY_DEFAULT, WIDGET_OPACITY_DEFAULT } from "./theme/ThemeManager";
import * as keyinPaletteTools from "./tools/KeyinPaletteTools";
import * as openSettingTools from "./tools/OpenSettingsTool";
import * as restoreLayoutTools from "./tools/RestoreLayoutTool";
import * as toolSettingTools from "./tools/ToolSettingsTools";
import { InternalUiShowHideManager, UiShowHideSettingsProvider } from "./utils/InternalUiShowHideManager";
import { WidgetManager } from "./widgets/WidgetManager";
import { InternalFrontstageManager } from "./frontstage/InternalFrontstageManager";
import { InternalContentViewManager } from "./content/InternalContentViewManager";
import { InternalModalDialogManager } from "./dialog/InternalModalDialogManager";
import { InternalModelessDialogManager } from "./dialog/InternalModelessDialogManager";
import { InternalKeyboardShortcutManager } from "./keyboardshortcut/InternalKeyboardShortcut";
import { InternalToolSettingsManager } from "./zones/toolsettings/InternalToolSettingsManager";
import { FrameworkBackstage } from "./framework/FrameworkBackstage";
import { FrameworkChildWindows } from "./framework/FrameworkChildWindows";
import { FrameworkControls } from "./framework/FrameworkControls";
import { FrameworkFrontstages } from "./framework/FrameworkFrontstages";
import { FrameworkEvents, SyncUiEventId } from "./framework/FrameworkEvents";
import { FrameworkToolSettings } from "./framework/FrameworkToolSettings";
import { FrameworkContent } from "./framework/FrameworkContent";
import { FrameworkDialogs } from "./framework/FrameworkDialogs";
import { FrameworkKeyboardShortcuts } from "./framework/FrameworkKeyboardShortcuts";
import { FrameworkVisibility } from "./framework/FrameworkVisibility";

// cSpell:ignore Mobi

/** Defined that available UI Versions. It is recommended to always use the latest version available.
 * @deprecated in 3.5. Used to toggle between UI1.0 and UI2.0.
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
  oldVersion: FrameworkVersionId; // eslint-disable-line deprecation/deprecation
  version: FrameworkVersionId; // eslint-disable-line deprecation/deprecation
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
  /**
   * Operation on the backstage component.
   * @beta
   */
  public static get backstage(): FrameworkBackstage {
    // istanbul ignore next
    if (!UiFramework._backstageManager)
      throw new UiError(UiFramework.loggerCategory(this), UiFramework._complaint);
    return UiFramework._backstageManager;
  }

  /**
   * Manage access to the child windows.
   * @beta
   */
  public static get childWindows(): FrameworkChildWindows {
    return this._PopupWindowManager;
  }

  /**
   * Manage registered controls
   * @beta
   */
  public static get controls(): FrameworkControls {
    return InternalConfigurableUiManager;
  }

  /**
   * Manage access to frontstages and related helper methods.
   * @beta
   */
  public static get frontstages(): FrameworkFrontstages {
    return InternalFrontstageManager;
  }

  /**
   * Manage events
   * @beta
   */
  public static get events(): FrameworkEvents {
    return InternalSyncUiEventDispatcher;
  }

  /**
   * Manage access and behavior of the tool settings.
   * @beta
   */
  public static get toolSettings(): FrameworkToolSettings {
    return InternalToolSettingsManager;
  }

  /**
   * Manage content presented by the frontstages.
   * @beta
   */
  public static get content(): FrameworkContent {
    return InternalContentViewManager;
  }

  /**
   * Manage displayed dialogs.
   * @beta
   */
  public static get dialogs(): FrameworkDialogs {
    return {
      modal: InternalModalDialogManager,
      modeless: InternalModelessDialogManager,
    };
  }

  /**
   * Manages global keyboard shortcuts
   * @beta
   */
  public static get keyboardShortcuts(): FrameworkKeyboardShortcuts {
    return InternalKeyboardShortcutManager;
  }

  /**
   * Manages UI visibility (Show/Hide)
   * @beta
   */
  public static get visibility(): FrameworkVisibility {
    return InternalUiShowHideManager;
  }

  private static _initialized = false;
  private static _store?: Store<any>;
  private static _complaint = "UiFramework not initialized";
  private static _frameworkStateKeyInStore: string = "frameworkState";  // default name
  private static _backstageManager?: BackstageManager;
  private static _widgetManager?: WidgetManager;
  private static _uiVersion: FrameworkVersionId = "2"; // eslint-disable-line deprecation/deprecation
  private static _hideIsolateEmphasizeActionHandler?: HideIsolateEmphasizeActionHandler;
  /** this provides a default state storage handler */
  private static _uiStateStorage: UiStateStorage = new LocalStateStorage();
  private static _settingsManager?: SettingsManager;
  private static _uiSettingsProviderRegistry: Map<string, UserSettingsProvider> = new Map<string, UserSettingsProvider>();
  private static _PopupWindowManager = new ChildWindowManager(); // eslint-disable-line deprecation/deprecation
  public static useDefaultPopoutUrl = false;

  /** @public
   * @deprecated in 3.6. Use `childWindows` property, name realignment.
  */
  public static get childWindowManager(): ChildWindowManager { // eslint-disable-line deprecation/deprecation
    return UiFramework.childWindows as ChildWindowManager; // eslint-disable-line deprecation/deprecation
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
   * @param startInUi1Mode Used for legacy applications to start up in the deprecated UI 1 mode. This should not set by newer applications.
   */
  public static async initialize(store: Store<any> | undefined, frameworkStateKey?: string): Promise<void>;

  /**
   * @deprecated in 3.5. UI1.0 is deprecated. Use an overload without a `startInUi1Mode` argument instead.
   */

  public static async initialize(store: Store<any> | undefined, frameworkStateKey?: string, startInUi1Mode?: boolean): Promise<void>;  // eslint-disable-line @typescript-eslint/unified-signatures

  /**
   * Called by the application to initialize the UiFramework. Also initializes UIIModelComponents, UiComponents, UiCore.
   * @param store The single Redux store created by the host application. If this is `undefined` then it is assumed that the [[StateManager]] is being used to provide the Redux store.
   * @param frameworkStateKey The name of the key used by the app when adding the UiFramework state into the Redux store. If not defined "frameworkState" is assumed. This value is ignored if [[StateManager]] is being used. The StateManager use "frameworkState".
   * @param startInUi1Mode Used for legacy applications to start up in the deprecated UI 1 mode. This should not set by newer applications.
   * @deprecated in 3.6.
   */
  public static async initialize(store: Store<any> | undefined, frameworkStateKey?: string, startInUi1Mode?: boolean): Promise<void> {
    return this.initializeEx(store, frameworkStateKey, startInUi1Mode);
  }

  /**
   * Called by the application to initialize the UiFramework. Also initializes UIIModelComponents, UiComponents, UiCore.
   * @param store The single Redux store created by the host application. If this is `undefined` then it is assumed that the [[StateManager]] is being used to provide the Redux store.
   * @param frameworkStateKey The name of the key used by the app when adding the UiFramework state into the Redux store. If not defined "frameworkState" is assumed. This value is ignored if [[StateManager]] is being used. The StateManager use "frameworkState".
   * @param startInUi1Mode Used for legacy applications to start up in the deprecated UI 1 mode. This should not set by newer applications.
   *
   * @internal
   */
  public static async initializeEx(store: Store<any> | undefined, frameworkStateKey?: string, startInUi1Mode?: boolean): Promise<void> {
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

    if (startInUi1Mode)
      UiFramework.store.dispatch({ type: ConfigurableUiActionId.SetFrameworkVersion, payload: "1" }); // eslint-disable-line deprecation/deprecation

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
      UiFramework.events.dispatchSyncUiEvent(SyncUiEventId.SettingsProvidersChanged);
    });

    // Initialize the MessagePresenter interface in UiAdmin for Editor notifications
    UiAdmin.messagePresenter = IModelApp.notifications;

    UiFramework._initialized = true;

    // initialize any standalone settings providers that don't need to have defaults set by iModelApp
    UiShowHideSettingsProvider.initialize();

    InternalConfigurableUiManager.initialize();

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
    UiFramework.visibility.terminate();
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

  /** @public
   * @deprecated in 3.6. Use `backstage` alternate property, name realignment.
  */
  public static get backstageManager(): BackstageManager {
    return UiFramework.backstage as BackstageManager;
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

  /** Calls localization.getLocalizedString with the "UiFramework" namespace. Do NOT include the namespace in the key.
   * @internal
   */
  public static translate(key: string | string[]): string {
    return IModelApp.localization.getLocalizedString(key, { ns: UiFramework.localizationNamespace });
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
      UiFramework.events.dispatchImmediateSyncUiEvent(type);
    else
      UiFramework.events.dispatchSyncUiEvent(type);
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
        UiFramework.frontstages.clearFrontstageDefsForIModelId(oldConnection.iModelId);
      oldConnection && undefined === iModelConnection && UiFramework.events.clearConnectionEvents(oldConnection);
      iModelConnection && UiFramework.events.initializeConnectionEvents(iModelConnection);
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
      UiFramework.events.dispatchImmediateSyncUiEvent(SyncUiEventId.UiStateStorageChanged);
    else
      UiFramework.events.dispatchSyncUiEvent(SyncUiEventId.UiStateStorageChanged);
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
    return UiFramework.visibility.isUiVisible;
  }

  public static setIsUiVisible(visible: boolean) {
    if (UiFramework.visibility.isUiVisible !== visible) {
      UiFramework.visibility.isUiVisible = visible;
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

  /** UiFramework.setToolbarOpacity() sets the non-hovered opacity to the value specified. Used by UI 2.0 and later.
   * @param opacity a value between 0 and 1. The default value is 0.5. IT IS NOT ADVISED TO USE A VALUE BELOW 0.2
   * @public
   */
  public static setToolbarOpacity(opacity: number) {
    if (UiFramework.getToolbarOpacity() === opacity)
      return;

    UiFramework.dispatchActionToStore(ConfigurableUiActionId.SetToolbarOpacity, opacity, true);
  }

  /** UiFramework.getToolbarOpacity() returns a number between 0 and 1 that is the non-hovered opacity for toolbars.
   * @public
   */
  public static getToolbarOpacity(): number {
    return UiFramework.frameworkState ? UiFramework.frameworkState.configurableUiState.toolbarOpacity : /* istanbul ignore next */ TOOLBAR_OPACITY_DEFAULT;
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
   * @deprecated in 3.6. UI1.0 is deprecated.
   * @public
   */
  public static get uiVersion(): FrameworkVersionId { // eslint-disable-line deprecation/deprecation
    return UiFramework.frameworkState ? UiFramework.frameworkState.configurableUiState.frameworkVersion : this._uiVersion; // eslint-disable-line deprecation/deprecation
  }

  /** @deprecated in 3.6. UI1.0 is deprecated. */
  public static setUiVersion(version: FrameworkVersionId) { // eslint-disable-line deprecation/deprecation
    if (UiFramework.uiVersion === version) // eslint-disable-line deprecation/deprecation
      return;

    UiFramework.dispatchActionToStore(ConfigurableUiActionId.SetFrameworkVersion, version === "1" ? "1" : "2", true); // eslint-disable-line deprecation/deprecation
  }

  public static get showWidgetIcon(): boolean {
    return UiFramework.frameworkState ? UiFramework.frameworkState.configurableUiState.showWidgetIcon : /* istanbul ignore next */ false;
  }

  public static setShowWidgetIcon(value: boolean) {
    if (UiFramework.showWidgetIcon === value)
      return;

    UiFramework.dispatchActionToStore(ConfigurableUiActionId.SetShowWidgetIcon, value, true);
  }
  /** Animate Tool Settings on appear  */
  public static get animateToolSettings(): boolean {
    return UiFramework.frameworkState ? UiFramework.frameworkState.configurableUiState.animateToolSettings : /* istanbul ignore next */ false;
  }
  public static setAnimateToolSettings(value: boolean) {
    if (UiFramework.animateToolSettings === value)
      return;
    UiFramework.dispatchActionToStore(ConfigurableUiActionId.AnimateToolSettings, value, true);
  }

  /** Use Tool Name As Tool Settings Widget Tab Label */
  public static get useToolAsToolSettingsLabel(): boolean {
    return UiFramework.frameworkState ? UiFramework.frameworkState.configurableUiState.useToolAsToolSettingsLabel : /* istanbul ignore next */ false;
  }
  public static setUseToolAsToolSettingsLabel(value: boolean) {
    if (UiFramework.useToolAsToolSettingsLabel === value)
      return;
    UiFramework.dispatchActionToStore(ConfigurableUiActionId.UseToolAsToolSettingsLabel, value, true);
  }

  /** @alpha */
  public static get autoCollapseUnpinnedPanels(): boolean {
    return UiFramework.frameworkState ? UiFramework.frameworkState.configurableUiState.autoCollapseUnpinnedPanels : /* istanbul ignore next */ false;
  }

  /** Method used to enable the automatic closing of an unpinned widget panel as soon as the
   * mouse leaves the widget panel. The default behavior is to require a mouse click outside
   * the panel before it is closed.
   * @alpha */

  public static setAutoCollapseUnpinnedPanels(value: boolean) {
    if (UiFramework.autoCollapseUnpinnedPanels === value)
      return;

    UiFramework.dispatchActionToStore(ConfigurableUiActionId.AutoCollapseUnpinnedPanels, value, true);
  }

  public static get useDragInteraction(): boolean {
    return UiFramework.frameworkState ? UiFramework.frameworkState.configurableUiState.useDragInteraction : false;
  }

  public static setUseDragInteraction(useDragInteraction: boolean) {
    UiFramework.dispatchActionToStore(ConfigurableUiActionId.SetDragInteraction, useDragInteraction, true);
  }

  /** Returns the variable controlling whether the overlay is displayed in a Viewport
   * @public
   */
  public static get viewOverlayDisplay() {
    return UiFramework.frameworkState ? UiFramework.frameworkState.configurableUiState.viewOverlayDisplay : /* istanbul ignore next */ true;
  }
  /** Set the variable that controls display of the view overlay. Applies to all viewports in the app
 * @public
 */
  public static setViewOverlayDisplay(display: boolean) {
    if (UiFramework.viewOverlayDisplay === display)
      return;
    UiFramework.dispatchActionToStore(ConfigurableUiActionId.SetViewOverlayDisplay, display);
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
  /** Determines whether a ContextMenu is open
   * @alpha
   * */
  public static get isContextMenuOpen(): boolean {
    const contextMenu = document.querySelector("div.core-context-menu-opened");
    return contextMenu !== null && contextMenu !== undefined;
  }
}
