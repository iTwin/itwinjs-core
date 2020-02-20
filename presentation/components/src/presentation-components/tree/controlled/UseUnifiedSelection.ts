/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import { useCallback } from "react";
import { from } from "rxjs/internal/observable/from";
import { tap } from "rxjs/internal/operators/tap";
import { takeUntil } from "rxjs/internal/operators/takeUntil";
import { Subject } from "rxjs/internal/Subject";
import { IDisposable, Guid } from "@bentley/bentleyjs-core";
import { Keys, NodeKey, KeySet } from "@bentley/presentation-common";
import {
  Presentation, SelectionHandler, SelectionChangeEventArgs,
  SelectionChangeType, SelectionHelper,
} from "@bentley/presentation-frontend";
import {
  TreeNodeItem, TreeModelSource, MutableTreeModel, TreeSelectionModificationEvent, TreeSelectionReplacementEvent,
  TreeModelChanges, MutableTreeModelNode, TreeEventHandler, TreeEventHandlerParams, AbstractTreeNodeLoaderWithProvider,
} from "@bentley/ui-components";
import { IPresentationTreeDataProvider } from "../IPresentationTreeDataProvider";
import { useDisposable } from "@bentley/ui-core";

/** Data structure that describes parameters for UnifiedSelectionTreeEventHandler
 * @beta
 */
export interface UnifiedSelectionTreeEventHandlerParams extends TreeEventHandlerParams {
  dataProvider: IPresentationTreeDataProvider;
  /** Unique name for SelectionHandler to avoid handling events raised by itself.
   * Unique name is created if not provided.
   */
  name?: string;
  /** @internal used for testing */
  selectionHandler?: SelectionHandler;
}

/**
 * Tree event handler that handles unified selection.
 * Extends wrapped tree event handler's functionality by adding, removing or replacing nodes in
 * unified selection. It also reacts to unified selection changes and selects/deselects tree nodes
 * according changes.
 *
 * **Note:** conditions used to determine if node is selected and nodes that should be added to
 * unified selection can be controlled by overriding 'shouldSelectNode' and 'createKeysForSelection' methods.
 * @beta
 */
export class UnifiedSelectionTreeEventHandler extends TreeEventHandler implements IDisposable {
  private _selectionHandler: SelectionHandler;
  private _dataProvider: IPresentationTreeDataProvider;
  private _modelSource: TreeModelSource;
  private _dispose: () => void;

  private _cancelled = new Subject<void>();

  constructor(params: UnifiedSelectionTreeEventHandlerParams) {
    super(params);
    this._dataProvider = params.dataProvider;
    this._modelSource = params.modelSource;
    const name = params.name ?? `Tree_${params.dataProvider.rulesetId}_${Guid.createValue()}`;
    this._selectionHandler = params.selectionHandler
      ? params.selectionHandler
      : new SelectionHandler(Presentation.selection, name, params.dataProvider.imodel, params.dataProvider.rulesetId);
    this._selectionHandler.onSelect = this.onSelect.bind(this);
    this._dispose = this._modelSource.onModelChanged.addListener((args) => this.selectNodes(args[1]));
    this.selectNodes();
  }

  public get modelSource() { return this._modelSource; }

  public dispose() {
    super.dispose();
    this._cancelled.next();
    this._selectionHandler.dispose();
    this._dispose();
  }

  public onSelectionModified({ modifications }: TreeSelectionModificationEvent) {
    const withUnifiedSelection = from(modifications).pipe(
      takeUntil(this._cancelled),
      tap({
        next: ({ selectedNodeItems, deselectedNodeItems }) => {
          if (selectedNodeItems.length !== 0)
            this._selectionHandler.addToSelection(this.createKeysForSelection(selectedNodeItems, SelectionChangeType.Add));
          if (deselectedNodeItems.length !== 0)
            this._selectionHandler.removeFromSelection(this.createKeysForSelection(deselectedNodeItems, SelectionChangeType.Remove));
        },
        complete: () => {
          this.selectNodes();
        },
      }),
    );

    return super.onSelectionModified({ modifications: withUnifiedSelection });
  }

  public onSelectionReplaced({ replacements }: TreeSelectionReplacementEvent) {
    let firstEmission = true;
    const withUnifiedSelection = from(replacements).pipe(
      takeUntil(this._cancelled),
      tap({
        next: ({ selectedNodeItems }) => {
          if (selectedNodeItems.length === 0)
            return;
          if (firstEmission) {
            firstEmission = false;
            this._selectionHandler.replaceSelection(this.createKeysForSelection(selectedNodeItems, SelectionChangeType.Replace));
            return;
          }
          this._selectionHandler.addToSelection(this.createKeysForSelection(selectedNodeItems, SelectionChangeType.Add));
        },
        complete: () => {
          this.selectNodes();
        },
      }),
    );

    return super.onSelectionReplaced({ replacements: withUnifiedSelection });
  }

  public selectNodes(modelChange?: TreeModelChanges) {
    const selection = this._selectionHandler.getSelection();

    // when handling model change event only need to update newly added nodes
    if (modelChange)
      this.updateAffectedNodes(selection, modelChange);
    else
      this.updateAllNodes(selection);
  }

  protected getNodeKey(node: TreeNodeItem) {
    return this._dataProvider.getNodeKey(node);
  }

  /**
   * Determines if node should be selected.
   * Default implementation returns true if node key is in selection
   * or node is ECInstance node and instance key is in selection.
   */
  protected shouldSelectNode(node: TreeNodeItem, selection: Readonly<KeySet>) {
    const nodeKey = this.getNodeKey(node);
    if (nodeKey === undefined)
      return false;

    // consider node selected if it's key is in selection
    if (selection.has(nodeKey))
      return true;

    // ... or if it's an ECInstances node and any of instance keys is in selection
    if (NodeKey.isInstancesNodeKey(nodeKey) && nodeKey.instanceKeys.some((instanceKey) => selection.has(instanceKey)))
      return true;

    // ... or if it's an ECInstance node and instance key is in selection
    if (NodeKey.isInstanceNodeKey(nodeKey) && selection.has(nodeKey.instanceKey))
      return true;

    return false;
  }

  /**
   * Returns node keys that should be added, removed or used to replace unified selection.
   * Default implementation returns keys of supplied nodes.
   */
  protected createKeysForSelection(nodes: TreeNodeItem[], _selectionType: SelectionChangeType) {
    return this.getKeys(nodes);
  }

  protected getKeys(nodes: TreeNodeItem[]): Keys {
    const nodeKeys: NodeKey[] = nodes.map((node) => this._dataProvider.getNodeKey(node));
    return SelectionHelper.getKeysForSelection(nodeKeys);
  }

  private onSelect(evt: SelectionChangeEventArgs) {
    if (evt.source === this._selectionHandler.name)
      return;

    if (evt.changeType === SelectionChangeType.Clear || evt.changeType === SelectionChangeType.Replace)
      this._cancelled.next();

    this.selectNodes();
  }

  private updateAllNodes(selection: Readonly<KeySet>) {
    this._modelSource.modifyModel((model: MutableTreeModel) => {
      for (const node of model.iterateTreeModelNodes()) {
        this.updateNodeSelectionState(node, selection);
      }
    });
  }

  private updateAffectedNodes(selection: Readonly<KeySet>, modelChange: TreeModelChanges) {
    const affectedNodeIds = [...modelChange.addedNodeIds, ...modelChange.modifiedNodeIds];
    if (affectedNodeIds.length === 0)
      return;

    this._modelSource.modifyModel((model: MutableTreeModel) => {
      for (const nodeId of affectedNodeIds) {
        const node = model.getNode(nodeId);
        // istanbul ignore if
        if (!node)
          continue;

        this.updateNodeSelectionState(node, selection);
      }
    });
  }

  private updateNodeSelectionState(node: MutableTreeModelNode, selection: Readonly<KeySet>) {
    const shouldBeSelected = this.shouldSelectNode(node.item, selection);
    if (!node.isSelected && shouldBeSelected) {
      node.isSelected = true;
    } else if (node.isSelected && !shouldBeSelected) {
      node.isSelected = false;
    }
  }
}

/** Hooks which creates and disposes UnifiedSelectionTreeEventHandler
 * @beta
 */
export function useUnifiedSelectionEventHandler(modelSource: TreeModelSource, nodeLoader: AbstractTreeNodeLoaderWithProvider<IPresentationTreeDataProvider>, disposeCollapsedNodes?: boolean, name?: string) {
  const createHandler = useCallback(() => new UnifiedSelectionTreeEventHandler({
    modelSource,
    nodeLoader,
    dataProvider: nodeLoader.getDataProvider(),
    collapsedChildrenDisposalEnabled: disposeCollapsedNodes,
    name,
  }), [modelSource, nodeLoader, disposeCollapsedNodes, name]);
  return useDisposable(createHandler);
}
