/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import { UiStateStorage, UiStateStorageStatus } from "@itwin/core-react";
import { SyncUiEventId } from "../framework/FrameworkEvents";
import { UiFramework, UserSettingsProvider } from "../UiFramework";

/** Class that maintain UiShowHide user settings between sessions
 * @internal
 */
export class UiShowHideSettingsProvider implements UserSettingsProvider {
  private static _settingsNamespace = "AppUiSettings";
  private static _autoHideUiKey = "AutoHideUi";
  private static _useProximityOpacityKey = "UseProximityOpacity";
  private static _snapWidgetOpacityKey = "SnapWidgetOpacity";
  public readonly providerId = "UiShowHideSettingsProvider";

  public static initialize() {
    UiFramework.registerUserSettingsProvider(new UiShowHideSettingsProvider());
  }

  public async loadUserSettings(storage: UiStateStorage): Promise<void> {
    let result = await storage.getSetting(UiShowHideSettingsProvider._settingsNamespace, UiShowHideSettingsProvider._autoHideUiKey);
    if (result.status === UiStateStorageStatus.Success)
      UiFramework.visibility.setAutoHideUi(result.setting);

    result = await storage.getSetting(UiShowHideSettingsProvider._settingsNamespace, UiShowHideSettingsProvider._useProximityOpacityKey);
    if (result.status === UiStateStorageStatus.Success)
      UiFramework.visibility.setUseProximityOpacity(result.setting);

    result = await storage.getSetting(UiShowHideSettingsProvider._settingsNamespace, UiShowHideSettingsProvider._snapWidgetOpacityKey);
    if (result.status === UiStateStorageStatus.Success)
      UiFramework.visibility.setSnapWidgetOpacity(result.setting);
  }

  public static async storeAutoHideUi(v: boolean, storage?: UiStateStorage) {
    void (storage ?? UiFramework.getUiStateStorage()).saveSetting(this._settingsNamespace, this._autoHideUiKey, v);
  }

  public static async storeUseProximityOpacity(v: boolean, storage?: UiStateStorage) {
    void (storage ?? UiFramework.getUiStateStorage()).saveSetting(this._settingsNamespace, this._useProximityOpacityKey, v);
  }

  public static async storeSnapWidgetOpacity(v: boolean, storage?: UiStateStorage) {
    void (storage ?? UiFramework.getUiStateStorage()).saveSetting(this._settingsNamespace, this._snapWidgetOpacityKey, v);
  }
}

/** The default inactivity time.
 * @internal
 */
export const INACTIVITY_TIME_DEFAULT = 3500;  /** Wait 3.5 seconds */

/** Maintains Ui Show/Hide state. The `Ui` includes widgets, panels and the status bar.
 * @internal
 */
export class InternalUiShowHideManager {
  private static _isUiVisible: boolean = true;
  private static _autoHideUi: boolean = true;
  private static _showHidePanels: boolean = false;
  private static _showHideFooter: boolean = false;
  private static _inactivityTime: number = INACTIVITY_TIME_DEFAULT;
  private static _timeout: NodeJS.Timeout;
  private static _useProximityOpacity: boolean = false;
  private static _snapWidgetOpacity: boolean = false;

  /** Determines if the Ui is visible */
  public static get isUiVisible() {
    return InternalUiShowHideManager._isUiVisible;
  }
  public static set isUiVisible(visible: boolean) {
    InternalUiShowHideManager._isUiVisible = visible;
  }

  /** @internal */
  public static setAutoHideUi(value: boolean) {
    InternalUiShowHideManager._autoHideUi = value;
  }

  /** @internal */
  public static setUseProximityOpacity(value: boolean) {
    InternalUiShowHideManager._useProximityOpacity = value;
  }

  /** @internal */
  public static setSnapWidgetOpacity(value: boolean) {
    InternalUiShowHideManager._snapWidgetOpacity = value;
  }

  /** Determines whether the `auto-hide Ui` feature is on. Defaults to false.
   * When true, the Ui automatically hides after a few seconds of inactivity.
   */
  public static get autoHideUi(): boolean {
    return InternalUiShowHideManager._autoHideUi;
  }

  public static set autoHideUi(autoHide: boolean) {
    void UiShowHideSettingsProvider.storeAutoHideUi(autoHide);
    InternalUiShowHideManager._autoHideUi = autoHide;
    UiFramework.events.dispatchImmediateSyncUiEvent(SyncUiEventId.ShowHideManagerSettingChange);
  }
  /** Determines whether the widget panels are shown and hidden. Defaults to false. */
  public static get showHidePanels(): boolean {
    return InternalUiShowHideManager._showHidePanels;
  }
  public static set showHidePanels(showHide: boolean) {
    InternalUiShowHideManager._showHidePanels = showHide;
    UiFramework.onUiVisibilityChanged.emit({ visible: UiFramework.getIsUiVisible() });
  }

  /** Determines whether the status bar is shown and hidden. Defaults to false. */
  public static get showHideFooter(): boolean {
    return InternalUiShowHideManager._showHideFooter;
  }
  public static set showHideFooter(showHide: boolean) {
    InternalUiShowHideManager._showHideFooter = showHide;
    UiFramework.onUiVisibilityChanged.emit({ visible: UiFramework.getIsUiVisible() });
  }

  /** Determines the amount of inactivity time before the Ui is hidden. Defaults to 3.5 seconds. */
  public static get inactivityTime(): number {
    return InternalUiShowHideManager._inactivityTime;
  }
  public static set inactivityTime(time: number) {
    InternalUiShowHideManager._inactivityTime = time;
  }

  /** Determines whether the proximity of the mouse should alter the opacity of a toolbar. Defaults to true. */
  public static get useProximityOpacity(): boolean {
    return InternalUiShowHideManager._useProximityOpacity;
  }
  public static set useProximityOpacity(value: boolean) {
    InternalUiShowHideManager._useProximityOpacity = value;
    void UiShowHideSettingsProvider.storeUseProximityOpacity(value);
    UiFramework.events.dispatchImmediateSyncUiEvent(SyncUiEventId.ShowHideManagerSettingChange);
    UiFramework.onUiVisibilityChanged.emit({ visible: UiFramework.getIsUiVisible() });
  }

  /** Determines whether the opacity of a toolbar should snap. Defaults to false. */
  public static get snapWidgetOpacity(): boolean {
    return InternalUiShowHideManager._snapWidgetOpacity;
  }
  public static set snapWidgetOpacity(value: boolean) {
    InternalUiShowHideManager._snapWidgetOpacity = value;
    void UiShowHideSettingsProvider.storeSnapWidgetOpacity(value);
    UiFramework.events.dispatchImmediateSyncUiEvent(SyncUiEventId.ShowHideManagerSettingChange);
    UiFramework.onUiVisibilityChanged.emit({ visible: UiFramework.getIsUiVisible() });
  }

  /** Handler for when a Frontstage is ready */
  public static handleFrontstageReady() {
    // istanbul ignore next
    if (!InternalUiShowHideManager._autoHideUi)
      return;

    InternalUiShowHideManager.showUiAndResetTimer();
  }

  /** Handler for when the mouse moves over the content area */
  public static handleContentMouseMove(_event?: React.MouseEvent<HTMLElement, MouseEvent>) {
    if (!InternalUiShowHideManager._autoHideUi)
      return;

    InternalUiShowHideManager.showUiAndResetTimer();
  }

  /** Handler for when the mouse enters a widget */
  public static handleWidgetMouseEnter(_event?: React.MouseEvent<HTMLElement, MouseEvent>) {
    if (!InternalUiShowHideManager._autoHideUi)
      return;

    InternalUiShowHideManager.showUiAndCancelTimer();
  }

  /** Shows the Ui and resets the inactivity timer */
  public static showUiAndResetTimer() {
    setTimeout(() => {
      InternalUiShowHideManager.showUi();
      InternalUiShowHideManager.resetTimer();
    });
  }

  /** Shows the Ui and cancels the inactivity timer */
  public static showUiAndCancelTimer() {
    setTimeout(() => {
      InternalUiShowHideManager.showUi();
      InternalUiShowHideManager.cancelTimer();
    });
  }

  private static cancelTimer() {
    clearTimeout(InternalUiShowHideManager._timeout);
  }

  private static resetTimer() {
    InternalUiShowHideManager.cancelTimer();
    InternalUiShowHideManager._timeout = setTimeout(InternalUiShowHideManager.hideUi, InternalUiShowHideManager._inactivityTime);
  }

  private static showUi() {
    UiFramework.setIsUiVisible(true);
  }

  private static hideUi() {
    UiFramework.setIsUiVisible(false);
  }

  /** @internal */
  public static terminate() {
    InternalUiShowHideManager.cancelTimer();
    // Ensure that next use will have default values for tests.
    InternalUiShowHideManager._isUiVisible = true;
    InternalUiShowHideManager._autoHideUi = true;
    InternalUiShowHideManager._showHidePanels = false;
    InternalUiShowHideManager._showHideFooter = false;
    InternalUiShowHideManager._inactivityTime = INACTIVITY_TIME_DEFAULT;
    InternalUiShowHideManager._useProximityOpacity = false;
    InternalUiShowHideManager._snapWidgetOpacity = false;
  }
}
