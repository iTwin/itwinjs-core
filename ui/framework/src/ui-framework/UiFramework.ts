/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utilities */

import { Store } from "redux";

import { OidcFrontendClientConfiguration, IOidcFrontendClient, AccessToken } from "@bentley/imodeljs-clients";
import { I18N, TranslationOptions } from "@bentley/imodeljs-i18n";
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { IModelConnection, SnapMode, IModelApp, OidcBrowserClient, ViewState, FrontendRequestContext } from "@bentley/imodeljs-frontend";
import { UiError, getClassName } from "@bentley/ui-abstract";
import { UiEvent } from "@bentley/ui-core";
import { Presentation } from "@bentley/presentation-frontend";

import { ProjectServices } from "./clientservices/ProjectServices";
import { DefaultProjectServices } from "./clientservices/DefaultProjectServices";
import { IModelServices } from "./clientservices/IModelServices";
import { DefaultIModelServices } from "./clientservices/DefaultIModelServices";
import { SyncUiEventDispatcher } from "./syncui/SyncUiEventDispatcher";
import { FrameworkState } from "./redux/FrameworkState";
import { ConfigurableUiActionId } from "./configurableui/state";
import { SessionStateActionId, PresentationSelectionScope, CursorMenuData } from "./redux/SessionState";
import { COLOR_THEME_DEFAULT, WIDGET_OPACITY_DEFAULT } from "./theme/ThemeManager";
import { UiShowHideManager } from "./utils/UiShowHideManager";
import { BackstageManager } from "./backstage/BackstageManager";
import { StatusBarManager } from "./statusbar/StatusBarManager";

// cSpell:ignore Mobi

/** UiVisibility Event Args interface.
 * @beta
 */
export interface UiVisibilityEventArgs {
  visible: boolean;
}

/** UiVisibility Event class.
 * @beta
 */
export class UiVisibilityChangedEvent extends UiEvent<UiVisibilityEventArgs> { }

/**
 * Manages the Redux store, I18N service and iModel, Project and Login services for the ui-framework package.
 * @public
 */
export class UiFramework {
  private static _projectServices?: ProjectServices;
  private static _iModelServices?: IModelServices;
  private static _i18n?: I18N;
  private static _store?: Store<any>;
  private static _complaint = "UiFramework not initialized";
  private static _frameworkStateKeyInStore: string = "frameworkState";  // default name
  private static _backstageManager?: BackstageManager;
  private static _statusBarManager?: StatusBarManager;

  /** Get Show Ui event.
   * @beta
   */
  public static readonly onUiVisibilityChanged = new UiVisibilityChangedEvent();

  /**
   * Called by the app to initialize the UiFramework
   * @param store The single redux store created by the app.
   * @param i18n The internationalization service created by the app.
   * @param oidcConfig Configuration for authenticating user.
   * @param frameworkStateKey The name of the key used by the app when adding the UiFramework state into the Redux store. If not defined "frameworkState" is assumed.
   */
  public static async initialize(store: Store<any>, i18n: I18N, oidcConfig?: OidcFrontendClientConfiguration, frameworkStateKey?: string): Promise<any> {
    return this.initializeEx(store, i18n, oidcConfig, frameworkStateKey);
  }

  /**
   * Called by the app to initialize the UiFramework
   * @param store The single redux store created by the app.
   * @param i18n The internationalization service created by the app.
   * @param oidcConfig Optional configuration for authenticating user.
   * @param frameworkStateKey The name of the key used by the app when adding the UiFramework state into the Redux store. If not defined "frameworkState" is assumed.
   * @param projectServices Optional app defined projectServices. If not specified DefaultProjectServices will be used.
   * @param iModelServices Optional app defined iModelServices. If not specified DefaultIModelServices will be used.
   *
   * @internal
   */
  public static async initializeEx(store: Store<any>, i18n: I18N, oidcConfig?: OidcFrontendClientConfiguration, frameworkStateKey?: string, projectServices?: ProjectServices, iModelServices?: IModelServices): Promise<any> {
    UiFramework._store = store;
    UiFramework._i18n = i18n;
    if (frameworkStateKey)
      UiFramework._frameworkStateKeyInStore = frameworkStateKey;

    const frameworkNamespace = UiFramework._i18n.registerNamespace(UiFramework.i18nNamespace);
    const readFinishedPromise = frameworkNamespace.readFinished;

    UiFramework._projectServices = projectServices ? projectServices : new DefaultProjectServices();
    UiFramework._iModelServices = iModelServices ? iModelServices : new DefaultIModelServices();
    UiFramework._backstageManager = new BackstageManager();
    UiFramework._statusBarManager = new StatusBarManager();

    // istanbul ignore next
    if (oidcConfig) {
      const oidcClient = new OidcBrowserClient(oidcConfig);
      const initOidcPromise = oidcClient.initialize(new ClientRequestContext())
        .then(() => (UiFramework.oidcClient = oidcClient, IModelApp.authorizationClient = UiFramework._oidcClient));
      return Promise.all([readFinishedPromise, initOidcPromise]);
    }
    return readFinishedPromise;
  }

  /** Unregisters the UiFramework internationalization service namespace */
  public static terminate() {
    UiFramework._store = undefined;
    UiFramework._frameworkStateKeyInStore = "frameworkState";

    if (UiFramework._i18n)
      UiFramework._i18n.unregisterNamespace(UiFramework.i18nNamespace);
    UiFramework._i18n = undefined;
    UiFramework._projectServices = undefined;
    UiFramework._iModelServices = undefined;
    UiFramework._backstageManager = undefined;
    UiFramework._statusBarManager = undefined;
  }

  private static _oidcClient: IOidcFrontendClient | undefined;
  private static _removeUserStateListener: () => void;
  /** @beta */
  public static get oidcClient(): IOidcFrontendClient | undefined {
    return UiFramework._oidcClient;
  }

  /** @beta */
  // istanbul ignore next
  public static set oidcClient(oidcClient: IOidcFrontendClient | undefined) {
    if (UiFramework._removeUserStateListener)
      UiFramework._removeUserStateListener();

    UiFramework._oidcClient = oidcClient;

    if (oidcClient) {
      oidcClient.getAccessToken(new FrontendRequestContext()) // tslint:disable-line: no-floating-promises
        .then((accessToken: AccessToken | undefined) => {
          UiFramework.setAccessTokenInternal(accessToken);
        });
      UiFramework._removeUserStateListener = oidcClient.onUserStateChanged.addListener((token: AccessToken | undefined) => UiFramework.setAccessTokenInternal(token));
    }
  }

  /** @beta */
  public static get frameworkStateKey(): string {
    return UiFramework._frameworkStateKeyInStore;
  }

  /** The UiFramework state maintained by Redux
   * @beta
   */
  public static get frameworkState(): FrameworkState | undefined {
    // tslint:disable-next-line:no-string-literal
    return UiFramework.store.getState()[UiFramework.frameworkStateKey];
  }

  /** The Redux store */
  public static get store(): Store<any> {
    if (!UiFramework._store)
      throw new UiError(UiFramework.loggerCategory(this), UiFramework._complaint);
    return UiFramework._store;
  }

  /** The internationalization service created by the app. */
  public static get i18n(): I18N {
    if (!UiFramework._i18n)
      throw new UiError(UiFramework.loggerCategory(this), UiFramework._complaint);
    return UiFramework._i18n;
  }

  /** The internationalization service namespace. */
  public static get i18nNamespace(): string {
    return "UiFramework";
  }

  /** @beta */
  public static get backstageManager(): BackstageManager {
    // istanbul ignore next
    if (!UiFramework._backstageManager)
      throw new UiError(UiFramework.loggerCategory(this), UiFramework._complaint);
    return UiFramework._backstageManager;
  }

  /** @beta */
  public static get statusBarManager(): StatusBarManager {
    // istanbul ignore next
    if (!UiFramework._statusBarManager)
      throw new UiError(UiFramework.loggerCategory(this), UiFramework._complaint);
    return UiFramework._statusBarManager;
  }

  /** Calls i18n.translateWithNamespace with the "UiFramework" namespace. Do NOT include the namespace in the key.
   * @internal
   */
  public static translate(key: string | string[], options?: TranslationOptions): string {
    return UiFramework.i18n.translateWithNamespace(UiFramework.i18nNamespace, key, options);
  }

  /** @internal */
  public static get packageName(): string {
    return "ui-framework";
  }

  /** @internal */
  public static loggerCategory(obj: any): string {
    const className = getClassName(obj);
    const category = UiFramework.packageName + (className ? `.${className}` : "");
    return category;
  }

  /** @internal */
  public static get projectServices(): ProjectServices {
    if (!UiFramework._projectServices)
      throw new UiError(UiFramework.loggerCategory(this), UiFramework._complaint);
    return UiFramework._projectServices!;
  }

  /** @internal */
  public static get iModelServices(): IModelServices {
    if (!UiFramework._iModelServices)
      throw new UiError(UiFramework.loggerCategory(this), UiFramework._complaint);
    return UiFramework._iModelServices!;
  }

  public static dispatchActionToStore(type: string, payload: any, immediateSync = false) {
    UiFramework.store.dispatch({ type, payload });
    if (immediateSync)
      SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(type);
    else
      SyncUiEventDispatcher.dispatchSyncUiEvent(type);
  }

  public static setAccudrawSnapMode(snapMode: SnapMode) {
    UiFramework.store.dispatch({ type: ConfigurableUiActionId.SetSnapMode, payload: snapMode });
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

  /** @beta */
  public static openCursorMenu(menuData: CursorMenuData | undefined): void {
    UiFramework.dispatchActionToStore(SessionStateActionId.UpdateCursorMenu, menuData);
  }

  /** @beta */
  public static closeCursorMenu(): void {
    UiFramework.dispatchActionToStore(SessionStateActionId.UpdateCursorMenu, undefined);
  }

  /** @beta */
  public static getCursorMenuData(): CursorMenuData | undefined {
    return UiFramework.frameworkState ? UiFramework.frameworkState.sessionState.cursorMenuData : undefined;
  }

  public static getActiveIModelId(): string {
    return UiFramework.frameworkState ? UiFramework.frameworkState.sessionState.iModelId : /* istanbul ignore next */  "";
  }

  public static setActiveIModelId(iModelId: string): void {
    UiFramework.dispatchActionToStore(SessionStateActionId.SetActiveIModelId, iModelId);
  }

  public static setIModelConnection(iModelConnection: IModelConnection | undefined, immediateSync = false) {
    UiFramework.dispatchActionToStore(SessionStateActionId.SetIModelConnection, iModelConnection, immediateSync);
  }

  public static getIModelConnection(): IModelConnection | undefined {
    return UiFramework.frameworkState ? UiFramework.frameworkState.sessionState.iModelConnection : /* istanbul ignore next */  undefined;
  }

  /** @deprecated Token is managed internally, and there is no need for the caller to explicitly set the access token. */
  public static setAccessToken(accessToken: AccessToken | undefined, immediateSync = false) {
    this.setAccessTokenInternal(accessToken, immediateSync);
  }

  private static setAccessTokenInternal(accessToken: AccessToken | undefined, immediateSync = false) {
    UiFramework.dispatchActionToStore(SessionStateActionId.SetAccessToken, accessToken, immediateSync);
  }

  public static getAccessToken(): AccessToken | undefined {
    return UiFramework.frameworkState ? UiFramework.frameworkState.sessionState.accessToken : /* istanbul ignore next */  undefined;
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
  public static setDefaultRulesetId(viewId: string, immediateSync = false) {
    UiFramework.dispatchActionToStore(SessionStateActionId.SetDefaultRulesetId, viewId, immediateSync);
  }

  public static getDefaultRulesetId(): string | undefined {
    return UiFramework.frameworkState ? UiFramework.frameworkState.sessionState.defaultRulesetId : /* istanbul ignore next */  undefined;
  }

  /** @beta */
  public static getAvailableSelectionScopes(): PresentationSelectionScope[] {
    return UiFramework.frameworkState ?
      UiFramework.frameworkState.sessionState.availableSelectionScopes :
      /* istanbul ignore next */
      [{ id: "element", label: "Element" } as PresentationSelectionScope];
  }

  /** @beta */
  public static getIsUiVisible() {
    return UiShowHideManager.isUiVisible;
  }

  /** @beta */
  public static setIsUiVisible(visible: boolean) {
    if (UiShowHideManager.isUiVisible !== visible) {
      UiShowHideManager.isUiVisible = visible;
      UiFramework.onUiVisibilityChanged.emit({ visible });
    }
  }

  /** @beta */
  public static setColorTheme(theme: string) {
    UiFramework.store.dispatch({ type: ConfigurableUiActionId.SetTheme, payload: theme });
  }

  /** @beta */
  public static getColorTheme(): string {
    return UiFramework.frameworkState ? UiFramework.frameworkState.configurableUiState.theme : /* istanbul ignore next */ COLOR_THEME_DEFAULT;
  }

  /** @beta */
  public static setWidgetOpacity(opacity: number) {
    UiFramework.store.dispatch({ type: ConfigurableUiActionId.SetWidgetOpacity, payload: opacity });
  }

  /** @beta */
  public static getWidgetOpacity(): number {
    return UiFramework.frameworkState ? UiFramework.frameworkState.configurableUiState.widgetOpacity : /* istanbul ignore next */ WIDGET_OPACITY_DEFAULT;
  }

  // TODO: Need better way of determining if Mobile environment
  /** @beta */
  // istanbul ignore next
  public static isMobile() {  // tslint:disable-line: prefer-get
    let mobile = false;
    if ((/Mobi|Android/i.test(navigator.userAgent))) {
      mobile = true;
    }
    if (/Mobi|iPad|iPhone|iPod/i.test(navigator.userAgent)) {
      mobile = true;
    }
    return mobile;
  }
}
