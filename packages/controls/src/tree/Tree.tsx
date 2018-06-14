/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { Keys } from "@bentley/ecpresentation-common";
import { ECPresentation, SelectionHandler, SelectionChangeEventArgs, ISelectionProvider } from "@bentley/ecpresentation-frontend";
import { Tree as BaseTree, TreeNodeItem } from "@bentley/ui-components";
import DataProvider from "./DataProvider";
import { StandardNodeTypes, ECInstanceNodeKey } from "@bentley/ecpresentation-common/lib/hierarchy/Key";

/**
 * Possible options of what gets put into selection
 * when node is selected
 */
export const enum SelectionTarget {
  /**
   * Node's key is selected
   */
  Node,

  /**
   * If the node is an ECInstanceNode - key of the ECInstance
   * is selected. Otherwise node's key is selected.
   */
  Instance,
}

/**
 * Properties that define how selection in the [[Tree]] works
 */
export interface SelectionProps {
  /** Defines what gets put into selection when node is selected */
  selectionTarget?: SelectionTarget;

  /**
   * A callback to check if node should be selected in the tree.
   * **Note:** The default handler is not called if this callback
   * is set.
   */
  isNodeSelected?: (node: TreeNodeItem) => boolean;

  /**
   * A callback called when nodes are selected. Return true
   * to keep default handling or false to abort.
   */
  onNodesSelected?: (nodes: TreeNodeItem[], replace: boolean) => boolean;

  /**
   * A callback called when nodes are deselected. Return true
   * to keep default handling or false to abort.
   */
  onNodesDeselected?: (nodes: TreeNodeItem[]) => boolean;

  /** @hidden */
  selectionHandler?: SelectionHandler;
}

/**
 * Props for [[Tree]] control.
 */
export interface Props {
  /** iModel to pull data from */
  imodel: IModelConnection;

  /** Presentation ruleset to use for creating the hierarchy */
  rulesetId: string;

  /** Optional ID for the control. The ID is also used as a selection handler name. */
  id?: string;

  /** Optional custom data provider implementation. */
  dataProvider?: DataProvider;

  /** Optional selection-related props */
  selection?: SelectionProps;
}

/**
 * Presentation rules -driven tree control which also participates in
 * unified selection.
 */
export default class Tree extends React.Component<Props> {

  private _dataProvider: DataProvider;
  private _selectionHandler: SelectionHandler;

  public constructor(props: Props, context?: any) {
    super(props, context);

    this._dataProvider = Tree.getDataProviderFromProps(props);
    this._selectionHandler = Tree.getSelectionHandlerFromProps(props);
    this._selectionHandler.onSelect = this.onSelectionChanged;
  }

  private static getSelectionHandlerFromProps(props: Props): SelectionHandler {
    const key = props.id ? props.id : `Tree_${new Date().getTime()}`;
    const handler = props.selection && props.selection.selectionHandler
      ? props.selection.selectionHandler : new SelectionHandler(ECPresentation.selection, key, props.imodel, props.rulesetId);
    return handler;
  }

  private static getDataProviderFromProps(props: Props): DataProvider {
    return props.dataProvider
      ? props.dataProvider : new DataProvider(props.imodel, props.rulesetId);
  }

  public componentWillUnmount() {
    this._selectionHandler.dispose();
  }

  public componentWillReceiveProps(nextProps: Props) {
    this._selectionHandler.imodel = nextProps.imodel;
    this._selectionHandler.rulesetId = nextProps.rulesetId;

    this._dataProvider.connection = nextProps.imodel;
    this._dataProvider.rulesetId = nextProps.rulesetId;
  }

  /** Get selection handler used by the tree */
  public get selectionHandler(): SelectionHandler { return this._selectionHandler; }

  /** Get data provider of this tree */
  public get dataProvider(): DataProvider { return this._dataProvider; }

  // tslint:disable-next-line:naming-convention
  private isNodeSelected = (node: TreeNodeItem): boolean => {
    // give consumers a chance to tell if node is selected
    if (this.props.selection && this.props.selection.isNodeSelected)
      return this.props.selection.isNodeSelected(node);

    const selection = this._selectionHandler.getSelection();

    // consider node selected if it's key is in selection
    const nodeKey = this.dataProvider.getNodeKey(node);
    if (selection.has(nodeKey))
      return true;

    // ... or if it's an ECInstance node and instance key is in selection
    if (nodeKey.type === StandardNodeTypes.ECInstanceNode) {
      const instanceKey = (nodeKey as ECInstanceNodeKey).instanceKey;
      return selection.has(instanceKey);
    }

    return false;
  }

  private getNodeKeys(nodes: TreeNodeItem[]): Keys {
    const nodeKeys = nodes.map((node) => this._dataProvider.getNodeKey(node));
    let keys: Keys = nodeKeys;
    if (this.props.selection && this.props.selection.selectionTarget === SelectionTarget.Instance) {
      keys = nodeKeys.map((key) => {
        if (key.type === StandardNodeTypes.ECInstanceNode)
          return (key as ECInstanceNodeKey).instanceKey;
        return key;
      });
    }
    return keys;
  }

  // tslint:disable-next-line:naming-convention
  private onNodesSelected = (nodes: TreeNodeItem[], replace: boolean) => {
    // give consumers a chance to handle selection changes and either
    // continue default handling (by returning `true`) or abort (by
    // returning `false`)
    if (this.props.selection && this.props.selection.onNodesSelected && !this.props.selection.onNodesSelected(nodes, replace))
      return;

    if (replace)
      this._selectionHandler.replaceSelection(this.getNodeKeys(nodes));
    else
      this._selectionHandler.addToSelection(this.getNodeKeys(nodes));
  }

  // tslint:disable-next-line:naming-convention
  private onNodesDeselected = (nodes: TreeNodeItem[]) => {
    // give consumers a chance to handle selection changes and either
    // continue default handling (by returning `true`) or abort (by
    // returning `false`)
    if (this.props.selection && this.props.selection.onNodesDeselected && !this.props.selection.onNodesDeselected(nodes))
      return;

    this._selectionHandler.removeFromSelection(this.getNodeKeys(nodes));
    // wip: may want to remove both node **and** instance key
  }

  // tslint:disable-next-line:naming-convention
  private onSelectionChanged = (args: SelectionChangeEventArgs, _provider: ISelectionProvider) => {
    if (args.level === 0)
      this.forceUpdate();
  }

  public render() {
    return (
      <BaseTree
        dataProvider={this._dataProvider}
        selectedNodes={this.isNodeSelected} onNodesSelected={this.onNodesSelected} onNodesDeselected={this.onNodesDeselected}
      />
    );
  }
}
