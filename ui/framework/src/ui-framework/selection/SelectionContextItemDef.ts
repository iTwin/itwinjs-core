/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Tools */

import { IModelApp } from "@bentley/imodeljs-frontend";
import { BaseItemState } from "@bentley/ui-abstract";
import { SelectionContextUtilities } from "./SelectionContextUtilities";
import { CommandItemDef } from "../shared/CommandItemDef";
import { GroupItemDef } from "../toolbar/GroupItem";
import { SyncUiEventId } from "../syncui/SyncUiEventDispatcher";
import { ContentViewManager } from "../content/ContentViewManager";
import { SessionStateActionId } from "../redux/SessionState";
import { UiFramework } from "../UiFramework";

/** return SyncEventIds that trigger selection state function refresh.
 * @beta
 */
// istanbul ignore next
export function getSelectionContextSyncEventIds(): string[] {
  return [SyncUiEventId.SelectionSetChanged, SyncUiEventId.ActiveContentChanged, SyncUiEventId.ActiveViewportChanged,
    SessionStateActionId.SetNumItemsSelected];
}

/** return state with isVisible set to true is SectionSet is active.
 * @beta
 */
// istanbul ignore next
export function selectionContextStateFunc(state: Readonly<BaseItemState>): BaseItemState {
  const activeContentControl = ContentViewManager.getActiveContentControl();
  let isVisible = false;

  let selectionCount = 0;
  if (!UiFramework.frameworkStateKey)
    selectionCount = UiFramework.store.getState()[UiFramework.frameworkStateKey].frameworkState.sessionState.numItemsSelected;

  if (activeContentControl && activeContentControl.viewport && (activeContentControl.viewport.view.iModel.selectionSet.size > 0 || selectionCount > 0))
    isVisible = true;
  return { ...state, isVisible };
}

/** Utility Class that provides definitions for tools dependent on current selection. These definitions can be used to populate toolbars.
 * @beta
 */
// istanbul ignore next
export class SelectionContextToolDefinitions {

  public static get isolateModelsInSelectionItemDef() {
    return new CommandItemDef({
      commandId: "UiFramework.IsolateModel",
      iconSpec: "icon-model-isolate",
      labelKey: "UiFramework:tools.isolateModels",
      execute: async () => {
        const vp = IModelApp.viewManager.selectedView;
        if (!vp)
          return;

        await SelectionContextUtilities.isolateSelectedElementsModel(vp);
      },
    });
  }

  public static get isolateCategoriesInSelectionItemDef() {
    return new CommandItemDef({
      commandId: "UiFramework.IsolateCategory",
      iconSpec: "icon-layers-isolate",
      labelKey: "UiFramework:tools.isolateCategories",
      execute: async () => {
        const vp = IModelApp.viewManager.selectedView;
        if (!vp)
          return;

        await SelectionContextUtilities.isolateSelectedElementsCategory(vp);
      },
    });
  }

  public static get isolateElementsItemDef() {
    return new CommandItemDef({
      commandId: "UiFramework.IsolateSelected",
      iconSpec: "icon-asset-isolate",
      labelKey: "UiFramework:tools.isolateSelected",
      stateSyncIds: getSelectionContextSyncEventIds(),
      stateFunc: selectionContextStateFunc,
      execute: () => {
        const vp = IModelApp.viewManager.selectedView;
        if (!vp)
          return;
        SelectionContextUtilities.isolateSelected(vp);
      },
    });
  }

  public static get isolateSelectionToolGroup() {
    return new GroupItemDef({
      groupId: "UiFramework.IsolateSelectionGroup",
      labelKey: "UiFramework:tools.isolate",
      iconSpec: "icon-isolate",
      stateSyncIds: getSelectionContextSyncEventIds(),
      stateFunc: selectionContextStateFunc,
      items: [this.isolateElementsItemDef, this.isolateCategoriesInSelectionItemDef, this.isolateModelsInSelectionItemDef],
      itemsInColumn: 3,
    });
  }

  public static get hideModelsInSelectionItemDef() {
    return new CommandItemDef({
      commandId: "UiFramework.HideModel",
      iconSpec: "icon-model-hide",
      labelKey: "UiFramework:tools.hideModels",
      execute: async () => {
        const vp = IModelApp.viewManager.selectedView;
        if (!vp)
          return;

        await SelectionContextUtilities.hideSelectedElementsModel(vp);
      },
    });
  }

  public static get hideCategoriesInSelectionItemDef() {
    return new CommandItemDef({
      commandId: "UiFramework.HideCategory",
      iconSpec: "icon-layers-hide",
      labelKey: "UiFramework:tools.hideCategories",
      execute: async () => {
        const vp = IModelApp.viewManager.selectedView;
        if (!vp)
          return;

        await SelectionContextUtilities.hideSelectedElementsCategory(vp);
      },
    });
  }

  public static get hideElementsItemDef() {
    return new CommandItemDef({
      commandId: "UiFramework.HideSelected",
      iconSpec: "icon-asset-classification-hide",
      labelKey: "UiFramework:tools.hideSelected",
      stateSyncIds: getSelectionContextSyncEventIds(),
      stateFunc: selectionContextStateFunc,
      execute: () => {
        const vp = IModelApp.viewManager.selectedView;
        if (!vp)
          return;

        SelectionContextUtilities.hideSelected(vp);
      },
    });
  }

  public static get hideSectionToolGroup() {
    return new GroupItemDef({
      groupId: "UiFramework.HideSelectionGroup",
      labelKey: "UiFramework:tools.hide",
      iconSpec: "icon-visibility-hide-2",
      stateSyncIds: getSelectionContextSyncEventIds(),
      stateFunc: selectionContextStateFunc,
      items: [this.hideElementsItemDef, this.hideCategoriesInSelectionItemDef, this.hideModelsInSelectionItemDef],
      itemsInColumn: 3,
    });
  }

  public static get emphasizeElementsItemDef() {
    return new CommandItemDef({
      commandId: "UiFramework.EmphasizeSelected",
      iconSpec: "icon-visibility-semi-transparent",
      labelKey: "UiFramework:tools.emphasizeSelected",
      stateSyncIds: getSelectionContextSyncEventIds(),
      stateFunc: selectionContextStateFunc,
      execute: async () => {
        const vp = IModelApp.viewManager.selectedView;
        if (!vp)
          return;

        await SelectionContextUtilities.emphasizeSelected(vp);
      },
    });
  }

}
