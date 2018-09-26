/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Tree */

import { IModelConnection } from "@bentley/imodeljs-frontend";
import { NodePathElement, NodeKey } from "@bentley/presentation-common";
import SimpleTreeDataProvider, { SimpleTreeDataProviderHierarchy } from "@bentley/ui-components/lib/tree/SimpleTreeDataProvider";
import { TreeNodeItem } from "@bentley/ui-components/lib/tree/TreeDataProvider";
import { PageOptions } from "@bentley/ui-components/lib/common/PageOptions";
import { ActiveResultNode } from "@bentley/ui-components/lib/tree/HighlightingEngine";
import { createTreeNodeItem } from "./Utils";
import IPresentationTreeDataProvider from "./IPresentationTreeDataProvider";
import { memoize } from "lodash";

/**
 * @hidden
 */
export default class FilteredPresentationTreeDataProvider implements IPresentationTreeDataProvider {
  private _parentDataProvider: IPresentationTreeDataProvider;
  private _filteredDataProvider: SimpleTreeDataProvider;
  private _allNodeIds: string[];
  private _filter: string;
  private _filteredResultsOccurances: Array<{ id: string, occurances: number }> = [];

  public constructor(parentDataProvider: IPresentationTreeDataProvider, filter: string, paths: ReadonlyArray<Readonly<NodePathElement>>) {
    this._parentDataProvider = parentDataProvider;
    this._filter = filter;
    this._allNodeIds = [];
    const hierarchy: SimpleTreeDataProviderHierarchy = new Map<string | undefined, TreeNodeItem[]>();
    this.createHierarchy(paths, hierarchy, this._allNodeIds);
    this._filteredDataProvider = new SimpleTreeDataProvider(hierarchy);
  }

  public get rulesetId(): string { return this._parentDataProvider.rulesetId; }

  public get connection(): IModelConnection { return this._parentDataProvider.connection; }

  public get filter(): string { return this._filter; }

  private createHierarchy(paths: ReadonlyArray<Readonly<NodePathElement>>, hierarchy: SimpleTreeDataProviderHierarchy, allNodeIds: string[], parentId?: string) {
    const treeNodes: TreeNodeItem[] = [];
    for (let i = 0; i < paths.length; i++) {
      const node = createTreeNodeItem(paths[i].node, parentId);

      if (paths[i].filteringData && paths[i].filteringData!.occurances)
        this._filteredResultsOccurances.push({ id: node.id, occurances: paths[i].filteringData!.occurances });

      if (paths[i].children.length !== 0) {
        this.createHierarchy(paths[i].children, hierarchy, allNodeIds, node.id);
        node.hasChildren = true;
      } else
        node.hasChildren = false;

      allNodeIds.push(node.id);
      treeNodes[i] = node;
    }
    hierarchy.set(parentId, treeNodes);
  }

  public getActiveResultNode: (index: number) => ActiveResultNode | undefined = memoize((index: number): ActiveResultNode | undefined => {
    let activeNode: ActiveResultNode | undefined;
    if (index <= 0)
      return undefined;

    let i = 1;
    for (const node of this._filteredResultsOccurances) {
      if (index < i + node.occurances) {
        activeNode = {
          id: node.id,
          index: index - i,
        };
        break;
      }

      i += node.occurances;
    }
    return activeNode;
  });

  /** Count filtering results. Including multiple possible matches within node labels */
  public countFilteringResults(nodePaths: ReadonlyArray<Readonly<NodePathElement>>): number {
    let resultCount = 0;

    // Loops through root level only
    for (const path of nodePaths) {
      if (path.filteringData)
        resultCount += path.filteringData.occurances + path.filteringData.childrenOccurances;
    }

    return resultCount;
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

  public async getFilteredNodePaths(filter: string): Promise<NodePathElement[]> {
    return this._parentDataProvider.getFilteredNodePaths(filter);
  }

  public getAllNodeIds(): string[] {
    return this._allNodeIds;
  }

  public getNodeKey(node: TreeNodeItem): NodeKey {
    return node.extendedData.key as NodeKey;
  }

}
