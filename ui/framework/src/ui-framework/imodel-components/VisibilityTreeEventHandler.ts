/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelComponents
 */

import { EMPTY } from "rxjs/internal/observable/empty";
import { from } from "rxjs/internal/observable/from";
import { map } from "rxjs/internal/operators/map";
import { mergeMap } from "rxjs/internal/operators/mergeMap";
import { IDisposable } from "@bentley/bentleyjs-core";
import { NodeKey } from "@bentley/presentation-common";
import { UnifiedSelectionTreeEventHandler, UnifiedSelectionTreeEventHandlerParams } from "@bentley/presentation-components";
import {
  CheckBoxInfo, CheckboxStateChange, TreeCheckboxStateChangeEventArgs, TreeModelChanges, TreeModelNode, TreeNodeItem,
  TreeSelectionModificationEventArgs, TreeSelectionReplacementEventArgs,
} from "@bentley/ui-components";
import { CheckBoxState, isPromiseLike } from "@bentley/ui-core";

/**
 * Describes instance visibility state.
 * @alpha
 */
export enum VisibilityState {
  Visible,
  PartiallyVisible,
  Hidden
}

/**
 * Data structure that describes instance visibility status.
 * @alpha
 */
export interface VisibilityStatus {
  state: VisibilityState;
  isDisabled?: boolean;
  tooltip?: string;
}

/**
 * Visibility handler used to change or get visibility of instances represented by the tree node.
 * @alpha
 */
export interface IVisibilityHandler extends IDisposable {
  getVisibilityStatus(node: TreeNodeItem, nodeKey: NodeKey): VisibilityStatus | Promise<VisibilityStatus>;
  changeVisibility(node: TreeNodeItem, nodeKey: NodeKey, shouldDisplay: boolean): Promise<void>;
  onVisibilityChange?: () => void;
}

/**
 * Type definition of predicate used to decide if node can be selected
 * @alpha
 */
export type VisibilityTreeSelectionPredicate = (key: NodeKey, node: TreeNodeItem) => boolean;

/**
 * Parameters for [[VisibilityTreeEventHandler]]
 * @alpha
 */
export interface VisibilityTreeEventHandlerParams extends UnifiedSelectionTreeEventHandlerParams {
  visibilityHandler: IVisibilityHandler | undefined;
  selectionPredicate?: VisibilityTreeSelectionPredicate;
}

/**
 * Base event handler for visibility tree.
 * @alpha
 */
export class VisibilityTreeEventHandler extends UnifiedSelectionTreeEventHandler {
  private _visibilityHandler: IVisibilityHandler | undefined;
  private _selectionPredicate?: VisibilityTreeSelectionPredicate;
  private _removeListener: () => void;

  constructor(params: VisibilityTreeEventHandlerParams) {
    super(params);
    this._visibilityHandler = params.visibilityHandler;
    this._selectionPredicate = params.selectionPredicate;

    if (this._visibilityHandler) {
      this._visibilityHandler.onVisibilityChange = async () => this.updateCheckboxes();
    }

    this._removeListener = this.modelSource.onModelChanged.addListener(async (args) => this.updateCheckboxes(args[1]));
    this.updateCheckboxes(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }

  public dispose() {
    super.dispose();
    this._removeListener();
  }

  private filterSelectionItems(items: TreeNodeItem[]) {
    // istanbul ignore if
    if (!this._selectionPredicate)
      return items;

    return items.filter((item) => this._selectionPredicate!(this.getNodeKey(item), item));
  }

  public onSelectionModified({ modifications }: TreeSelectionModificationEventArgs) {
    const filteredModification = from(modifications).pipe(
      map(({ selectedNodeItems, deselectedNodeItems }) => {
        return {
          selectedNodeItems: this.filterSelectionItems(selectedNodeItems),
          deselectedNodeItems: this.filterSelectionItems(deselectedNodeItems),
        };
      }),
    );
    return super.onSelectionModified({ modifications: filteredModification });
  }

  public onSelectionReplaced({ replacements }: TreeSelectionReplacementEventArgs) {
    const filteredReplacements = from(replacements).pipe(
      map(({ selectedNodeItems }) => {
        return {
          selectedNodeItems: this.filterSelectionItems(selectedNodeItems),
        };
      }),
    );
    return super.onSelectionReplaced({ replacements: filteredReplacements });
  }

  public onCheckboxStateChanged(event: TreeCheckboxStateChangeEventArgs) {
    // istanbul ignore if
    if (!this._visibilityHandler)
      return undefined;

    from(event.stateChanges)
      .pipe(
        mergeMap((changes) => this.changeVisibility(changes)),
      )
      .subscribe();
    return undefined;
  }

  private changeVisibility(changes: CheckboxStateChange[]) {
    return from(changes)
      .pipe(
        mergeMap(({ nodeItem, newState }) => {
          // istanbul ignore if
          if (!this._visibilityHandler)
            return EMPTY;
          return from(this._visibilityHandler.changeVisibility(nodeItem, this.getNodeKey(nodeItem), newState === CheckBoxState.On));
        }),
      );
  }

  private async updateCheckboxes(modelChanges?: TreeModelChanges) {
    const changes = await (modelChanges ? this.collectAffectedNodesCheckboxInfos(modelChanges) : this.collectAllNodesCheckboxInfos());
    this.updateModel(changes);
  }

  private updateModel(changes: Map<string, CheckBoxInfo>) {
    this.modelSource.modifyModel((model) => {
      for (const [nodeId, checkboxInfo] of changes) {
        const node = model.getNode(nodeId);
        // istanbul ignore if
        if (!node)
          continue;

        node.checkbox.isDisabled = checkboxInfo.isDisabled;
        node.checkbox.isVisible = checkboxInfo.isVisible;
        node.checkbox.state = checkboxInfo.state;
        node.checkbox.tooltip = checkboxInfo.tooltip;
      }
    });
  }

  private async collectAffectedNodesCheckboxInfos(modelChanges: TreeModelChanges) {
    const nodeStates = new Map<string, CheckBoxInfo>();
    const affectedNodeIds = [...modelChanges.addedNodeIds, ...modelChanges.modifiedNodeIds];
    if (affectedNodeIds.length === 0)
      return nodeStates;

    for (const nodeId of affectedNodeIds) {
      const node = this.modelSource.getModel().getNode(nodeId);
      // istanbul ignore if
      if (!node)
        continue;

      nodeStates.set(nodeId, await this.getNodeCheckBoxInfo(node));
    }
    return nodeStates;
  }

  private async collectAllNodesCheckboxInfos() {
    const nodeStates = new Map<string, CheckBoxInfo>();
    for (const node of this.modelSource.getModel().iterateTreeModelNodes()) {
      nodeStates.set(node.id, await this.getNodeCheckBoxInfo(node));
    }
    return nodeStates;
  }

  private async getNodeCheckBoxInfo(node: TreeModelNode): Promise<CheckBoxInfo> {
    if (!this._visibilityHandler)
      return { ...node.checkbox, isVisible: false };

    const result = this._visibilityHandler.getVisibilityStatus(node.item, this.getNodeKey(node.item));
    if (isPromiseLike(result))
      return this.createCheckboxInfo(await result);
    return this.createCheckboxInfo(result);
  }

  private createCheckboxInfo(status: VisibilityStatus): CheckBoxInfo {
    return {
      state: visibilityStateToCheckboxState(status.state),
      isDisabled: status.isDisabled || false,
      isVisible: true,
      tooltip: status.tooltip,
    };
  }
}

// istanbul ignore next
const visibilityStateToCheckboxState = (state: VisibilityState) => {
  switch (state) {
    case VisibilityState.Visible:
      return CheckBoxState.On;
    case VisibilityState.PartiallyVisible:
      return CheckBoxState.Partial;
    case VisibilityState.Hidden:
    default:
      return CheckBoxState.Off;
  }
};
