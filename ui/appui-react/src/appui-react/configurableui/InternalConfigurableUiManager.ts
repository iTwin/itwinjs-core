/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ConfigurableUi
 */

import { UiError } from "@itwin/appui-abstract";
import { CubeNavigationAidControl } from "../navigationaids/CubeNavigationAidControl";
import { DrawingNavigationAidControl } from "../navigationaids/DrawingNavigationAidControl";
import { SheetNavigationAidControl } from "../navigationaids/SheetNavigationAid";
import { StandardRotationNavigationAidControl } from "../navigationaids/StandardRotationNavigationAid";
import { UiFramework } from "../UiFramework";
import { ConfigurableCreateInfo, ConfigurableUiControlConstructor, ConfigurableUiElement } from "./ConfigurableUiControl";
import { MessageManager } from "../messages/MessageManager";
import { PopupManager } from "../popup/PopupManager";
import { ActivityTracker } from "./ActivityTracker";
import { BeUiEvent } from "@itwin/core-bentley";
import { InternalSyncUiEventDispatcher } from "../syncui/InternalSyncUiEventDispatcher";
import { InternalFrontstageManager } from "../frontstage/InternalFrontstageManager";
import { InternalToolSettingsManager } from "../zones/toolsettings/InternalToolSettingsManager";
import { InternalModelessDialogManager } from "../dialog/InternalModelessDialogManager";
import { InternalContentDialogManager } from "../dialog/InternalContentDialogManager";
import { InternalKeyboardShortcutManager } from "../keyboardshortcut/InternalKeyboardShortcut";
import { InternalModalDialogManager } from "../dialog/InternalModalDialogManager";

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

/** Configurable Ui Manager maintains controls, Frontstages, Content Groups, Content Layouts, Tasks and Workflows.
 * @internal
 */
export class InternalConfigurableUiManager {
  private static _registeredControls = new Map<string, ConfigurableUiControlConstructor>();
  private static _initialized = false;

  /** @internal */
  public static readonly activityTracker = new ActivityTracker();
  /** @internal */
  public static readonly onUiActivityEvent = new UiActivityEvent();
  /** @internal */
  public static readonly onUiIntervalEvent = new UiIntervalEvent();

  /** Initializes the InternalConfigurableUiManager and registers core controls.
   * @internal
  */
  public static initialize() {
    if (this._initialized)
      return;

    // Register core controls
    InternalConfigurableUiManager.register(StandardRotationNavigationAidControl.navigationAidId, StandardRotationNavigationAidControl);
    InternalConfigurableUiManager.register(SheetNavigationAidControl.navigationAidId, SheetNavigationAidControl);
    InternalConfigurableUiManager.register(DrawingNavigationAidControl.navigationAidId, DrawingNavigationAidControl);
    InternalConfigurableUiManager.register(CubeNavigationAidControl.navigationAidId, CubeNavigationAidControl);

    // Initialize SyncUiEventDispatcher so it can register event callbacks.
    InternalSyncUiEventDispatcher.initialize();

    // Initialize the FrontstageManager
    InternalFrontstageManager.initialize();

    // Initialize the ToolSettingsManager that manages Tool Settings properties.
    InternalToolSettingsManager.initialize();

    // Initialize dialog managers that allow one or more dialogs to be open at a time. These managers adjust the z-indexing
    // to ensure the most recently focused dialog of a specific type displays above its siblings.
    InternalModelessDialogManager.initialize();

    // ContentDialog have a z-index just above the fixed content views and below all other UI elements.
    InternalContentDialogManager.initialize();

    // Initialize the Keyboard Shortcut manager
    InternalKeyboardShortcutManager.initialize();

    this._initialized = true;
  }

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
  public static register(classId: string, constructor: ConfigurableUiControlConstructor): void {
    if (this._registeredControls.get(classId) !== undefined) {
      throw new UiError(UiFramework.loggerCategory(this), `registerControl: classId '${classId}' already registered`);
    }

    this._registeredControls.set(classId, constructor);
  }

  /** Determines if a control has been registered based on its classId.
   * @param classId   the class id of the control to test
   * @returns  true if the control is registered or false if not
   */
  public static isRegistered(classId: string): boolean {
    const constructor = this._registeredControls.get(classId);
    return constructor !== undefined;
  }

  /** Determines if a control has been registered.
   * @internal
   */
  public static getConstructorClassId(constructor: ConfigurableUiControlConstructor): string | undefined {
    for (const [key, value] of this._registeredControls.entries()) {
      if (value === constructor)
        return key;
    }

    return undefined;
  }

  /** Unregisters a control that has been registered.
   * @param classId   the class id of the control to unregister
   */
  public static unregister(classId: string): void {
    const constructor = this._registeredControls.get(classId);
    if (constructor)
      this._registeredControls.delete(classId);
  }

  /** Creates a control registered by calling registerControl.
   * @param classId   the class id of the control to create
   * @param uniqueId  a unique id for the control
   * @param options   options passed to the constructor of the control
   * @param controlId controlId which may not be unique across all control instances.
   * @returns  the created control
   */
  public static create(classId: string, uniqueId: string, options?: any, controlId?: string): ConfigurableUiElement | undefined {
    const info = new ConfigurableCreateInfo(classId, uniqueId, controlId ?? uniqueId);
    const constructor = this._registeredControls.get(info.classId);
    if (!constructor) {
      throw new UiError(UiFramework.loggerCategory(this), `createControl: classId '${classId}' not registered`);
    }

    const control = new constructor(info, options);
    return control;
  }

  /** Gets the HTML wrapper element for Configurable UI */
  public static getWrapperElement(): HTMLElement {
    const wrapper = document.getElementById("uifw-configurableui-wrapper");
    const htmlElement = wrapper!;
    return htmlElement;
  }

  /** Closes all UI popups currently open */
  public static closeUi(): void {
    MessageManager.closeAllMessages();
    InternalModelessDialogManager.closeAll();
    InternalModalDialogManager.closeAll();
    InternalContentDialogManager.closeAll();
    UiFramework.keyboardShortcuts.closeMenu();
    UiFramework.closeCursorMenu();
    PopupManager.clearPopups();
  }
}
