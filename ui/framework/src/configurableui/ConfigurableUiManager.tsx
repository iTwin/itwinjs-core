/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ConfigurableUi */

import { FrontstageDef } from "./FrontstageDef";
import { FrontstageManager } from "./FrontstageManager";
import { ConfigurableCreateInfo, ConfigurableUiElement, ConfigurableUiControlConstructor } from "./ConfigurableUiControl";
import { ContentGroupManager, ContentGroupProps } from "./ContentGroup";
import { ContentLayoutManager, ContentLayoutProps } from "./ContentLayout";
import { TaskManager, TaskPropsList } from "./Task";
import { WorkflowManager, WorkflowPropsList } from "./Workflow";
import { FrontstageProvider } from "./Frontstage";
import { SyncUiEventDispatcher } from "../SyncUiEventDispatcher";

import { StandardRotationNavigationAidControl } from "./navigationaids/StandardRotationNavigationAid";
import { SheetNavigationAidControl } from "./navigationaids/SheetNavigationAid";
import { CubeNavigationAidControl } from "./navigationaids/CubeNavigationAid";

// -----------------------------------------------------------------------------
// Configurable Ui Manager
// -----------------------------------------------------------------------------

/** Configurable Ui Manager maintains controls, Frontstages, Content Groups,
 * Content Layouts, Tasks and Workflows.
 */
export class ConfigurableUiManager {
  private static _registeredControls: { [classId: string]: new (info: ConfigurableCreateInfo, options: any) => ConfigurableUiElement } = {};

  /** Initializes the ConfigurableUiManager and registers core controls. */
  public static initialize() {
    // Register core controls
    ConfigurableUiManager.registerControl("StandardRotationNavigationAid", StandardRotationNavigationAidControl);
    ConfigurableUiManager.registerControl("SheetNavigationAid", SheetNavigationAidControl);
    ConfigurableUiManager.registerControl("CubeNavigationAid", CubeNavigationAidControl);

    // Initialize SyncUiEventDispatcher so it can register event callbacks.
    SyncUiEventDispatcher.initialize();

    // Initialize the FrontstageManager
    FrontstageManager.initialize();
  }

  /** Registers a control implementing the [[ConfigurableUiElement]] interface.
   * These controls can be a
   * [[ContentControl]],
   * [[NavigationAidControl]],
   * [[StatusBarWidgetControl]],
   * [[ToolUiProvider]],
   * [[WidgetControl]].
   * @param classId the class id of the control to register
   * @param constructor the constructor of the control to register
   */
  public static registerControl(classId: string, constructor: ConfigurableUiControlConstructor): void {
    if (this._registeredControls.hasOwnProperty(classId)) {
      throw Error("ConfigurableUiManager.registerControl error: classId '" + classId + "' already registered");
    }

    this._registeredControls[classId] = constructor;
  }

  /** Determines if a control has been registered based on its classId.
   * @param classId   the class id of the control to test
   * @returns  true if the control is registered or false if not
   */
  public static isControlRegistered(classId: string): boolean {
    const constructor = this._registeredControls[classId];
    return constructor !== undefined;
  }

  /** Unregisters a control that has been registered.
   * @param classId   the class id of the control to unregister
   */
  public static unregisterControl(classId: string): void {
    const constructor = this._registeredControls[classId];
    if (constructor)
      delete this._registeredControls[classId];
  }

  /** Creates a control registered by calling registerControl.
   * @param classId   the class id of the control to create
   * @param uniqueId  a unique id for the control
   * @param options   options passed to the constructor of the control
   * @returns  the created control
   */
  public static createControl(classId: string, uniqueId: string, options?: any): ConfigurableUiElement | undefined {
    const info = new ConfigurableCreateInfo(classId, uniqueId, uniqueId);
    const constructor = this._registeredControls[info.classId];
    if (!constructor) {
      throw Error("ConfigurableUiManager.createControl error: classId '" + classId + "' not registered");
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

  /** Finds a FrontstageDef, given its id.
   * @param id  the id of the FrontstageDef to find
   * @returns the FrontstageDef with the given id, or undefined if not found
   */
  public static findFrontstageDef(id?: string): FrontstageDef | undefined {
    const frontstageDef = FrontstageManager.findFrontstageDef(id);
    if (frontstageDef && frontstageDef instanceof FrontstageDef)
      return frontstageDef;
    return undefined;
  }

  /** Loads one or more ContentGroups into the [[ContentGroupManager]].
   * @param groupPropsList  the list of ContentGroups to load
   */
  public static loadContentGroups(groupPropsList: ContentGroupProps[]): void {
    ContentGroupManager.loadGroups(groupPropsList);
  }

  /** Loads a [[ContentGroup]] into the [[ContentGroupManager]].
   * @param groupProps  the properties of the ContentGroup to load
   */
  public static loadContentGroup(groupProps: ContentGroupProps): void {
    ContentGroupManager.loadGroup(groupProps);
  }

  /** Loads one or more ContentLayouts into the [[ContentLayoutManager]].
   * @param layoutPropsList  the list of ContentLayouts to load
   */
  public static loadContentLayouts(layoutPropsList: ContentLayoutProps[]): void {
    ContentLayoutManager.loadLayouts(layoutPropsList);
  }

  /** Loads a [[ContentLayout]] into the [[ContentLayoutManager]].
   * @param layoutProps  the properties of the ContentLayout to load
   */
  public static loadContentLayout(layoutProps: ContentLayoutProps): void {
    ContentLayoutManager.loadLayout(layoutProps);
  }

  /** Loads one or more Tasks into the [[TaskManager]].
   * @param taskPropsList  the list of Tasks to load
   */
  public static loadTasks(taskPropsList: TaskPropsList): void {
    TaskManager.loadTasks(taskPropsList);
  }

  /** Loads one or more Workflows into the [[WorkflowManager]].
   * @param workflowPropsList  the list of Workflows to load
   */
  public static loadWorkflows(workflowPropsList: WorkflowPropsList): void {
    WorkflowManager.loadWorkflows(workflowPropsList);
  }

}

export default ConfigurableUiManager;
