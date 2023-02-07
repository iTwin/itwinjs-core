/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ConfigurableUi
 */

import { BeUiEvent } from "@itwin/core-bentley";
import { UiError } from "@itwin/appui-abstract";
import { FrontstageManager } from "../frontstage/FrontstageManager";
import { FrontstageProvider } from "../frontstage/FrontstageProvider";
import { KeyboardShortcutManager, KeyboardShortcutProps } from "../keyboardshortcut/KeyboardShortcut";
import { CubeNavigationAidControl } from "../navigationaids/CubeNavigationAidControl";
import { DrawingNavigationAidControl } from "../navigationaids/DrawingNavigationAidControl";
import { SheetNavigationAidControl } from "../navigationaids/SheetNavigationAid";
import { StandardRotationNavigationAidControl } from "../navigationaids/StandardRotationNavigationAid";
import { SyncUiEventDispatcher } from "../syncui/SyncUiEventDispatcher";
import { UiFramework } from "../UiFramework";
import { TaskManager, TaskPropsList } from "../workflow/Task";
import { WorkflowManager, WorkflowProps, WorkflowPropsList } from "../workflow/Workflow";
import { ToolSettingsManager } from "../zones/toolsettings/ToolSettingsManager";
import { ConfigurableCreateInfo, ConfigurableUiControlConstructor, ConfigurableUiElement } from "./ConfigurableUiControl";
import { ModelessDialogManager } from "../dialog/ModelessDialogManager";
import { ModalDialogManager } from "../dialog/ModalDialogManager";
import { MessageManager } from "../messages/MessageManager";
import { PopupManager } from "../popup/PopupManager";
import { ActivityTracker } from "./ActivityTracker";
import { ContentDialogManager } from "../dialog/ContentDialogManager";

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
 * @public
 */
export class ConfigurableUiManager {
  private static _registeredControls = new Map<string, ConfigurableUiControlConstructor>();
  private static _initialized = false;

  /** @internal */
  public static readonly activityTracker = new ActivityTracker();
  /** @internal */
  public static readonly onUiActivityEvent = new UiActivityEvent();
  /** @internal */
  public static readonly onUiIntervalEvent = new UiIntervalEvent();

  /** Initializes the ConfigurableUiManager and registers core controls. */
  public static initialize() {
    if (this._initialized)
      return;

    // Register core controls
    ConfigurableUiManager.registerControl(StandardRotationNavigationAidControl.navigationAidId, StandardRotationNavigationAidControl);
    ConfigurableUiManager.registerControl(SheetNavigationAidControl.navigationAidId, SheetNavigationAidControl);
    ConfigurableUiManager.registerControl(DrawingNavigationAidControl.navigationAidId, DrawingNavigationAidControl);
    ConfigurableUiManager.registerControl(CubeNavigationAidControl.navigationAidId, CubeNavigationAidControl);

    // Initialize SyncUiEventDispatcher so it can register event callbacks.
    SyncUiEventDispatcher.initialize();

    // Initialize the FrontstageManager
    FrontstageManager.initialize();

    // Initialize the ToolSettingsManager that manages Tool Settings properties.
    ToolSettingsManager.initialize();

    // Initialize dialog managers that allow one or more dialogs to be open at a time. These managers adjust the z-indexing
    // to ensure the most recently focused dialog of a specific type displays above its siblings.
    ModelessDialogManager.initialize();
    // ContentDialog have a z-index just above the fixed content views and below all other UI elements.
    ContentDialogManager.initialize();

    // Initialize the Keyboard Shortcut manager
    KeyboardShortcutManager.initialize();

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
  public static registerControl(classId: string, constructor: ConfigurableUiControlConstructor): void {
    if (this._registeredControls.get(classId) !== undefined) {
      throw new UiError(UiFramework.loggerCategory(this), `registerControl: classId '${classId}' already registered`);
    }

    this._registeredControls.set(classId, constructor);
  }

  /** Determines if a control has been registered based on its classId.
   * @param classId   the class id of the control to test
   * @returns  true if the control is registered or false if not
   */
  public static isControlRegistered(classId: string): boolean {
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
  public static unregisterControl(classId: string): void {
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
  public static createControl(classId: string, uniqueId: string, options?: any, controlId?: string): ConfigurableUiElement | undefined {
    const info = new ConfigurableCreateInfo(classId, uniqueId, controlId ?? uniqueId);
    const constructor = this._registeredControls.get(info.classId);
    if (!constructor) {
      throw new UiError(UiFramework.loggerCategory(this), `createControl: classId '${classId}' not registered`);
    }

    const control = new constructor(info, options);
    return control;
  }

  /** Add a Frontstage via a provider into the [[FrontstageManager]].
   * @param frontstageProvider  Provider of the Frontstage to add
   */
  public static addFrontstageProvider(frontstageProvider: FrontstageProvider): void {
    FrontstageManager.addFrontstageProvider(frontstageProvider);
  }

  /** Loads one or more Tasks into the [[TaskManager]].
   * @param taskPropsList  the list of Tasks to load
   * @internal
   * @deprecated in 3.0.
   */
  public static loadTasks(taskPropsList: TaskPropsList): void {   // eslint-disable-line deprecation/deprecation
    TaskManager.loadTasks(taskPropsList);   // eslint-disable-line deprecation/deprecation
  }

  /** Loads a Workflow into the [[WorkflowManager]].
   * @param workflowProps  the Workflow to load
   * @internal
   * @deprecated in 3.0.
   */
  public static loadWorkflow(workflowProps: WorkflowProps): void {    // eslint-disable-line deprecation/deprecation
    WorkflowManager.loadWorkflow(workflowProps);    // eslint-disable-line deprecation/deprecation
  }

  /** Loads one or more Workflows into the [[WorkflowManager]].
   * @param workflowPropsList  the list of Workflows to load
   * @internal
   * @deprecated in 3.0.
   */
  public static loadWorkflows(workflowPropsList: WorkflowPropsList): void {   // eslint-disable-line deprecation/deprecation
    WorkflowManager.loadWorkflows(workflowPropsList);   // eslint-disable-line deprecation/deprecation
  }

  /** Loads one or more Keyboard Shortcuts into the [[KeyboardShortcutManager]].
   * @param shortcutList  the properties of the Keyboard Shortcuts to load
   */
  public static loadKeyboardShortcuts(shortcutList: KeyboardShortcutProps[]): void {
    KeyboardShortcutManager.loadKeyboardShortcuts(shortcutList);
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
    ModelessDialogManager.closeAll();
    ModalDialogManager.closeAll();
    ContentDialogManager.closeAll();
    KeyboardShortcutManager.closeShortcutsMenu();
    UiFramework.closeCursorMenu();
    PopupManager.clearPopups();
  }

}
