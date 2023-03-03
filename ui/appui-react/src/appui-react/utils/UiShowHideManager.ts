/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import { InternalUiShowHideManager as internal, UiShowHideSettingsProvider } from "./InternalUiShowHideManager";
// reexporting to ensure no breaking changes in barrel exports, remove when removing deprecated.
export { UiShowHideSettingsProvider };

/** Maintains Ui Show/Hide state. The `Ui` includes widgets, panels and the status bar.
 * @public
 * @deprecated in 3.7. Use `UiFramework.visibility` property.
 */
export class UiShowHideManager {

  /** Determines if the Ui is visible */
  public static get isUiVisible() {
    return internal.isUiVisible;
  }
  public static set isUiVisible(visible: boolean) {
    internal.isUiVisible = visible;
  }

  /** @internal */
  public static setAutoHideUi(value: boolean) {
    return internal.setAutoHideUi(value);
  }

  /** @internal */
  public static setUseProximityOpacity(value: boolean) {
    return internal.setUseProximityOpacity(value);
  }

  /** @internal */
  public static setSnapWidgetOpacity(value: boolean) {
    return internal.setSnapWidgetOpacity(value);
  }

  /** Determines whether the `auto-hide Ui` feature is on. Defaults to false.
   * When true, the Ui automatically hides after a few seconds of inactivity.
   */
  public static get autoHideUi(): boolean {
    return internal.autoHideUi;
  }

  public static set autoHideUi(autoHide: boolean) {
    internal.autoHideUi = autoHide;
  }
  /** Determines whether the widget panels are shown and hidden. Defaults to false. */
  public static get showHidePanels(): boolean {
    return internal.showHidePanels;
  }
  public static set showHidePanels(showHide: boolean) {
    internal.showHidePanels = showHide;
  }

  /** Determines whether the status bar is shown and hidden. Defaults to false. */
  public static get showHideFooter(): boolean {
    return internal.showHideFooter;
  }
  public static set showHideFooter(showHide: boolean) {
    internal.showHideFooter = showHide;
  }

  /** Determines the amount of inactivity time before the Ui is hidden. Defaults to 3.5 seconds. */
  public static get inactivityTime(): number {
    return internal.inactivityTime;
  }
  public static set inactivityTime(time: number) {
    internal.inactivityTime = time;
  }

  /** Determines whether the proximity of the mouse should alter the opacity of a toolbar. Defaults to true. */
  public static get useProximityOpacity(): boolean {
    return internal.useProximityOpacity;
  }
  public static set useProximityOpacity(value: boolean) {
    internal.useProximityOpacity = value;
  }

  /** Determines whether the opacity of a toolbar should snap. Defaults to false. */
  public static get snapWidgetOpacity(): boolean {
    return internal.snapWidgetOpacity;
  }
  public static set snapWidgetOpacity(value: boolean) {
    internal.snapWidgetOpacity = value;
  }

  /** Handler for when a Frontstage is ready */
  public static handleFrontstageReady() {
    // istanbul ignore next
    return internal.handleFrontstageReady();
  }

  /** Handler for when the mouse moves over the content area */
  public static handleContentMouseMove(_event?: React.MouseEvent<HTMLElement, MouseEvent>) {
    return internal.handleContentMouseMove(_event);
  }

  /** Handler for when the mouse enters a widget */
  public static handleWidgetMouseEnter(_event?: React.MouseEvent<HTMLElement, MouseEvent>) {
    return internal.handleWidgetMouseEnter(_event);
  }

  /** Shows the Ui and resets the inactivity timer */
  public static showUiAndResetTimer() {
    return internal.showUiAndResetTimer();
  }

  /** Shows the Ui and cancels the inactivity timer */
  public static showUiAndCancelTimer() {
    return internal.showUiAndCancelTimer();
  }

  /** @internal */
  public static terminate() {
    return internal.terminate();
  }
}
