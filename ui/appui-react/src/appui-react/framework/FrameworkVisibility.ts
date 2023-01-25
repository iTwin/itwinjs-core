/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/**
 * [[UiFramework.visibility]] interface
 * @beta
 */
export interface FrameworkVisibility {
  /** Determines if the Ui is visible */
  isUiVisible: boolean;

  /** @internal */
  setAutoHideUi(value: boolean): void;

  /** @internal */
  setUseProximityOpacity(value: boolean): void;

  /** @internal */
  setSnapWidgetOpacity(value: boolean): void;

  /** Determines whether the `auto-hide Ui` feature is on. Defaults to false.
   * When true, the Ui automatically hides after a few seconds of inactivity.
   */
  autoHideUi: boolean;

  /** Determines whether the widget panels are shown and hidden. Defaults to false. */
  showHidePanels: boolean;

  /** Determines whether the status bar is shown and hidden. Defaults to false. */
  showHideFooter: boolean;

  /** Determines the amount of inactivity time before the Ui is hidden. Defaults to 3.5 seconds. */
  inactivityTime: number;

  /** Determines whether the proximity of the mouse should alter the opacity of a toolbar. Defaults to true. */
  useProximityOpacity: boolean;

  /** Determines whether the opacity of a toolbar should snap. Defaults to false. */
  snapWidgetOpacity: boolean;

  /** Handler for when a Frontstage is ready */
  handleFrontstageReady(): void;

  /** Handler for when the mouse moves over the content area */
  handleContentMouseMove(_event?: React.MouseEvent<HTMLElement, MouseEvent>): void;

  /** Handler for when the mouse enters a widget */
  handleWidgetMouseEnter(_event?: React.MouseEvent<HTMLElement, MouseEvent>): void;

  /** Shows the Ui and resets the inactivity timer */
  showUiAndResetTimer(): void;

  /** Shows the Ui and cancels the inactivity timer */
  showUiAndCancelTimer(): void;

  /** @internal */
  terminate(): void;
}
