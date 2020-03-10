/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelComponents
 */

import { Subject } from "rxjs/internal/Subject";
import { from } from "rxjs/internal/observable/from";
import { EMPTY } from "rxjs/internal/observable/empty";
import { map } from "rxjs/internal/operators/map";
import { mergeMap } from "rxjs/internal/operators/mergeMap";
import { takeUntil } from "rxjs/internal/operators/takeUntil";
import {
  TreeNodeItem, TreeSelectionModificationEventArgs, TreeSelectionReplacementEventArgs,
  TreeCheckboxStateChangeEventArgs, TreeModelChanges, CheckBoxInfo, TreeModelNode, CheckboxStateChange,
} from "@bentley/ui-components";
import { IDisposable } from "@bentley/bentleyjs-core";
import { NodeKey } from "@bentley/presentation-common";
import { CheckBoxState, isPromiseLike } from "@bentley/ui-core";
import { UnifiedSelectionTreeEventHandlerParams, UnifiedSelectionTreeEventHandler } from "@bentley/presentation-components";

/**
 * Data structure that describes info used to filter visibility tree.
 * @alpha
 */
export interface VisibilityTreeFilterInfo {
  filter: string;
  activeMatchIndex?: number;
}

/**
 * Data structure that describes instance visibility status.
 * @alpha
 */
export interface VisibilityStatus {
  isDisplayed: boolean;
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
  private _cancelCheckboxEvent = new Subject<void>();
  private _removeListener: () => void;

  constructor(params: VisibilityTreeEventHandlerParams) {
    super(params);
    this._visibilityHandler = params.visibilityHandler;
    this._selectionPredicate = params.selectionPredicate;

    if (this._visibilityHandler) {
      this._visibilityHandler.onVisibilityChange = () => this.updateCheckboxes();
    }

    this._removeListener = this.modelSource.onModelChanged.addListener((args) => this.updateCheckboxes(args[1]));
    this.updateCheckboxes(); // tslint:disable-line: no-floating-promises
  }

  public dispose() {
    super.dispose();
    this._removeListener();
  }

  private filterSelectionItems(items: TreeNodeItem[]) {
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
        takeUntil(this._cancelCheckboxEvent),
        mergeMap((changes) => this.changeVisibility(changes)),
      )
      .subscribe({
        complete: () => {
          // needed for categories tree as it currently does no emit event when visibility changes
          this.updateCheckboxes(); // tslint:disable-line: no-floating-promises
        },
      });
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
      state: status.isDisplayed ? CheckBoxState.On : CheckBoxState.Off,
      isDisabled: status.isDisabled || false,
      isVisible: true,
      tooltip: status.tooltip,
    };
  }
}
