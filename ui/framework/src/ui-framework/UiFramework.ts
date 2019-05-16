/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utilities */

import { OidcFrontendClientConfiguration } from "@bentley/imodeljs-clients";
import { I18N } from "@bentley/imodeljs-i18n";
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { ProjectServices } from "./clientservices/ProjectServices";
import { DefaultProjectServices } from "./clientservices/DefaultProjectServices";
import { IModelServices } from "./clientservices/IModelServices";
import { DefaultIModelServices } from "./clientservices/DefaultIModelServices";
import { Store } from "redux";
import { OidcClientWrapper, SnapMode, IModelApp } from "@bentley/imodeljs-frontend";
import { SyncUiEventDispatcher } from "./syncui/SyncUiEventDispatcher";
import { FrameworkState } from "./FrameworkState";
import { ConfigurableUiActionId } from "./configurableui/state";
import { SessionStateActionId } from "./SessionState";
import { UiEvent } from "@bentley/ui-core";
import { COLOR_THEME_DEFAULT, WIDGET_OPACITY_DEFAULT } from "./theme/ThemeManager";
import { Presentation } from "@bentley/presentation-frontend";
import { UiShowHideManager } from "./utils/UiShowHideManager";

/** UiVisibility Event Args interface.
 * @beta
 */
export interface UiVisibilityEventArgs {
  visible: boolean;
}

/** PresentationSelectionScope holds the id and the localized label for a selection scope supported for a specific iModel.
 * Added to avoid an api-extract error caused by using SelectionScope.
 * @beta
 */
export interface PresentationSelectionScope {
  id: string;
  label: string;
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

  /** Get Show Ui event.
   * @beta
   */
  public static readonly onUiVisibilityChanged = new UiVisibilityChangedEvent();

  /**
   * Called by IModelApp to initialize the UiFramework
   * @param store The single redux store created by the IModelApp.
   * @param i18n The internationalization service created by the IModelApp.
   * @param oidcConfig Configuration for authenticating user.
   * @param frameworkStateKey The name of the key used by the IModelApp when adding the UiFramework state into the Redux store. If not defined "frameworkState" is assumed.
   */
  public static async initialize(store: Store<any>, i18n: I18N, oidcConfig?: OidcFrontendClientConfiguration, frameworkStateKey?: string): Promise<any> {
    return this.initializeEx(store, i18n, oidcConfig, frameworkStateKey);
  }

  /**
   * Called by IModelApp to initialize the UiFramework
   * @param store The single redux store created by the IModelApp.
   * @param i18n The internationalization service created by the IModelApp.
   * @param oidcConfig Optional configuration for authenticating user.
   * @param frameworkStateKey The name of the key used by the IModelApp when adding the UiFramework state into the Redux store. If not defined "frameworkState" is assumed.
   * @param projectServices Optional IModelApp defined projectServices.If not specified DefaultProjectServices will be used.
   * @param iModelServices Optional IModelApp defined iModelServices.If not specified DefaultIModelServices will be used.
   *
   * @internal
   */
  public static async initializeEx(store: Store<any>, i18n: I18N, oidcConfig?: OidcFrontendClientConfiguration, frameworkStateKey?: string, projectServices?: ProjectServices, iModelServices?: IModelServices): Promise<any> {
    UiFramework._store = store;
    UiFramework._i18n = i18n;
    if (frameworkStateKey)
      UiFramework._frameworkStateKeyInStore = frameworkStateKey;

    const frameworkNamespace = UiFramework._i18n.registerNamespace("UiFramework");
    const readFinishedPromise = frameworkNamespace.readFinished;

    UiFramework._projectServices = projectServices ? projectServices : new DefaultProjectServices();
    UiFramework._iModelServices = iModelServices ? iModelServices : new DefaultIModelServices();

    if (oidcConfig) {
      const initOidcPromise = OidcClientWrapper.initialize(new ClientRequestContext(), oidcConfig)
        .then(() => IModelApp.authorizationClient = OidcClientWrapper.oidcClient);
      return Promise.all([readFinishedPromise, initOidcPromise]);
    }
    return readFinishedPromise;
  }

  public static terminate() {
    UiFramework._store = undefined;
    UiFramework._frameworkStateKeyInStore = "frameworkState";

    if (UiFramework._i18n)
      UiFramework._i18n.unregisterNamespace("UiFramework");
    UiFramework._i18n = undefined;
    UiFramework._projectServices = undefined;
    UiFramework._iModelServices = undefined;
  }

  public static get frameworkStateKey(): string {
    return UiFramework._frameworkStateKeyInStore;
  }

  /** @beta */
  public static get frameworkState(): FrameworkState | undefined {
    // tslint:disable-next-line:no-string-literal
    return UiFramework.store.getState()[UiFramework.frameworkStateKey];
  }

  public static get store(): Store<any> {
    if (!UiFramework._store)
      throw new Error(UiFramework._complaint);
    return UiFramework._store;
  }

  public static get i18n(): I18N {
    if (!UiFramework._i18n)
      throw new Error(UiFramework._complaint);
    return UiFramework._i18n;
  }

  /** @internal */
  public static get projectServices(): ProjectServices {
    if (!UiFramework._projectServices)
      throw new Error(UiFramework._complaint);
    return UiFramework._projectServices!;
  }

  /** @internal */
  public static get iModelServices(): IModelServices {
    if (!UiFramework._iModelServices)
      throw new Error(UiFramework._complaint);
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
    return UiFramework.frameworkState ? UiFramework.frameworkState.configurableUiState.snapMode : SnapMode.NearestKeypoint;
  }

  public static getActiveSelectionScope(): string {
    return UiFramework.frameworkState ? UiFramework.frameworkState.sessionState.activeSelectionScope : "element";
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

  public static getFrontStageKey(): number {
    return UiFramework.frameworkState ? UiFramework.frameworkState.sessionState.frontstageKey : 0;
  }

  public static setFrontStageKey(frontstageKey: number): void {
    UiFramework.dispatchActionToStore(SessionStateActionId.SetFronstageKey, frontstageKey);
  }

  /** @beta */
  public static getAvailableSelectionScopes(): PresentationSelectionScope[] {
    return UiFramework.frameworkState ? UiFramework.frameworkState.sessionState.availableSelectionScopes : [{ id: "element", label: "Element" } as PresentationSelectionScope];
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
    return UiFramework.frameworkState ? UiFramework.frameworkState.configurableUiState.theme : COLOR_THEME_DEFAULT;
  }

  /** @beta */
  public static setWidgetOpacity(opacity: number) {
    UiFramework.store.dispatch({ type: ConfigurableUiActionId.SetWidgetOpacity, payload: opacity });
  }

  /** @beta */
  public static getWidgetOpacity(): number {
    return UiFramework.frameworkState ? UiFramework.frameworkState.configurableUiState.widgetOpacity : WIDGET_OPACITY_DEFAULT;
  }
}
