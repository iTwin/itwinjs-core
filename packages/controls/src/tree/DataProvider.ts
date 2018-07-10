/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Hierarchies */

import * as _ from "lodash";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { Node, NodeKey, PageOptions } from "@bentley/ecpresentation-common";
import { ECPresentation } from "@bentley/ecpresentation-frontend";
import { CheckBoxState } from "@bentley/ui-core/lib/enums/CheckBoxState";
import { TreeNodeItem } from "@bentley/ui-components/lib/tree/TreeDataProvider";
import StyleHelper from "../common/StyleHelper";

/**
 * Presentation Rules-driven tree data provider.
 */
export default class ECPresentationTreeDataProvider {
  private _rulesetId: string;
  private _imodelConnection: IModelConnection;

  /**
   * Constructor.
   * @param imodelToken Token of the imodel to pull data from.
   * @param rulesetId Id of the ruleset used by this data provider.
   */
  public constructor(connection: IModelConnection, rulesetId: string) {
    this._rulesetId = rulesetId;
    this._imodelConnection = connection;
  }

  /** Id of the ruleset used by this data provider */
  public get rulesetId(): string { return this._rulesetId; }
  public set rulesetId(value: string) {
    if (this._rulesetId === value)
      return;
    this._rulesetId = value;
    this.clearCaches();
  }

  /** [[IModelConnection]] used by this data provider */
  public get connection(): IModelConnection { return this._imodelConnection; }
  public set connection(value: IModelConnection) {
    if (this._imodelConnection === value)
      return;
    this._imodelConnection = value;
    this.clearCaches();
  }

  private clearCaches(): void {
    this.getRootNodesCount.cache.clear();
    this.getRootNodes.cache.clear();
    this.getChildNodesCount.cache.clear();
    this.getChildNodes.cache.clear();
  }

  /** Called to get extended options for node requests */
  private createRequestOptions(): object {
    return {
      RulesetId: this._rulesetId,
    };
  }

  /**
   * Returns a [[NodeKey]] from given [[TreeNodeItem]].
   * **Warning:** the `node` must be created by this data provider.
   */
  public getNodeKey(node: TreeNodeItem): NodeKey {
    return node.extendedData.key as NodeKey;
  }

  /**
   * Returns the root nodes.
   * @param pageOptions Information about the requested page of data.
   */
  public getRootNodes = _.memoize(async (pageOptions?: PageOptions): Promise<ReadonlyArray<Readonly<TreeNodeItem>>> => {
    const nodes = await ECPresentation.presentation.getRootNodes(this.connection, pageOptions, this.createRequestOptions());
    return createTreeNodeItems(nodes);
  }, MemoizationHelpers.getRootNodesKeyResolver);

  /**
   * Returns the total number of root nodes.
   */
  public getRootNodesCount = _.memoize(async (): Promise<number> => {
    return await ECPresentation.presentation.getRootNodesCount(this.connection, this.createRequestOptions());
  });

  /**
   * Returns child nodes.
   * @param parentNode The parent node to return children for.
   * @param pageOptions Information about the requested page of data.
   */
  public getChildNodes = _.memoize(async (parentNode: TreeNodeItem, pageOptions?: PageOptions): Promise<ReadonlyArray<Readonly<TreeNodeItem>>> => {
    const parentKey = this.getNodeKey(parentNode);
    const nodes = await ECPresentation.presentation.getChildren(this.connection, parentKey, pageOptions, this.createRequestOptions());
    const items = createTreeNodeItems(nodes);
    items.forEach((item: TreeNodeItem) => {
      item.parentId = parentNode.id;
    });
    return items;
  }, MemoizationHelpers.getChildNodesKeyResolver);

  /**
   * Returns the total number of child nodes.
   * @param parentNode The parent node to return children count for.
   */
  public getChildNodesCount = _.memoize(async (parentNode: TreeNodeItem): Promise<number> => {
    const parentKey = this.getNodeKey(parentNode);
    return await ECPresentation.presentation.getChildrenCount(this.connection, parentKey, this.createRequestOptions());
  }, MemoizationHelpers.getChildNodesCountKeyResolver);
}

const createTreeNodeItems = (nodes: ReadonlyArray<Readonly<Node>>): TreeNodeItem[] => {
  const list = new Array<TreeNodeItem>();
  for (const node of nodes)
    list.push(createTreeNodeItem(node));
  return list;
};

const createTreeNodeItem = (node: Readonly<Node>): TreeNodeItem => {
  const item: TreeNodeItem = {
    id: [...node.key.pathFromRoot].reverse().join("/"),
    label: node.label,
    description: node.description || "",
    hasChildren: node.hasChildren || false,
    labelForeColor: StyleHelper.getForeColor(node),
    labelBackColor: StyleHelper.getBackColor(node),
    labelBold: StyleHelper.isBold(node),
    labelItalic: StyleHelper.isItalic(node),
    displayCheckBox: node.isCheckboxVisible || false,
    checkBoxState: node.isChecked ? CheckBoxState.On : CheckBoxState.Off,
    isCheckBoxEnabled: node.isCheckboxEnabled || false,
    extendedData: { key: node.key },
  };
  return item;
};

class MemoizationHelpers {
  public static createKeyForPageOptions(pageOptions?: PageOptions) {
    if (!pageOptions)
      return "0/0";
    return `${(pageOptions.pageStart) ? pageOptions.pageStart : 0}/${(pageOptions.pageSize) ? pageOptions.pageSize : 0}`;
  }
  public static createKeyForTreeNodeItem(item: TreeNodeItem) { return item.id; }
  public static getRootNodesKeyResolver(pageOptions?: PageOptions) { return MemoizationHelpers.createKeyForPageOptions(pageOptions); }
  public static getChildNodesKeyResolver(parent: TreeNodeItem, pageOptions?: PageOptions) {
    return `${MemoizationHelpers.createKeyForTreeNodeItem(parent)}/${MemoizationHelpers.createKeyForPageOptions(pageOptions)}`;
  }
  public static getChildNodesCountKeyResolver(item: TreeNodeItem) { return MemoizationHelpers.createKeyForTreeNodeItem(item); }
}
