/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utilities */

import { UiFramework } from "../UiFramework";

/** The default inactivity time.
 * @internal
 */
export const INACTIVITY_TIME_DEFAULT = 3500;  /** Wait 3.5 seconds */

/** Maintains Ui Show/Hide state
 * @alpha
 */
export class UiShowHideManager {
  private static _isUiVisible: boolean = true;
  private static _autoHideUi: boolean = false;
  private static _showHidePanels: boolean = false;
  private static _showHideFooter: boolean = false;
  private static _inactivityTime: number = INACTIVITY_TIME_DEFAULT;
  private static _timeout: NodeJS.Timeout;

  public static get isUiVisible() {
    return UiShowHideManager._isUiVisible;
  }

  public static set isUiVisible(visible: boolean) {
    UiShowHideManager._isUiVisible = visible;
  }

  public static get autoHideUi() {
    return UiShowHideManager._autoHideUi;
  }

  public static set autoHideUi(autoHide: boolean) {
    UiShowHideManager._autoHideUi = autoHide;
  }

  public static get showHidePanels(): boolean {
    return UiShowHideManager._showHidePanels;
  }

  public static set showHidePanels(showHide: boolean) {
    UiShowHideManager._showHidePanels = showHide;
    UiFramework.onUiVisibilityChanged.emit({ visible: UiFramework.getIsUiVisible() });
  }

  public static get showHideFooter(): boolean {
    return UiShowHideManager._showHideFooter;
  }

  public static set showHideFooter(showHide: boolean) {
    UiShowHideManager._showHideFooter = showHide;
    UiFramework.onUiVisibilityChanged.emit({ visible: UiFramework.getIsUiVisible() });
  }

  public static get inactivityTime(): number {
    return UiShowHideManager._inactivityTime;
  }

  public static set inactivityTime(time: number) {
    UiShowHideManager._inactivityTime = time;
  }

  public static handleFrontstageReady() {
    if (!UiShowHideManager._autoHideUi)
      return;

    UiShowHideManager.showUiAndResetTimer();
  }

  public static handleContentMouseMove(_event?: React.MouseEvent<HTMLElement, MouseEvent>) {
    if (!UiShowHideManager._autoHideUi)
      return;

    UiShowHideManager.showUiAndResetTimer();
  }

  public static handleWidgetMouseEnter(_event?: React.MouseEvent<HTMLElement, MouseEvent>) {
    if (!UiShowHideManager._autoHideUi)
      return;

    UiShowHideManager.showUiAndCancelTimer();
  }

  private static showUiAndResetTimer() {
    setTimeout(() => {
      UiShowHideManager.showUi();
      UiShowHideManager.resetTimer();
    });
  }

  private static showUiAndCancelTimer() {
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
