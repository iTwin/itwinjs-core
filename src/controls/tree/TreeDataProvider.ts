/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import memoize = require("lodash/memoize");
import { IModelToken } from "@bentley/imodeljs-common";
import { Node, NodeKey, PageOptions } from "@bentley/ecpresentation-common";
import { ECPresentation } from "@bentley/ecpresentation-frontend";
import StyleHelper from "../common/StyleHelper";

/** State of a checkbox */
export enum CheckBoxState {
  Off,
  On,
  Partial,
}

/** A node item which can be displayed in a tree */
export interface TreeNodeItem {
  id: string;
  parentId?: string;
  label: string;
  description?: string;
  hasChildren: boolean;
  labelForeColor?: number;
  labelBackColor?: number;
  labelBold: boolean;
  labelItalic: boolean;
  iconPath?: string;
  displayCheckBox: boolean;
  checkBoxState: CheckBoxState;
  isCheckBoxEnabled: boolean;
  extendedData: any;
}

const createKeyForPageOptions = (pageOptions?: PageOptions) => {
  if (!pageOptions)
    return "0/0";
  return `${(pageOptions.pageStart) ? pageOptions.pageStart : 0}/${(pageOptions.pageSize) ? pageOptions.pageSize : 0}`;
};
const createKeyForTreeNodeItem = (item: TreeNodeItem) => item.id;
const getRootNodesKeyResolver = createKeyForPageOptions;
const getChildNodesKeyResolver = (parent: TreeNodeItem, pageOptions?: PageOptions) => {
  return `${createKeyForTreeNodeItem(parent)}/${createKeyForPageOptions(pageOptions)}`;
};
const getChildNodesCountKeyResolver = createKeyForTreeNodeItem;

/** Tree data provider which uses @ref PresentationManager to query nodes. */
export default class TreeDataProvider {
  private _rulesetId: string;
  private _imodelToken: IModelToken;

  /** Constructor.
   * @param[in] manager Presentation manager used to get the nodes.
   * @param[in] imodelToken Token of the imodel to pull data from.
   */
  public constructor(imodelToken: IModelToken, rulesetId: string) {
    this._rulesetId = rulesetId;
    this._imodelToken = imodelToken;
  }

  /** Get id of the ruleset used by this data provider */
  public get rulesetId(): string { return this._rulesetId; }

  public get imodelToken(): IModelToken { return this._imodelToken; }

  public set imodelToken(value: IModelToken) {
    this._imodelToken = value;
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

  private static getNodeKeyFromTreeNodeItem(item: TreeNodeItem): NodeKey {
    return item.extendedData.key as NodeKey;
  }

  /** Returns the root nodes.
   * @param[in] pageOptions Information about the requested page of data.
   */
  public getRootNodes: _.MemoizedFunction = memoize(async (pageOptions?: PageOptions): Promise<ReadonlyArray<Readonly<TreeNodeItem>>> => {
    const nodes = await ECPresentation.presentation.getRootNodes(this.imodelToken, pageOptions, this.createRequestOptions());
    return this.createTreeNodeItems(nodes);
  }, getRootNodesKeyResolver);

  /** Returns the total number of root nodes. */
  public getRootNodesCount: _.MemoizedFunction = memoize(async (): Promise<number> => {
    return await ECPresentation.presentation.getRootNodesCount(this.imodelToken, this.createRequestOptions());
  });

  /** Returns child nodes.
   * @param[in] parentNode The parent node to return children for.
   * @param[in] pageOptions Information about the requested page of data.
   */
  public getChildNodes: _.MemoizedFunction = memoize(async (parentNode: TreeNodeItem, pageOptions?: PageOptions): Promise<ReadonlyArray<Readonly<TreeNodeItem>>> => {
    const parentKey = TreeDataProvider.getNodeKeyFromTreeNodeItem(parentNode);
    const nodes = await ECPresentation.presentation.getChildren(this.imodelToken, parentKey, pageOptions, this.createRequestOptions());
    const items = this.createTreeNodeItems(nodes);
    items.forEach((item: TreeNodeItem) => {
      item.parentId = parentNode.id;
    });
    return items;
  }, getChildNodesKeyResolver);

  /** Returns the total number of child nodes.
   * @param[in] parentNode The parent node to return children count for.
   */
  public getChildNodesCount: _.MemoizedFunction = memoize(async (parentNode: TreeNodeItem): Promise<number> => {
    const parentKey = TreeDataProvider.getNodeKeyFromTreeNodeItem(parentNode);
    return await ECPresentation.presentation.getChildrenCount(this.imodelToken, parentKey, this.createRequestOptions());
  }, getChildNodesCountKeyResolver);

  private createTreeNodeItem(node: Readonly<Node>): TreeNodeItem {
    const item: TreeNodeItem = {
      id: [...node.key.pathFromRoot].reverse().join("/"),
      label: node.label,
      description: node.description || "",
      hasChildren: node.hasChildren,
      labelForeColor: StyleHelper.getForeColor(node),
      labelBackColor: StyleHelper.getBackColor(node),
      labelBold: StyleHelper.isBold(node),
      labelItalic: StyleHelper.isItalic(node),
      displayCheckBox: node.isCheckboxVisible,
      checkBoxState: node.isChecked ? CheckBoxState.On : CheckBoxState.Off,
      isCheckBoxEnabled: node.isCheckboxEnabled,
      extendedData: {key: node.key},
    };
    return item;
  }

  private createTreeNodeItems(nodes: ReadonlyArray<Readonly<Node>>): TreeNodeItem[] {
    const list = new Array<TreeNodeItem>();
    for (const node of nodes)
      list.push(this.createTreeNodeItem(node));
    return list;
  }
}
