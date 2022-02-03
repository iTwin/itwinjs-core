/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import { EMPTY } from "rxjs/internal/observable/empty";
import type { TreeNodeItem } from "../../TreeDataProvider";
import type { Observable } from "../Observable";
import type { CheckboxStateChange } from "../TreeEvents";
import type { TreeModelNode, TreeModelNodeEditingInfo } from "../TreeModel";
import type { TreeModelSource } from "../TreeModelSource";
import type { ITreeNodeLoader, TreeNodeLoadResult } from "../TreeNodeLoader";

/**
 * Provides basic tree manipulation implementation for various cases like
 * expand/collapse node, modify/replace/clear selection. It is used by default
 * tree event handler to modify model when events occur.
 * @internal
 */
export class TreeModelMutator {
  private _modelSource: TreeModelSource;
  private _nodeLoader: ITreeNodeLoader;
  private _collapsedChildrenDisposalEnabled: boolean;

  constructor(modelSource: TreeModelSource, nodeLoader: ITreeNodeLoader, collapsedChildrenDisposalEnabled: boolean) {
    this._modelSource = modelSource;
    this._nodeLoader = nodeLoader;
    this._collapsedChildrenDisposalEnabled = collapsedChildrenDisposalEnabled;
  }

  public get modelSource() { return this._modelSource; }

  public expandNode(nodeId: string): Observable<TreeNodeLoadResult> {
    let needToLoadChildren = false;
    this._modelSource.modifyModel((model) => {
      const node = model.getNode(nodeId);
      if (node === undefined || node.isExpanded) {
        return;
      }

      needToLoadChildren = node.numChildren === undefined;

      node.isExpanded = true;
      if (needToLoadChildren) {
        node.isLoading = true;
      }
    });

    const expandedNode = this._modelSource.getModel().getNode(nodeId);
    return needToLoadChildren && expandedNode ? this._nodeLoader.loadNode(expandedNode, 0) : EMPTY;
  }

  public collapseNode(nodeId: string) {
    this._modelSource.modifyModel((model) => {
      const node = model.getNode(nodeId);
      if (node === undefined || !node.isExpanded) {
        return;
      }

      node.isExpanded = false;
      if (this._collapsedChildrenDisposalEnabled) {
        model.clearChildren(node.id);
      }
    });
  }

  public modifySelection(nodesToSelect: TreeNodeItem[], nodesToDeselect: TreeNodeItem[]) {
    this._modelSource.modifyModel((model) => {
      for (const nodeItem of nodesToSelect) {
        const node = model.getNode(nodeItem.id);
        if (node !== undefined) {
          node.isSelected = true;
        }
      }

      for (const nodeItem of nodesToDeselect) {
        const node = model.getNode(nodeItem.id);
        if (node !== undefined) {
          node.isSelected = false;
        }
      }
    });
  }

  public replaceSelection(nodesToSelect: TreeNodeItem[]) {
    this._modelSource.modifyModel((model) => {
      for (const node of model.iterateTreeModelNodes()) {
        node.isSelected = false;
      }

      for (const nodeItem of nodesToSelect) {
        const node = model.getNode(nodeItem.id);
        if (node !== undefined) {
          node.isSelected = true;
        }
      }
    });
  }

  public clearNodeSelection() {
    this._modelSource.modifyModel((model) => {
      for (const node of model.iterateTreeModelNodes()) {
        node.isSelected = false;
      }
    });
  }

  public setCheckboxStates(stateChanges: CheckboxStateChange[]) {
    this._modelSource.modifyModel((model) => {
      for (const { nodeItem, newState } of stateChanges) {
        const node = model.getNode(nodeItem.id);
        if (node !== undefined) {
          node.checkbox.state = newState;
        }
      }
    });
  }

  public activateEditing(nodeId: string, onCommit: (node: TreeModelNode, newValue: string) => void) {
    this._modelSource.modifyModel((model) => {
      const node = model.getNode(nodeId);
      if (!node)
        return;

      if (node.item.isEditable) {
        node.editingInfo = this.createNodeEditingInfo(nodeId, onCommit);
      }
    });
  }

  private createNodeEditingInfo(nodeId: string, onCommit: (node: TreeModelNode, newValue: string) => void): TreeModelNodeEditingInfo {
    const closeEditing = () => {
      this._modelSource.modifyModel((model) => {
        const node = model.getNode(nodeId);
        // istanbul ignore if
        if (!node)
          return;
        node.editingInfo = undefined;
      });
    };

    const onEditCommitted = (node: TreeModelNode, newValue: string) => {
      onCommit(node, newValue);
      closeEditing();
    };

    return { onCommit: onEditCommitted, onCancel: closeEditing };
  }
}
