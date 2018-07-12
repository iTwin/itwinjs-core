/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { NodePathElement, NodeKey } from "@bentley/ecpresentation-common";
import SimpleTreeDataProvider, { SimpleTreeDataProviderHierarchy } from "@bentley/ui-components/lib/tree/SimpleTreeDataProvider";
import { TreeNodeItem } from "@bentley/ui-components/lib/tree/TreeDataProvider";
import { PageOptions } from "@bentley/ui-components/lib/common/PageOptions";
import { createTreeNodeItem } from "./Utils";
import IECPresentationTreeDataProvider from "./IECPresentationTreeDataProvider";

/**
 * @hidden
 */
export default class FilteredECPresentationTreeDataProvider implements IECPresentationTreeDataProvider {
  private _parentDataProvider: IECPresentationTreeDataProvider;
  private _filteredDataProvider: SimpleTreeDataProvider;
  private _allNodeIds: string[];
  private _filter: string;

  public constructor(parentDataProvider: IECPresentationTreeDataProvider, filter: string, paths: ReadonlyArray<Readonly<NodePathElement>>) {
    this._parentDataProvider = parentDataProvider;
    this._filter = filter;
    this._allNodeIds = [];
    const hierarchy: SimpleTreeDataProviderHierarchy = new Map<string | undefined, TreeNodeItem[]>();
    FilteredECPresentationTreeDataProvider.createHierarchy(paths, hierarchy, this._allNodeIds);
    this._filteredDataProvider = new SimpleTreeDataProvider(hierarchy);
  }

  public get rulesetId(): string { return this._parentDataProvider.rulesetId; }

  public get connection(): IModelConnection { return this._parentDataProvider.connection; }

  public get filter(): string { return this._filter; }

  private static createHierarchy(paths: ReadonlyArray<Readonly<NodePathElement>>, hierarchy: SimpleTreeDataProviderHierarchy, allNodeIds: string[], parentId?: string) {
    const treeNodes: TreeNodeItem[] = [];
    for (let i = 0; i < paths.length; i++) {
      const node = createTreeNodeItem(paths[i].node, parentId);
      if (paths[i].children.length !== 0) {
        FilteredECPresentationTreeDataProvider.createHierarchy(paths[i].children, hierarchy, allNodeIds, node.id);
        node.hasChildren = true;
      } else
        node.hasChildren = false;

      allNodeIds.push(node.id);
      treeNodes[i] = node;
    }
    hierarchy.set(parentId, treeNodes);
  }

  public async getRootNodes(pageOptions?: PageOptions): Promise<ReadonlyArray<Readonly<TreeNodeItem>>> {
    return this._filteredDataProvider.getRootNodes(pageOptions);
  }

  public async getRootNodesCount(): Promise<number> {
    return this._filteredDataProvider.getRootNodesCount();
  }

  public async getChildNodes(parentNode: TreeNodeItem, pageOptions?: PageOptions): Promise<ReadonlyArray<Readonly<TreeNodeItem>>> {
    return this._filteredDataProvider.getChildNodes(parentNode, pageOptions);
  }

  public async getChildNodesCount(parentNode: TreeNodeItem): Promise<number> {
    return this._filteredDataProvider.getChildNodesCount(parentNode);
  }

  public async getFilteredNodePaths(filter: string): Promise<ReadonlyArray<Readonly<NodePathElement>>> {
    return this._parentDataProvider.getFilteredNodePaths(filter);
  }

  public getAllNodeIds(): string[] {
    return this._allNodeIds;
  }

  public getNodeKey(node: TreeNodeItem): NodeKey {
    return node.extendedData.key as NodeKey;
  }

}
