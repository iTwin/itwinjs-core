/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelToken } from "@bentley/imodeljs-common";
import { ECPresentationManager, PageOptions } from "@bentley/ecpresentation-common";
import { NavNode } from "@bentley/ecpresentation-common";
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
  label: string;
  description: string;
  hasChildren: boolean;
  parent?: TreeNodeItem | undefined;
  labelForeColor?: number | undefined;
  labelBackColor?: number | undefined;
  labelBold: boolean;
  labelItalic: boolean;
  iconPath?: string | undefined;
  displayCheckBox: boolean;
  checkBoxState: CheckBoxState;
  isCheckBoxEnabled: boolean;
  extendedData: any;
}

/** Tree data provider which uses @ref PresentationManager to query nodes. */
export default class TreeDataProvider {
  private _manager: ECPresentationManager;
  private _rulesetId: string;
  public imodelToken: IModelToken;

  /** Constructor.
   * @param[in] manager Presentation manager used to get the nodes.
   * @param[in] imodelToken Token of the imodel to pull data from.
   */
  public constructor(manager: ECPresentationManager, imodelToken: IModelToken, rulesetId: string) {
    this._manager = manager;
    this._rulesetId = rulesetId;
    this.imodelToken = imodelToken;
  }

  /** Get id of the ruleset used by this data provider */
  public get rulesetId(): string { return this._rulesetId; }

  /** Called to get extended options for node requests */
  private createRequestOptions(): object {
    return {
      RulesetId: this._rulesetId,
    };
  }

  private static getNodeFromTreeNodeItem(item: TreeNodeItem): NavNode {
    return item.extendedData.node as NavNode;
  }

  /** Returns the root nodes.
   * @param[in] pageOptions Information about the requested page of data.
   */
  public async getRootNodes(pageOptions: PageOptions): Promise<Array<Readonly<TreeNodeItem>>> {
    const nodes = await this._manager.getRootNodes(this.imodelToken, pageOptions, this.createRequestOptions());
    return this.createTreeNodeItems(nodes);
  }

  /** Returns the total number of root nodes. */
  public async getRootNodesCount(): Promise<number> {
    return await this._manager.getRootNodesCount(this.imodelToken, this.createRequestOptions());
  }

  /** Returns child nodes.
   * @param[in] parentNode The parent node to return children for.
   * @param[in] pageOptions Information about the requested page of data.
   */
  public async getChildNodes(parentNode: TreeNodeItem, pageOptions: PageOptions): Promise<Array<Readonly<TreeNodeItem>>> {
    const nodes = await this._manager.getChildren(this.imodelToken, TreeDataProvider.getNodeFromTreeNodeItem(parentNode), pageOptions, this.createRequestOptions());
    const items = this.createTreeNodeItems(nodes);
    items.forEach((item: TreeNodeItem) => {
      item.parent = parentNode;
    });
    return items;
  }

  /** Returns the total number of child nodes.
   * @param[in] parentNode The parent node to return children count for.
   */
  public async getChildNodesCount(parentNode: TreeNodeItem): Promise<number> {
    const parent: NavNode = TreeDataProvider.getNodeFromTreeNodeItem(parentNode);
    return await this._manager.getChildrenCount(this.imodelToken, parent, this.createRequestOptions());
  }

  private createTreeNodeItem(node: NavNode): TreeNodeItem {
    const item: TreeNodeItem = {
      id: node.nodeId.toString(),
      label: node.label,
      description: node.description,
      hasChildren: node.hasChildren,
      labelForeColor: StyleHelper.getForeColor(node),
      labelBackColor: StyleHelper.getBackColor(node),
      labelBold: StyleHelper.isBold(node),
      labelItalic: StyleHelper.isItalic(node),
      displayCheckBox: node.isCheckboxVisible,
      checkBoxState: node.isChecked ? CheckBoxState.On : CheckBoxState.Off,
      isCheckBoxEnabled: node.isCheckboxEnabled,
      extendedData: {node},
    };
    return item;
  }

  private createTreeNodeItems(nodes: NavNode[]): TreeNodeItem[] {
    const list = new Array<TreeNodeItem>();
    for (const node of nodes)
      list.push(this.createTreeNodeItem(node));
    return list;
  }
}
