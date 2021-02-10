/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import memoize from "micro-memoize";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { NodeKey, NodePathElement } from "@bentley/presentation-common";
import {
  ActiveMatchInfo, DelayLoadedTreeNodeItem, PageOptions, SimpleTreeDataProvider, SimpleTreeDataProviderHierarchy, TreeNodeItem,
} from "@bentley/ui-components";
import { IPresentationTreeDataProvider } from "./IPresentationTreeDataProvider";
import { createTreeNodeItem } from "./Utils";

/**
 * Filtered presentation tree data provider.
 * @public
 */
export interface IFilteredPresentationTreeDataProvider extends IPresentationTreeDataProvider {
  /**
   * Applied filter.
   */
  filter: string;
  /**
   * Returns active match for given index.
   */
  getActiveMatch(index: number): ActiveMatchInfo | undefined;
  /**
   * Counts all filter matches.
   */
  countFilteringResults(nodePaths: ReadonlyArray<Readonly<NodePathElement>>): number;
  /**
   * Checks whether node matches applied filter or not.
   */
  nodeMatchesFilter(node: TreeNodeItem): boolean;
}

/** @internal */
export interface FilteredPresentationTreeDataProviderProps {
  parentDataProvider: IPresentationTreeDataProvider;
  filter: string;
  paths: ReadonlyArray<Readonly<NodePathElement>>;
}

/**
 * Rules-driven presentation tree data provider that returns filtered results.
 * @internal
 */
export class FilteredPresentationTreeDataProvider implements IFilteredPresentationTreeDataProvider {
  private _parentDataProvider: IPresentationTreeDataProvider;
  private _filteredDataProvider: SimpleTreeDataProvider;
  private _filter: string;
  private _filteredResultMatches: Array<{ id: string, matchesCount: number }> = [];

  public constructor(props: FilteredPresentationTreeDataProviderProps) {
    this._parentDataProvider = props.parentDataProvider;
    this._filter = props.filter;
    const hierarchy: SimpleTreeDataProviderHierarchy = new Map<string | undefined, TreeNodeItem[]>();
    this.createHierarchy(props.paths, hierarchy);
    this._filteredDataProvider = new SimpleTreeDataProvider(hierarchy);
  }

  // istanbul ignore next - only here to meet interface's requirements, nothing to test
  public dispose() { }

  public get rulesetId(): string { return this._parentDataProvider.rulesetId; }

  public get imodel(): IModelConnection { return this._parentDataProvider.imodel; }

  public get filter(): string { return this._filter; }

  public get parentDataProvider(): IPresentationTreeDataProvider { return this._parentDataProvider; }

  private createHierarchy(paths: ReadonlyArray<Readonly<NodePathElement>>, hierarchy: SimpleTreeDataProviderHierarchy, parentId?: string) {
    const treeNodes: DelayLoadedTreeNodeItem[] = [];
    for (let i = 0; i < paths.length; i++) {
      const node = createTreeNodeItem(paths[i].node, parentId);

      if (paths[i].filteringData && paths[i].filteringData!.matchesCount)
        this._filteredResultMatches.push({ id: node.id, matchesCount: paths[i].filteringData!.matchesCount });

      if (paths[i].children.length !== 0) {
        this.createHierarchy(paths[i].children, hierarchy, node.id);
        node.hasChildren = true;
        node.autoExpand = true;
      } else {
        delete node.hasChildren;
        delete node.autoExpand;
      }

      treeNodes[i] = node;
    }
    hierarchy.set(parentId, treeNodes);
  }

  public getActiveMatch: (index: number) => ActiveMatchInfo | undefined = memoize((index: number): ActiveMatchInfo | undefined => {
    let activeMatch: ActiveMatchInfo | undefined;
    if (index <= 0)
      return undefined;

    let i = 1;
    for (const node of this._filteredResultMatches) {
      if (index < i + node.matchesCount) {
        activeMatch = {
          nodeId: node.id,
          matchIndex: index - i,
        };
        break;
      }

      i += node.matchesCount;
    }
    return activeMatch;
  });

  /** Count filtering results. Including multiple possible matches within node labels */
  public countFilteringResults(nodePaths: ReadonlyArray<Readonly<NodePathElement>>): number {
    let resultCount = 0;

    // Loops through root level only
    for (const path of nodePaths) {
      if (path.filteringData)
        resultCount += path.filteringData.matchesCount + path.filteringData.childMatchesCount;
    }

    return resultCount;
  }

  public async getNodes(parent?: TreeNodeItem, pageOptions?: PageOptions): Promise<DelayLoadedTreeNodeItem[]> {
    return this._filteredDataProvider.getNodes(parent, pageOptions);
  }

  public async getNodesCount(parent?: TreeNodeItem): Promise<number> {
    return this._filteredDataProvider.getNodesCount(parent);
  }

  public async getFilteredNodePaths(filter: string): Promise<NodePathElement[]> {
    return this._parentDataProvider.getFilteredNodePaths(filter);
  }

  public getNodeKey(node: TreeNodeItem): NodeKey {
    return this._parentDataProvider.getNodeKey(node);
  }

  /** Check if node matches currently applied filter */
  public nodeMatchesFilter(node: TreeNodeItem): boolean {
    return this._filteredResultMatches.some((result) => result.id === node.id);
  }

  /** @alpha Hierarchy loading performance needs to be improved before this becomes publicly available. */
  // istanbul ignore next
  public async loadHierarchy() {
    // the hierarchy is already loaded when this provider is created
  }

}
