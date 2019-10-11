/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import { TreeActions } from "./TreeActions";
import { TreeEvents } from "./TreeEvents";
import { TreeModelNodePlaceholder, TreeModelNode, isTreeModelNode, VisibleTreeNodes } from "./TreeModel";
import { TreeNodeLoader } from "./TreeModelSource";
import {
  TreeSelectionManager,
  IndividualSelection,
  RangeSelection,
  isRangeSelection,
} from "./internal/TreeSelectionManager";
import { SelectionMode } from "../../common/selection/SelectionModes";

import { CheckBoxState } from "@bentley/ui-core";

import { Observable } from "rxjs/internal/Observable";
import { concat } from "rxjs/internal/observable/concat";
import { defer } from "rxjs/internal/observable/defer";
import { EMPTY } from "rxjs/internal/observable/empty";
import { from } from "rxjs/internal/observable/from";
import { of } from "rxjs/internal/observable/of";
import { merge } from "rxjs/internal/observable/merge";
import { concatAll } from "rxjs/internal/operators/concatAll";
import { concatMap } from "rxjs/internal/operators/concatMap";
import { distinctUntilChanged } from "rxjs/internal/operators/distinctUntilChanged";
import { finalize } from "rxjs/internal/operators/finalize";
import { map } from "rxjs/internal/operators/map";
import { mergeAll } from "rxjs/internal/operators/mergeAll";
import { publish } from "rxjs/internal/operators/publish";
import { refCount } from "rxjs/internal/operators/refCount";
import { subscribeOn } from "rxjs/internal/operators/subscribeOn";
import { toArray } from "rxjs/internal/operators/toArray";
import { asap as asapScheduler } from "rxjs/internal/scheduler/asap";

/**
 * Default event dispatcher that emits tree events according performed actions.
 * @internal
 */
export class TreeEventDispatcher implements TreeActions {
  private _treeEvents: TreeEvents;
  private _nodeLoader: TreeNodeLoader;
  private _getVisibleNodes: (() => VisibleTreeNodes) | undefined;

  private _selectionManager: TreeSelectionManager;

  private _activeSelections = new Set<Observable<{ selectedNodeIds: string[], deselectedNodeIds?: string[] }>>();

  constructor(
    treeEvents: TreeEvents,
    nodeLoader: TreeNodeLoader,
    selectionMode: SelectionMode,
    getVisibleNodes?: () => VisibleTreeNodes,
  ) {
    this._treeEvents = treeEvents;
    this._nodeLoader = nodeLoader;
    this._getVisibleNodes = getVisibleNodes;

    this._selectionManager = new TreeSelectionManager(selectionMode, this._getVisibleNodes);

    this._selectionManager.onDragSelection.addListener(({ selectionChanges }) => {
      const modifications = from(selectionChanges)
        .pipe(
          map(({ selectedNodes, deselectedNodes }) => from(this.collectSelectionChanges(selectedNodes, []))
            .pipe(
              concatMap(({ selectedNodeIds }) => from(selectedNodeIds)),
              toArray(),
              map((collectedIds) => ({ selectedNodeIds: collectedIds, deselectedNodeIds: deselectedNodes })),
            ),
          ),
          concatAll(),
          publish(),
          refCount(),
        );

      /* istanbul ignore else */
      if (this._treeEvents.onSelectionModified !== undefined)
        this._treeEvents.onSelectionModified({ modifications });
    });

    this._selectionManager.onSelectionChanged.addListener(({ selectedNodes, deselectedNodes }) => {
      const modifications = merge(
        defer(() => {
          this._activeSelections.add(modifications);
          return EMPTY;
        }),
        this.collectSelectionChanges(selectedNodes, deselectedNodes),
      )
        .pipe(
          finalize(() => {
            this._activeSelections.delete(modifications);
          }),
          publish(),
          refCount(),
        );

      /* istanbul ignore else */
      if (this._treeEvents.onSelectionModified !== undefined)
        this._treeEvents.onSelectionModified({ modifications });
    });

    this._selectionManager.onSelectionReplaced.addListener(({ selectedNodeIds }) => {
      const replacements = merge(
        defer(() => {
          this._activeSelections.add(replacements);
          return EMPTY;
        }),
        this.collectSelectionChanges(selectedNodeIds, []),
      )
        .pipe(
          finalize(() => {
            this._activeSelections.delete(replacements);
          }),
          publish(),
          refCount(),
        );

      /* istanbul ignore else */
      if (this._treeEvents.onSelectionReplaced !== undefined)
        this._treeEvents.onSelectionReplaced({ replacements });
    });
  }

  public setVisibleNodes(visibleNodes: () => VisibleTreeNodes) {
    this._getVisibleNodes = visibleNodes;
    this._selectionManager.setVisibleNodes(visibleNodes);
  }

  public onNodeCheckboxClicked(nodeId: string, newState: CheckBoxState) {
    const immediateStateChanges = [{ nodeId, newState }];

    if (this._getVisibleNodes !== undefined) {
      const visibleNodes = this._getVisibleNodes();
      const clickedNode = visibleNodes.getModel().getNode(nodeId);
      if (clickedNode && clickedNode.isSelected) {
        for (const node of visibleNodes) {
          if (isTreeModelNode(node) && node.isSelected && node.checkbox.state !== newState) {
            immediateStateChanges.push({ nodeId: node.id, newState });
          }
        }
      }
    }

    const stateChanges = concat(
      of(immediateStateChanges),
      from(this._activeSelections)
        .pipe(
          mergeAll(),
          map(({ selectedNodeIds }) => selectedNodeIds.map((id) => ({ nodeId: id, newState }))),
        ),
    )
      .pipe(
        publish(),
        refCount(),
      );

    /* istanbul ignore else */
    if (this._treeEvents.onCheckboxStateChanged !== undefined)
      this._treeEvents.onCheckboxStateChanged({ stateChanges });
  }

  public onNodeExpanded(nodeId: string) {
    /* istanbul ignore else */
    if (this._treeEvents.onNodeExpanded !== undefined)
      this._treeEvents.onNodeExpanded({ nodeId });
  }

  public onNodeCollapsed(nodeId: string) {
    /* istanbul ignore else */
    if (this._treeEvents.onNodeCollapsed !== undefined)
      this._treeEvents.onNodeCollapsed({ nodeId });
  }

  public onNodeClicked(nodeId: string, event: React.MouseEvent<Element, MouseEvent>) {
    this._selectionManager.onNodeClicked(nodeId, event);
  }

  public onNodeMouseDown(nodeId: string) {
    this._selectionManager.onNodeMouseDown(nodeId);
  }

  public onNodeMouseMove(nodeId: string) {
    this._selectionManager.onNodeMouseMove(nodeId);
  }

  private collectSelectionChanges(
    selection: IndividualSelection | RangeSelection,
    deselection: IndividualSelection,
  ): Observable<{ selectedNodeIds: string[], deselectedNodeIds: string[] }> {
    if (isRangeSelection(selection)) {
      let firstEmission = true;
      return this.collectNodesBetween(selection.from, selection.to)
        .pipe(
          map((selectedNodeIds) => {
            if (firstEmission) {
              firstEmission = false;
              return { selectedNodeIds, deselectedNodeIds: deselection };
            }

            return { selectedNodeIds, deselectedNodeIds: [] };
          }),
        );
    }

    return of({ selectedNodeIds: selection, deselectedNodeIds: deselection });
  }

  private collectNodesBetween(nodeId1: string, nodeId2: string): Observable<string[]> {
    const [readyNodes, nodesToLoad] = TreeEventDispatcher.groupNodesByLoadingState(
      this.iterateNodesBetween(nodeId1, nodeId2),
    );

    const loadedSelectedNodes = from(
      nodesToLoad.map((node) => this._nodeLoader.loadNode(node.parentId, node.childIndex)),
    )
      .pipe(
        // We have requested multiple nodes that may belong to the same page.
        // When the page loads we only want to process the loaded nodes once.
        // Making assumption that loaded nodes from the same page will be emitted without interruptions.
        // Maybe we could simplify this to `this._nodeLoader.loadNodes(nodesToLoad)`?
        mergeAll(),
        distinctUntilChanged(),
        map(({ loadedNodes }) => loadedNodes),
      );

    return concat(of(readyNodes), loadedSelectedNodes)
      .pipe(
        // Give enough time for multiple subscribers to subscribe before any emissions begin
        subscribeOn(asapScheduler),
      );
  }

  private *iterateNodesBetween(
    nodeId1: string,
    nodeId2: string,
  ): Iterable<TreeModelNode | TreeModelNodePlaceholder> {
    let firstNodeFound = false;
    if (this._getVisibleNodes === undefined) {
      return;
    }

    for (const node of this._getVisibleNodes()) {
      if (firstNodeFound) {
        yield node;
      }

      if (isTreeModelNode(node)) {
        if (nodeId1 === nodeId2 && node.id === nodeId1) {
          yield node;
          return;
        }

        if (node.id === nodeId1 || node.id === nodeId2) {
          if (firstNodeFound) {
            return;
          }

          firstNodeFound = true;
          yield node;
        }
      }
    }
  }

  private static groupNodesByLoadingState(
    nodes: Iterable<TreeModelNode | TreeModelNodePlaceholder>,
  ): [string[], TreeModelNodePlaceholder[]] {
    const loadedNodes: string[] = [];
    const nodesToLoad: TreeModelNodePlaceholder[] = [];
    for (const node of nodes) {
      if (isTreeModelNode(node)) {
        loadedNodes.push(node.id);
      } else {
        nodesToLoad.push(node);
      }
    }

    return [loadedNodes, nodesToLoad];
  }
}
