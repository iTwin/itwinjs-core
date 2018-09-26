/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ConfigurableUi */

import { ItemDefBase } from "./ItemDefBase";
import { ItemPropsList } from "./ItemProps";
import { FrontstageDef, FrontstageProps } from "./FrontstageDef";
import { FrontstageManager } from "./FrontstageManager";
import { ConfigurableCreateInfo, ConfigurableUiElement } from "./ConfigurableUiControl";
import { ContentGroupManager, ContentGroupProps } from "./ContentGroup";
import { ContentLayoutManager, ContentLayoutProps } from "./ContentLayout";
import { TaskManager, TaskPropsList } from "./Task";
import { WorkflowManager, WorkflowPropsList } from "./Workflow";
import { ItemMap } from "./ItemFactory";

import { StandardRotationNavigationAidControl } from "./navigationaids/StandardRotationNavigationAid";
import { SheetNavigationAidControl } from "./navigationaids/SheetNavigationAid";
import { CubeNavigationAidControl } from "./navigationaids/CubeNavigationAid";

// -----------------------------------------------------------------------------
// Configurable Ui Manager
// -----------------------------------------------------------------------------

/** Configurable Ui Manager maintains common items, controls, Frontstages, Content Groups,
 * Content Layouts, Tasks and Workflows.
 */
export class ConfigurableUiManager {
  private static _registeredControls: { [classId: string]: new (info: ConfigurableCreateInfo, options: any) => ConfigurableUiElement } = {};

  private static _commonItemMap: ItemMap = new ItemMap();

  /** Initializes the ConfigurableUiManager and registeres core controls. */
  public static initialize() {
    // Register core controls
    ConfigurableUiManager.registerControl("StandardRotationNavigationAid", StandardRotationNavigationAidControl);
    ConfigurableUiManager.registerControl("SheetNavigationAid", SheetNavigationAidControl);
    ConfigurableUiManager.registerControl("CubeNavigationAid", CubeNavigationAidControl);
  }

  /** Loads common Group, Tool and Command items into the item map.
   * @param itemPropsList list of common items to load
   */
  public static loadCommonItems(itemPropsList: ItemPropsList): void {
    this._commonItemMap.loadItems(itemPropsList);
  }

  /** Adds a common Group, Tool and Command items into the item map.
   * @param itemPropsList list of common items to load
   */
  public static addCommonItem(itemDef: ItemDefBase): void {
    this._commonItemMap.addItem(itemDef);
  }

  /** Gets the map of common items.
   * @returns An [[ItemMap]] containing the common items
   */
  public static get commonItems(): ItemMap {
    return this._commonItemMap;
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

  /** Finds a Group, Tool or Command item by looking in the active Frontstage first then the common items.
   * @param id  the id of the item to find
   * @returns the [[ItemDefBase]] of the item with the given id, or undefined if not found
   */
  public static findItem(id: string): ItemDefBase | undefined {
    let item: ItemDefBase | undefined;

    if (FrontstageManager.activeFrontstageDef) {
      item = FrontstageManager.activeFrontstageDef.findItem(id);
    }

    if (item === undefined && this._commonItemMap)
      item = this._commonItemMap.get(id);

    return item;
  }

  /** Registers a control implementing the [[ConfigurableUiElement]] interface.
   * These controls can be a
   * [[ContentControl]],
   * [[NavigationAidControl]],
   * [[StatusBarWidgetControl]],
   * [[ToolUiProvider]] or
   * [[WidgetControl]].
   * @param classId the class id of the control to register
   * @param constructor the constructor of the control to register
   */
  public static registerControl(classId: string, constructor: new (info: ConfigurableCreateInfo, options: any) => ConfigurableUiElement): void {
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

  /** Loads one or more Frontstages into the [[FrontstageManager]].
   * @param frontstagePropsList  the list of Frontstages to load
   */
  public static loadFrontstages(frontstagePropsList: FrontstageProps[]): void {
    FrontstageManager.loadFrontstages(frontstagePropsList);
  }

  /** Loads a Frontstage into the [[FrontstageManager]].
   * @param frontstageProps  the properties of the Frontstage to load
   */
  public static loadFrontstage(frontstageProps: FrontstageProps): void {
    FrontstageManager.loadFrontstage(frontstageProps);
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
