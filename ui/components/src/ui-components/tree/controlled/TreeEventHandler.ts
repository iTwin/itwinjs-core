/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import { Subject } from "rxjs/internal/Subject";
import { from } from "rxjs/internal/observable/from";
import { takeUntil } from "rxjs/internal/operators/takeUntil";
import {
  TreeEvents, TreeNodeEvent, TreeCheckboxStateChangeEvent,
  TreeSelectionModificationEvent, TreeSelectionReplacementEvent,
} from "./TreeEvents";
import { TreeModelMutator } from "./internal/TreeModelMutator";
import { Subscription } from "./Observable";
import { ITreeNodeLoader } from "./TreeNodeLoader";
import { TreeModelSource } from "./TreeModelSource";

/**
 * Data structure that describes tree event handler params.
 * @alpha
 */
export interface TreeEventHandlerParams {
  modelSource: TreeModelSource;
  nodeLoader: ITreeNodeLoader;
  collapsedChildrenDisposalEnabled?: boolean;
}

/**
 * Default tree event handler.
 * @alpha
 */
export class TreeEventHandler implements TreeEvents {
  private _modelMutator: TreeModelMutator;

  private _disposed = new Subject();
  private _selectionReplaced = new Subject();

  constructor(params: TreeEventHandlerParams) {
    this._modelMutator = new TreeModelMutator(params.modelSource, params.nodeLoader, !!params.collapsedChildrenDisposalEnabled);
  }

  public dispose() {
    this._disposed.next();
  }

  public onNodeExpanded({ nodeId }: TreeNodeEvent) {
    from(this._modelMutator.expandNode(nodeId)).pipe(takeUntil(this._disposed)).subscribe();
  }

  public onNodeCollapsed({ nodeId }: TreeNodeEvent) {
    this._modelMutator.collapseNode(nodeId);
  }

  public onSelectionModified({ modifications }: TreeSelectionModificationEvent): Subscription | undefined {
    return from(modifications)
      .pipe(
        takeUntil(this._disposed),
        takeUntil(this._selectionReplaced),
      )
      .subscribe({
        next: ({ selectedNodeIds, deselectedNodeIds }) => {
          this._modelMutator.modifySelection(selectedNodeIds, deselectedNodeIds);
        },
      });
  }

  public onSelectionReplaced({ replacements }: TreeSelectionReplacementEvent): Subscription | undefined {
    this._selectionReplaced.next();

    let firstEmission = true;
    return from(replacements)
      .pipe(
        takeUntil(this._disposed),
        takeUntil(this._selectionReplaced),
      )
      .subscribe({
        next: ({ selectedNodeIds }) => {
          if (firstEmission) {
            firstEmission = false;
            this._modelMutator.replaceSelection(selectedNodeIds);
          }

          this._modelMutator.modifySelection(selectedNodeIds, []);
        },
      });
  }

  public onCheckboxStateChanged({ stateChanges }: TreeCheckboxStateChangeEvent): Subscription | undefined {
    return stateChanges.subscribe((changes) => this._modelMutator.setCheckboxStates(changes));
  }
}
