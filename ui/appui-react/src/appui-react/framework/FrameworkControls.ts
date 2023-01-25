/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BeUiEvent } from "@itwin/core-bentley";
import { ActivityTracker } from "../configurableui/ActivityTracker";
import { ConfigurableUiControlConstructor, ConfigurableUiElement } from "../configurableui/ConfigurableUiControl";

/** Ui Activity Event Args interface.
 * @internal
 */
export interface UiActivityEventArgs {
  event: Event;
}

/** Ui Activity Event class.
 * @internal
 */
export class UiActivityEvent extends BeUiEvent<UiActivityEventArgs> { }

/** Ui Interval Event Args interface
 * @internal
 */
export interface UiIntervalEventArgs {
  idleTimeout?: number;
}

/** Ui Interval Event class.
 * @internal
 */
export class UiIntervalEvent extends BeUiEvent<UiIntervalEventArgs> { }

/**
 * [[UiFramework.controls]] interface
 * @beta
 */
export interface FrameworkControls {
  /** @internal */
  readonly activityTracker: ActivityTracker;
  /** @internal */
  readonly onUiActivityEvent: UiActivityEvent;
  /** @internal */
  readonly onUiIntervalEvent: UiIntervalEvent;

  /** Initializes the InternalConfigurableUiManager and registers core controls.
   * @internal
  */
  initialize(): void;

  /** Registers a control implementing the [[ConfigurableUiElement]] interface.
   * These controls can be a
   * [[ContentControl]],
   * [[NavigationAidControl]],
   * [[StatusBarWidgetControl]],
   * [[WidgetControl]] or
   * [[ToolUiProvider]].
   * @param classId the class id of the control to register
   * @param constructor the constructor of the control to register
   */
  register(classId: string, constructor: ConfigurableUiControlConstructor): void;

  /** Determines if a control has been registered based on its classId.
   * @param classId   the class id of the control to test
   * @returns  true if the control is registered or false if not
   */
  isRegistered(classId: string): boolean;

  /** Determines if a control has been registered.
   * @internal
   */
  getConstructorClassId(constructor: ConfigurableUiControlConstructor): string | undefined;

  /** Unregisters a control that has been registered.
   * @param classId   the class id of the control to unregister
   */
  unregister(classId: string): void;

  /** Creates a control registered by calling registerControl.
   * @param classId   the class id of the control to create
   * @param uniqueId  a unique id for the control
   * @param options   options passed to the constructor of the control
   * @param controlId controlId which may not be unique across all control instances.
   * @returns  the created control
   */
  create(classId: string, uniqueId: string, options?: any, controlId?: string): ConfigurableUiElement | undefined;

  /** Gets the HTML wrapper element for Configurable UI */
  getWrapperElement(): HTMLElement;

  /** Closes all UI popups currently open */
  closeUi(): void;

}
