/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ConfigurableUi */

import { ItemDefBase } from "./ItemDefBase";
import { ItemPropsList } from "./ItemProps";
import { FrontstageDef, FrontstageProps } from "./FrontstageDef";
import { FrontstageManager } from "./FrontstageManager";
import { ConfigurableCreateInfo, IConfigurable } from "./ConfigurableUiControl";
import { ContentGroupManager, ContentGroupProps } from "./ContentGroup";
import { ContentLayoutManager, ContentLayoutProps } from "./ContentLayout";
import { TaskManager, TaskPropsList } from "./Task";
import { WorkflowManager, WorkflowPropsList } from "./Workflow";
import { ItemMap } from "./ItemFactory";

// import { IModelViewportControl } from "./IModelViewport";
import { StandardRotationNavigationAidControl } from "./navigationaids/StandardRotationNavigationAid";
import { SheetNavigationAidControl } from "./navigationaids/SheetNavigationAid";
import { CubeNavigationAidControl } from "./navigationaids/CubeNavigationAid";

// -----------------------------------------------------------------------------
// Configurable Ui Manager
// -----------------------------------------------------------------------------

/** Configurable Ui Manager class.
 */
export class ConfigurableUiManager {
  private static _registeredControls: { [classId: string]: new (info: ConfigurableCreateInfo, options: any) => IConfigurable } = {};

  private static _commonItemMap: ItemMap = new ItemMap();

  public static initialize() {
    // Register core controls
    // ConfigurableUiManager.registerControl("IModelViewport", IModelViewportControl);
    ConfigurableUiManager.registerControl("StandardRotationNavigationAid", StandardRotationNavigationAidControl);
    ConfigurableUiManager.registerControl("SheetNavigationAid", SheetNavigationAidControl);
    ConfigurableUiManager.registerControl("CubeNavigationAid", CubeNavigationAidControl);
  }

  // private _keyboardShortcutManager : KeyboardShortcutManager = null;

  public static loadCommonItems(itemPropsList: ItemPropsList): void {
    this._commonItemMap.loadItems(itemPropsList);
  }

  public static addCommonItem(itemDef: ItemDefBase): void {
    this._commonItemMap.addItem(itemDef);
  }

  public static get commonItems(): ItemMap {
    return this._commonItemMap;
  }

  public findFrontstageDef(id?: string): FrontstageDef | undefined {
    const frontstageDef = FrontstageManager.findFrontstageDef(id);
    if (frontstageDef && frontstageDef instanceof FrontstageDef)
      return frontstageDef;
    return undefined;
  }

  public static findItem(id: string): ItemDefBase | undefined {
    let item: ItemDefBase | undefined;

    if (FrontstageManager.activeFrontstageDef) {
      item = FrontstageManager.activeFrontstageDef.findItem(id);
    }

    if (item === undefined && this._commonItemMap)
      item = this._commonItemMap.get(id);

    return item;
  }

  public static registerControl(classId: string, constructor: new (info: ConfigurableCreateInfo, options: any) => IConfigurable): void {
    this._registeredControls[classId] = constructor;
  }

  public static createConfigurable(classId: string, uniqueId: string, options?: any): IConfigurable | undefined {
    const info = new ConfigurableCreateInfo(classId, uniqueId, uniqueId);
    const constructor = this._registeredControls[info.classId];
    if (!constructor) {
      // BeAssert (false, "The control class '" + info.ClassId + "' has not been registered");
      return undefined;
    }

    const control = new constructor(info, options);
    // LOGD("DgnClientFx.ConfigurableUi", "Created a configurable of type '" + info.ClassId + "' with unique ID '" + info.UniqueId + "'");
    return control;
  }

  public static loadFrontstages(frontstagePropsList: FrontstageProps[]) {
    FrontstageManager.loadFrontstages(frontstagePropsList);
  }

  public static loadFrontstage(frontstageProps: FrontstageProps) {
    FrontstageManager.loadFrontstage(frontstageProps);
  }

  public static loadContentGroups(groupPropsList: ContentGroupProps[]) {
    ContentGroupManager.loadContentGroups(groupPropsList);
  }

  public static loadContentGroup(groupProps: ContentGroupProps) {
    ContentGroupManager.loadGroupProps(groupProps);
  }

  public static loadContentLayouts(layoutPropsList: ContentLayoutProps[]) {
    ContentLayoutManager.loadContentLayouts(layoutPropsList);
  }

  public static loadContentLayout(layoutProps: ContentLayoutProps) {
    ContentLayoutManager.loadLayoutProps(layoutProps);
  }

  public static loadTasks(taskPropsList: TaskPropsList) {
    TaskManager.loadTasks(taskPropsList);
  }

  public static loadWorkflows(workflowPropsList: WorkflowPropsList) {
    WorkflowManager.loadWorkflows(workflowPropsList);
  }

}

export default ConfigurableUiManager;
