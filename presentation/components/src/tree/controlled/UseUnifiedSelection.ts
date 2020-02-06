/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import { useEffect, useRef, useMemo } from "react";
import { IDisposable } from "@bentley/bentleyjs-core";
import { Keys, NodeKey, KeySet } from "@bentley/presentation-common";
import {
  Presentation, SelectionHandler, SelectionChangeEventArgs,
  SelectionChangeType, SelectionHelper,
} from "@bentley/presentation-frontend";
import {
  TreeNodeItem, TreeEvents, TreeNodeEvent, TreeCheckboxStateChangeEvent, TreeModelSource, MutableTreeModel,
  TreeSelectionModificationEvent, TreeSelectionReplacementEvent, Subscription, TreeModelChanges, TreeModel, MutableTreeModelNode,
} from "@bentley/ui-components";
import { IPresentationTreeDataProvider } from "../IPresentationTreeDataProvider";

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
export class UnifiedSelectionTreeEventHandler implements TreeEvents, IDisposable {
  private _wrappedHandler: TreeEvents;
  private _selectionHandler: SelectionHandler;
  private _dataProvider: IPresentationTreeDataProvider;
  private _modelSource: TreeModelSource;
  private _dispose: () => void;

  private _selecting = false;
  private _skipModelChange = false;
  private _ongoingSubscriptions = new Set<Subscription>();

  constructor(wrappedHandler: TreeEvents, modelSource: TreeModelSource, selectionHandler: SelectionHandler, dataProvider: IPresentationTreeDataProvider) {
    this._wrappedHandler = wrappedHandler;
    this._dataProvider = dataProvider;
    this._modelSource = modelSource;
    this._selectionHandler = selectionHandler;
    this._selectionHandler.onSelect = this.onSelect.bind(this);
    this._dispose = this._modelSource.onModelChanged.addListener((args) => this.onModelChanged(args));
  }

  public dispose() {
    this._dispose();
    this.cancelOngoingSubscriptions();
  }

  public onNodeExpanded(event: TreeNodeEvent) {
    // istanbul ignore else
    if (this._wrappedHandler.onNodeExpanded)
      this._wrappedHandler.onNodeExpanded(event);
  }
  public onNodeCollapsed(event: TreeNodeEvent) {
    // istanbul ignore else
    if (this._wrappedHandler.onNodeCollapsed)
      this._wrappedHandler.onNodeCollapsed(event);
  }
  public onDelayedNodeClick(event: TreeNodeEvent) {
    // istanbul ignore else
    if (this._wrappedHandler.onDelayedNodeClick)
      this._wrappedHandler.onDelayedNodeClick(event);
  }

  public onCheckboxStateChanged(event: TreeCheckboxStateChangeEvent) {
    return this._wrappedHandler.onCheckboxStateChanged ? this._wrappedHandler.onCheckboxStateChanged(event) : /* istanbul ignore next */ undefined;
  }

  public onSelectionModified(event: TreeSelectionModificationEvent) {
    this._selecting = true;

    let innerSubscription: Subscription | undefined;
    if (this._wrappedHandler.onSelectionModified)
      innerSubscription = this._wrappedHandler.onSelectionModified(event);

    const subscription = event.modifications.subscribe({
      next: ({ selectedNodeItems, deselectedNodeItems }) => {
        this._selectionHandler.addToSelection(this.createKeysForSelection(selectedNodeItems, SelectionChangeType.Add));
        this._selectionHandler.removeFromSelection(this.createKeysForSelection(deselectedNodeItems, SelectionChangeType.Remove));
      },
      complete: () => {
        this._selecting = false;
        this.selectNodes();
      },
    });

    this.saveOngoingSubscription(subscription, innerSubscription);
    return subscription;
  }

  public onSelectionReplaced(event: TreeSelectionReplacementEvent) {
    this._selecting = true;

    let innerSubscription: Subscription | undefined;
    if (this._wrappedHandler.onSelectionReplaced)
      innerSubscription = this._wrappedHandler.onSelectionReplaced(event);

    this.cancelOngoingSubscriptions();

    let firstEmission = true;
    const subscription = event.replacements.subscribe({
      next: ({ selectedNodeItems }) => {
        if (firstEmission) {
          firstEmission = false;
          this._selectionHandler.replaceSelection(this.createKeysForSelection(selectedNodeItems, SelectionChangeType.Replace));
          return;
        }
        this._selectionHandler.addToSelection(this.createKeysForSelection(selectedNodeItems, SelectionChangeType.Add));
      },
      complete: () => {
        this._selecting = false;
        this.selectNodes();
      },
    });

    this.saveOngoingSubscription(subscription, innerSubscription);
    return subscription;
  }

  public selectNodes(modelChange?: TreeModelChanges) {
    const selection = this._selectionHandler.getSelection();

    this._skipModelChange = true;
    // when handling model change event only need to update newly added nodes
    if (modelChange)
      this.updateAddedNodes(selection, modelChange.addedNodeIds);
    else
      this.updateAllNodes(selection);
    this._skipModelChange = false;
  }

  protected getModel() {
    return this._modelSource.getModel();
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

  private onModelChanged(args: [TreeModel, TreeModelChanges]) {
    if (this._selecting || this._skipModelChange)
      return;

    this.selectNodes(args[1]);
  }

  private onSelect(evt: SelectionChangeEventArgs) {
    if (evt.source === this._selectionHandler.name)
      return;

    if (evt.changeType === SelectionChangeType.Clear || evt.changeType === SelectionChangeType.Replace)
      this.cancelOngoingSubscriptions();

    this.selectNodes();
  }

  private updateAllNodes(selection: Readonly<KeySet>) {
    this._modelSource.modifyModel((model: MutableTreeModel) => {
      for (const node of model.iterateTreeModelNodes()) {
        this.updateNodeSelectionState(node, selection);
      }
    });
  }

  private updateAddedNodes(selection: Readonly<KeySet>, addedNodeIds: string[]) {
    this._modelSource.modifyModel((model: MutableTreeModel) => {
      for (const nodeId of addedNodeIds) {
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

  private saveOngoingSubscription(subscription: Subscription, innerSubscription?: Subscription) {
    this._ongoingSubscriptions.add(subscription);
    if (innerSubscription)
      subscription.add(innerSubscription);
    subscription.add(() => this._ongoingSubscriptions.delete(subscription));
  }

  private cancelOngoingSubscriptions() {
    this._ongoingSubscriptions.forEach((subscription) => subscription.unsubscribe());
    this._ongoingSubscriptions.clear();
  }
}

/**
 * A custom hook that enables unified selection in ControlledTree component.
 *
 * **Note:** it is required for the tree to use [[PresentationTreeDataProvider]]
 *
 * @beta
 */
// tslint:disable-next-line: variable-name naming-convention
export function useControlledTreeUnifiedSelection(modelSource: TreeModelSource, treeEvents: TreeEvents, dataProvider: IPresentationTreeDataProvider): TreeEvents {
  const name = useRefLazy(() => `Tree_${counter++}`);
  const unifiedSelectionHandler = useRefLazy(() => new SelectionHandler(Presentation.selection, name, dataProvider.imodel, dataProvider.rulesetId));

  // dispose selection handler on unmount
  useEffect(() => () => unifiedSelectionHandler.dispose(), []);

  useEffect(() => {
    unifiedSelectionHandler.imodel = dataProvider.imodel;
    unifiedSelectionHandler.rulesetId = dataProvider.rulesetId;
  }, [dataProvider]);

  const eventHandler = useMemo(
    () => new UnifiedSelectionTreeEventHandler(treeEvents, modelSource, unifiedSelectionHandler, dataProvider),
    [unifiedSelectionHandler, modelSource, treeEvents, dataProvider],
  );

  const previousEventHandler = useRef<UnifiedSelectionTreeEventHandler>();
  useEffect(() => {
    previousEventHandler.current = eventHandler;
    return () => {
      // istanbul ignore else
      if (previousEventHandler.current)
        previousEventHandler.current.dispose();
    };
  }, [eventHandler]);

  useEffect(() => {
    eventHandler.selectNodes();
  }, [modelSource]);

  return eventHandler;
}

function useRefLazy<T>(initialize: () => T) {
  const ref = useRef<T>();
  if (!ref.current) {
    ref.current = initialize();
  }
  return ref.current;
}

let counter = 1;
