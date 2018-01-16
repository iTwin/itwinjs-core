/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ECPresentationManager, PageOptions } from "../../common/ECPresentationManager";
import { NavNode } from "../../common/Hierarchy";
import StyleHelper from "./StyleHelper";
import { IModelToken } from "@bentley/imodeljs-frontend/lib/common/IModel";

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
  parent: TreeNodeItem | null;
  labelForeColor: number | null;
  labelBackColor: number | null;
  labelBold: boolean;
  labelItalic: boolean;
  iconPath: string | null;
  displayCheckBox: boolean;
  checkBoxState: CheckBoxState;
  isCheckBoxEnabled: boolean;
  extendedData: any;
}

/** Tree data provider which uses @ref PresentationManager to query nodes. */
export class TreeDataProvider {
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
  public async getRootNodes(pageOptions: PageOptions): Promise<TreeNodeItem[]> {
    const self = this;
    return this._manager.getRootNodes(this.imodelToken, pageOptions, this.createRequestOptions())
      .then((nodes: NavNode[]) => {
        return self.createTreeNodeItems(nodes);
      })
      .catch((_error: string) => {
        return [];
      });
  }

  /** Returns the total number of root nodes. */
  public async getRootNodesCount(): Promise<number> {
    return this._manager.getRootNodesCount(this.imodelToken, this.createRequestOptions());
  }

  /** Returns child nodes.
   * @param[in] parentNode The parent node to return children for.
   * @param[in] pageOptions Information about the requested page of data.
   */
  public async getChildNodes(parentNode: TreeNodeItem, pageOptions: PageOptions): Promise<TreeNodeItem[]> {
    const self = this;
    return this._manager.getChildren(this.imodelToken, TreeDataProvider.getNodeFromTreeNodeItem(parentNode), pageOptions, this.createRequestOptions())
      .then((nodes: NavNode[]) => {
        const items = self.createTreeNodeItems(nodes);
        for (const item of items)
          item.parent = parentNode;
        return items;
      })
      .catch((_error: string) => {
        return [];
      });
  }

  /** Returns the total number of child nodes.
   * @param[in] parentNode The parent node to return children count for.
   */
  public async getChildNodesCount(parentNode: TreeNodeItem): Promise<number> {
    const parent: NavNode = TreeDataProvider.getNodeFromTreeNodeItem(parentNode);
    return this._manager.getChildrenCount(this.imodelToken, parent, this.createRequestOptions());
  }

  private createTreeNodeItem(node: NavNode): TreeNodeItem {
    const item: TreeNodeItem = {
      id: node.nodeId.toString(),
      parent: null,
      label: node.label,
      description: node.description,
      hasChildren: node.hasChildren,
      labelForeColor: StyleHelper.getForeColor(node),
      labelBackColor: StyleHelper.getBackColor(node),
      labelBold: StyleHelper.isBold(node),
      labelItalic: StyleHelper.isItalic(node),
      iconPath: null,
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
