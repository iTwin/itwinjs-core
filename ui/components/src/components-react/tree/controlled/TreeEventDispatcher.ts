/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import { Observable } from "rxjs/internal/Observable";
import { concat } from "rxjs/internal/observable/concat";
import { defer } from "rxjs/internal/observable/defer";
import { EMPTY } from "rxjs/internal/observable/empty";
import { from } from "rxjs/internal/observable/from";
import { merge } from "rxjs/internal/observable/merge";
import { of } from "rxjs/internal/observable/of";
import { concatAll } from "rxjs/internal/operators/concatAll";
import { concatMap } from "rxjs/internal/operators/concatMap";
import { distinctUntilChanged } from "rxjs/internal/operators/distinctUntilChanged";
import { finalize } from "rxjs/internal/operators/finalize";
import { map } from "rxjs/internal/operators/map";
import { mergeAll } from "rxjs/internal/operators/mergeAll";
import { publishReplay } from "rxjs/internal/operators/publishReplay";
import { refCount } from "rxjs/internal/operators/refCount";
import { subscribeOn } from "rxjs/internal/operators/subscribeOn";
import { toArray } from "rxjs/internal/operators/toArray";
import { asapScheduler } from "rxjs/internal/scheduler/asap";
import { CheckBoxState } from "@itwin/core-react";
import { SelectionMode } from "../../common/selection/SelectionModes";
import { TreeNodeItem } from "../TreeDataProvider";
import { IndividualSelection, isRangeSelection, RangeSelection, TreeSelectionManager } from "./internal/TreeSelectionManager";
import { TreeActions } from "./TreeActions";
import { TreeEvents } from "./TreeEvents";
import { isTreeModelNode, TreeModelNode, TreeModelNodePlaceholder, VisibleTreeNodes } from "./TreeModel";
import { ITreeNodeLoader } from "./TreeNodeLoader";

/**
 * Default event dispatcher that emits tree events according performed actions.
 * It converts low level tree events into TreeEvents.
 * @internal
 */
export class TreeEventDispatcher implements TreeActions {
  private _treeEvents: TreeEvents;
  private _nodeLoader: ITreeNodeLoader;
  private _getVisibleNodes: (() => VisibleTreeNodes) | undefined;

  private _selectionManager: TreeSelectionManager;

  private _activeSelections = new Set<Observable<{ selectedNodeItems: TreeNodeItem[], deselectedNodeItems?: TreeNodeItem[] }>>();

  constructor(
    treeEvents: TreeEvents,
    nodeLoader: ITreeNodeLoader,
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
              concatMap(({ selectedNodeItems }) => from(selectedNodeItems)),
              toArray(),
              map((collectedIds) => ({ selectedNodeItems: collectedIds, deselectedNodeItems: this.collectNodeItems(deselectedNodes) })),
            ),
          ),
          concatAll(),
          publishReplay(),
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
          publishReplay(),
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
          publishReplay(),
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
    if (this._getVisibleNodes === undefined)
      return;

    const visibleNodes = this._getVisibleNodes();
    const clickedNode = visibleNodes.getModel().getNode(nodeId);
    if (clickedNode === undefined)
      return;

    const immediateStateChanges = [{ nodeItem: clickedNode.item, newState }];
    if (clickedNode.isSelected) {
      for (const node of visibleNodes) {
        if (isTreeModelNode(node) && node.id !== clickedNode.id && node.isSelected && node.checkbox.state !== newState) {
          immediateStateChanges.push({ nodeItem: node.item, newState });
        }
      }
    }

    const stateChanges = concat(
      of(immediateStateChanges),
      from(this._activeSelections)
        .pipe(
          mergeAll(),
          map(({ selectedNodeItems }) => selectedNodeItems.map((item) => ({ nodeItem: item, newState }))),
        ),
    )
      .pipe(
        publishReplay(),
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
    const node = this._getVisibleNodes ? this._getVisibleNodes().getModel().getNode(nodeId) : undefined;
    const isNodeSelected = node ? node.isSelected : false;
    this._selectionManager.onNodeClicked(nodeId, event);

    // if clicked node was already selected fire delayed click event
    if (isNodeSelected && this._treeEvents.onDelayedNodeClick !== undefined) {
      this._treeEvents.onDelayedNodeClick({ nodeId });
    }
  }

  public onNodeMouseDown(nodeId: string) {
    this._selectionManager.onNodeMouseDown(nodeId);
  }

  public onNodeMouseMove(nodeId: string) {
    this._selectionManager.onNodeMouseMove(nodeId);
  }

  public onNodeEditorActivated(nodeId: string) {
    const node = this._getVisibleNodes ? this._getVisibleNodes().getModel().getNode(nodeId) : /* istanbul ignore next */ undefined;
    const isNodeSelected = node ? node.isSelected : false;

    // if node was already selected, fire onNodeEditorActivated event
    if (isNodeSelected && this._treeEvents.onNodeEditorActivated !== undefined) {
      this._treeEvents.onNodeEditorActivated({ nodeId });
    }
  }

  public onTreeKeyDown(event: React.KeyboardEvent): void {
    this._selectionManager.onTreeKeyDown(event, this);
  }

  public onTreeKeyUp(event: React.KeyboardEvent): void {
    this._selectionManager.onTreeKeyUp(event, this);
  }

  private collectSelectionChanges(
    selection: IndividualSelection | RangeSelection,
    deselection: IndividualSelection,
  ): Observable<{ selectedNodeItems: TreeNodeItem[], deselectedNodeItems: TreeNodeItem[] }> {
    const deselectedItems = this.collectNodeItems(deselection);
    if (isRangeSelection(selection)) {
      let firstEmission = true;
      return this.collectNodesBetween(selection.from, selection.to)
        .pipe(
          map((selectedNodeItems) => {
            if (firstEmission) {
              firstEmission = false;
              return { selectedNodeItems, deselectedNodeItems: deselectedItems };
            }

            return { selectedNodeItems, deselectedNodeItems: [] };
          }),
        );
    }

    const selectedItems = this.collectNodeItems(selection);
    return of({ selectedNodeItems: selectedItems, deselectedNodeItems: deselectedItems });
  }

  private collectNodesBetween(nodeId1: string, nodeId2: string): Observable<TreeNodeItem[]> {
    const [readyNodes, nodesToLoad] = TreeEventDispatcher.groupNodesByLoadingState(
      this.iterateNodesBetween(nodeId1, nodeId2),
    );

    const loadedSelectedNodes = from(
      nodesToLoad.map((node) => {
        const parentNode = node.parentId ? this._getVisibleNodes!().getModel().getNode(node.parentId) : this._getVisibleNodes!().getModel().getRootNode();
        return parentNode ? this._nodeLoader.loadNode(parentNode, node.childIndex) : /* istanbul ignore next */ EMPTY;
      }),
    )
      .pipe(
        // We have requested multiple nodes that may belong to the same page.
        // When the page loads we only want to process the loaded nodes once.
        // Making assumption that loaded nodes from the same page will be emitted without interruptions.
        // Maybe we could simplify this to `this._nodeLoader.loadNodes(nodesToLoad)`?
        mergeAll(),
        distinctUntilChanged(),
        map((loadResult) => loadResult.loadedNodes),
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

  private collectNodeItems(nodeIds: string[]): TreeNodeItem[] {
    const items: TreeNodeItem[] = [];
    if (this._getVisibleNodes === undefined)
      return items;

    for (const nodeId of nodeIds) {
      const node = this._getVisibleNodes().getModel().getNode(nodeId);
      // istanbul ignore else
      if (node !== undefined)
        items.push(node.item);
    }
    return items;
  }

  private static groupNodesByLoadingState(
    nodes: Iterable<TreeModelNode | TreeModelNodePlaceholder>,
  ): [TreeNodeItem[], TreeModelNodePlaceholder[]] {
    const loadedNodeItems: TreeNodeItem[] = [];
    const nodesToLoad: TreeModelNodePlaceholder[] = [];
    for (const node of nodes) {
      if (isTreeModelNode(node)) {
        loadedNodeItems.push(node.item);
      } else {
        nodesToLoad.push(node);
      }
    }

    return [loadedNodeItems, nodesToLoad];
  }
}
