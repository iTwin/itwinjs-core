/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import { SyncUiEventDispatcher, SyncUiEventId } from "../syncui/SyncUiEventDispatcher";
import { UiFramework } from "../UiFramework";

/** The default inactivity time.
 * @internal
 */
export const INACTIVITY_TIME_DEFAULT = 3500;  /** Wait 3.5 seconds */

/** Maintains Ui Show/Hide state. The `Ui` includes widgets, panels and the status bar.
 * @public
 */
export class UiShowHideManager {
  private static _isUiVisible: boolean = true;
  private static _autoHideUi: boolean = false;
  private static _showHidePanels: boolean = false;
  private static _showHideFooter: boolean = false;
  private static _inactivityTime: number = INACTIVITY_TIME_DEFAULT;
  private static _timeout: NodeJS.Timeout;
  private static _useProximityOpacity: boolean = true;
  private static _snapWidgetOpacity: boolean = false;

  /** Determines if the Ui is visible */
  public static get isUiVisible() {
    return UiShowHideManager._isUiVisible;
  }
  public static set isUiVisible(visible: boolean) {
    UiShowHideManager._isUiVisible = visible;
  }

  /** Determines whether the `auto-hide Ui` feature is on. Defaults to false.
   * When true, the Ui automatically hides after a few seconds of inactivity.
   */
  public static get autoHideUi(): boolean {
    return UiShowHideManager._autoHideUi;
  }
  public static set autoHideUi(autoHide: boolean) {
    SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(SyncUiEventId.ShowHideManagerSettingChange);
    UiShowHideManager._autoHideUi = autoHide;
  }

  /** Determines whether the widget panels are shown and hidden. Defaults to false. */
  public static get showHidePanels(): boolean {
    return UiShowHideManager._showHidePanels;
  }
  public static set showHidePanels(showHide: boolean) {
    UiShowHideManager._showHidePanels = showHide;
    UiFramework.onUiVisibilityChanged.emit({ visible: UiFramework.getIsUiVisible() });
  }

  /** Determines whether the status bar is shown and hidden. Defaults to false. */
  public static get showHideFooter(): boolean {
    return UiShowHideManager._showHideFooter;
  }
  public static set showHideFooter(showHide: boolean) {
    UiShowHideManager._showHideFooter = showHide;
    UiFramework.onUiVisibilityChanged.emit({ visible: UiFramework.getIsUiVisible() });
  }

  /** Determines the amount of inactivity time before the Ui is hidden. Defaults to 3.5 seconds. */
  public static get inactivityTime(): number {
    return UiShowHideManager._inactivityTime;
  }
  public static set inactivityTime(time: number) {
    UiShowHideManager._inactivityTime = time;
  }

  /** Determines whether the proximity of the mouse should alter the opacity of a toolbar. Defaults to true. */
  public static get useProximityOpacity(): boolean {
    return UiShowHideManager._useProximityOpacity;
  }
  public static set useProximityOpacity(value: boolean) {
    UiShowHideManager._useProximityOpacity = value;
    SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(SyncUiEventId.ShowHideManagerSettingChange);
    UiFramework.onUiVisibilityChanged.emit({ visible: UiFramework.getIsUiVisible() });
  }

  /** Determines whether the opacity of a toolbar should snap. Defaults to false. */
  public static get snapWidgetOpacity(): boolean {
    return UiShowHideManager._snapWidgetOpacity;
  }
  public static set snapWidgetOpacity(value: boolean) {
    UiShowHideManager._snapWidgetOpacity = value;
    SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(SyncUiEventId.ShowHideManagerSettingChange);
    UiFramework.onUiVisibilityChanged.emit({ visible: UiFramework.getIsUiVisible() });
  }

  /** Handler for when a Frontstage is ready */
  public static handleFrontstageReady() {
    if (!UiShowHideManager._autoHideUi)
      return;

    UiShowHideManager.showUiAndResetTimer();
  }

  /** Handler for when the mouse moves over the content area */
  public static handleContentMouseMove(_event?: React.MouseEvent<HTMLElement, MouseEvent>) {
    if (!UiShowHideManager._autoHideUi)
      return;

    UiShowHideManager.showUiAndResetTimer();
  }

  /** Handler for when the mouse enters a widget */
  public static handleWidgetMouseEnter(_event?: React.MouseEvent<HTMLElement, MouseEvent>) {
    if (!UiShowHideManager._autoHideUi)
      return;

    UiShowHideManager.showUiAndCancelTimer();
  }

  /** Shows the Ui and resets the inactivity timer */
  public static showUiAndResetTimer() {
    setTimeout(() => {
      UiShowHideManager.showUi();
      UiShowHideManager.resetTimer();
    });
  }

  /** Shows the Ui and cancels the inactivity timer */
  public static showUiAndCancelTimer() {
    setTimeout(() => {
      UiShowHideManager.showUi();
      UiShowHideManager.cancelTimer();
    });
  }

  private static cancelTimer() {
    clearTimeout(UiShowHideManager._timeout);
  }

  private static resetTimer() {
    UiShowHideManager.cancelTimer();
    UiShowHideManager._timeout = setTimeout(UiShowHideManager.hideUi, UiShowHideManager._inactivityTime);
  }

  private static showUi() {
    UiFramework.setIsUiVisible(true);
  }

  private static hideUi() {
    UiFramework.setIsUiVisible(false);
  }

}
