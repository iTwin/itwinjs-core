/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import { useEffect, useRef, useMemo } from "react";
import { IDisposable } from "@bentley/bentleyjs-core";
import { Keys, StandardNodeTypes, ECInstanceNodeKey, NodeKey } from "@bentley/presentation-common";
import { Presentation, SelectionHandler, SelectionChangeEventArgs, SelectionChangeType } from "@bentley/presentation-frontend";
import {
  TreeNodeItem, TreeEvents, TreeNodeEvent, TreeCheckboxStateChangeEvent, TreeModelSource, MutableTreeModel,
  TreeSelectionModificationEvent, TreeSelectionReplacementEvent, TreeSelectionChange, Subscription,
} from "@bentley/ui-components";
import { IPresentationTreeDataProvider } from "../IPresentationTreeDataProvider";

/**
 * @internal
 */
export class UnifiedSelectionTreeEventHandler implements TreeEvents, IDisposable {
  private _wrappedHandler: TreeEvents;
  private _selectionHandler: SelectionHandler;
  private _dataProvider: IPresentationTreeDataProvider;
  private _modelSource: TreeModelSource;
  private _dispose: () => void;

  private _selecting = false;
  private _ongoingSubscriptions = new Set<Subscription>();

  constructor(wrappedHandler: TreeEvents, modelSource: TreeModelSource, selectionHandler: SelectionHandler, dataProvider: IPresentationTreeDataProvider) {
    this._wrappedHandler = wrappedHandler;
    this._dataProvider = dataProvider;
    this._modelSource = modelSource;
    this._selectionHandler = selectionHandler;
    this._selectionHandler.onSelect = this.onSelect.bind(this);
    this._dispose = this._modelSource.onModelChanged.addListener(() => this.onModelChanged());
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

  public onCheckboxStateChanged(event: TreeCheckboxStateChangeEvent) {
    return this._wrappedHandler.onCheckboxStateChanged ? this._wrappedHandler.onCheckboxStateChanged(event) : /* istanbul ignore next */ undefined;
  }

  public onSelectionModified(event: TreeSelectionModificationEvent) {
    this._selecting = true;

    let innerSubscription: Subscription | undefined;
    if (this._wrappedHandler.onSelectionModified)
      innerSubscription = this._wrappedHandler.onSelectionModified(event);

    const subscription = event.modifications.subscribe({
      next: (selectionChange: TreeSelectionChange) => {
        const selectedNodes = this.collectAffectedTreeNodeItems(selectionChange.selectedNodeIds);
        const deselectedNodes = this.collectAffectedTreeNodeItems(selectionChange.deselectedNodeIds);

        this._selectionHandler.addToSelection(this.getKeys(selectedNodes));
        this._selectionHandler.removeFromSelection(this.getKeys(deselectedNodes));
      },
      complete: () => {
        this._selecting = false;
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
      next: (selectionReplacement: { selectedNodeIds: string[] }) => {
        const selectedNodes = this.collectAffectedTreeNodeItems(selectionReplacement.selectedNodeIds);
        if (firstEmission) {
          firstEmission = false;
          this._selectionHandler.replaceSelection(this.getKeys(selectedNodes));
          return;
        }
        this._selectionHandler.addToSelection(this.getKeys(selectedNodes));
      },
      complete: () => {
        this._selecting = false;
      },
    });

    this.saveOngoingSubscription(subscription, innerSubscription);
    return subscription;
  }

  private onModelChanged() {
    if (this._selecting)
      return;

    this.selectNodes();
  }

  private onSelect(evt: SelectionChangeEventArgs) {
    if (evt.source === this._selectionHandler.name)
      return;

    if (evt.changeType === SelectionChangeType.Clear || evt.changeType === SelectionChangeType.Replace)
      this.cancelOngoingSubscriptions();

    this.selectNodes();
  }

  public selectNodes() {
    const selection = this._selectionHandler.getSelection();

    const shouldSelectNode = (node: TreeNodeItem) => {
      // consider node selected if it's key is in selection
      const nodeKey = this._dataProvider.getNodeKey(node);
      if (selection.has(nodeKey))
        return true;

      // ... or if it's an ECInstance node and instance key is in selection
      if (nodeKey.type === StandardNodeTypes.ECInstanceNode) {
        const instanceKey = (nodeKey as ECInstanceNodeKey).instanceKey;
        if (selection.has(instanceKey))
          return true;
      }

      return false;
    };

    this._modelSource.modifyModel((model: MutableTreeModel) => {
      for (const node of model.iterateTreeModelNodes()) {
        const shouldBeSelected = shouldSelectNode(node.item);
        if (!node.isSelected && shouldBeSelected) {
          node.isSelected = true;
        } else if (node.isSelected && !shouldBeSelected) {
          node.isSelected = false;
        }
      }
    });
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

  private collectAffectedTreeNodeItems(nodeIds: string[]) {
    const items: TreeNodeItem[] = [];
    for (const nodeId of nodeIds) {
      const node = this._modelSource.getModel().getNode(nodeId);
      // istanbul ignore else
      if (node)
        items.push(node.item);
    }

    return items;
  }

  private getKeys(nodes: TreeNodeItem[]): Keys {
    const nodeKeys: NodeKey[] = nodes.map((node) => this._dataProvider.getNodeKey(node));
    return nodeKeys.map((key) => {
      if (key.type === StandardNodeTypes.ECInstanceNode)
        return (key as ECInstanceNodeKey).instanceKey;
      return key;
    });
  }
}

/**
 * A custom hook that enables unified selection in ControlledTree component.
 *
 * **Note:** it is required for the tree to use [[PresentationTreeDataProvider]]
 *
 * @alpha
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
