/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import { Observable } from "../Observable";
import { CheckboxStateChange } from "../TreeEvents";
import { TreeModelSource, TreeNodeLoadResult } from "../TreeModelSource";

import { EMPTY } from "rxjs/internal/observable/empty";
import { TreeDataProvider } from "../../TreeDataProvider";

/** @internal */
export class TreeModelMutator {
  private _modelSource: TreeModelSource<TreeDataProvider>;
  private _collapsedChildrenDisposalEnabled: boolean;

  constructor(modelSource: TreeModelSource<TreeDataProvider>, collapsedChildrenDisposalEnabled: boolean) {
    this._modelSource = modelSource;
    this._collapsedChildrenDisposalEnabled = collapsedChildrenDisposalEnabled;
  }

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

    return needToLoadChildren ? this._modelSource.loadNode(nodeId, 0) : EMPTY;
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

  public modifySelection(nodesToSelect: string[], nodesToDeselect: string[]) {
    this._modelSource.modifyModel((model) => {
      for (const nodeId of nodesToSelect) {
        const node = model.getNode(nodeId);
        if (node !== undefined) {
          node.isSelected = true;
        }
      }

      for (const nodeId of nodesToDeselect) {
        const node = model.getNode(nodeId);
        if (node !== undefined) {
          node.isSelected = false;
        }
      }
    });
  }

  public replaceSelection(nodesToSelect: string[]) {
    this._modelSource.modifyModel((model) => {
      for (const node of model.iterateTreeModelNodes()) {
        node.isSelected = false;
      }

      for (const nodeId of nodesToSelect) {
        const node = model.getNode(nodeId);
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
      for (const { nodeId, newState } of stateChanges) {
        const node = model.getNode(nodeId);
        if (node !== undefined) {
          node.checkbox.state = newState;
        }
      }
    });
  }
}
