/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import { IModelConnection } from "@bentley/imodeljs-frontend";
import { NodePathElement, NodeKey } from "@bentley/presentation-common";
import {
  SimpleTreeDataProvider, SimpleTreeDataProviderHierarchy,
  DelayLoadedTreeNodeItem, TreeNodeItem,
  PageOptions, ActiveMatchInfo,
} from "@bentley/ui-components";
import { createTreeNodeItem } from "./Utils";
import { IPresentationTreeDataProvider } from "./IPresentationTreeDataProvider";
import { memoize } from "lodash";

/**
 * Rules-driven presentation tree data provider that returns filtered results.
 * @internal
 */
export class FilteredPresentationTreeDataProvider implements IPresentationTreeDataProvider {
  private _parentDataProvider: IPresentationTreeDataProvider;
  private _filteredDataProvider: SimpleTreeDataProvider;
  private _filter: string;
  private _filteredResultMatches: Array<{ id: string, matchesCount: number }> = [];

  public constructor(parentDataProvider: IPresentationTreeDataProvider, filter: string, paths: ReadonlyArray<Readonly<NodePathElement>>) {
    this._parentDataProvider = parentDataProvider;
    this._filter = filter;
    const hierarchy: SimpleTreeDataProviderHierarchy = new Map<string | undefined, TreeNodeItem[]>();
    this.createHierarchy(paths, hierarchy);
    this._filteredDataProvider = new SimpleTreeDataProvider(hierarchy);
  }

  public get rulesetId(): string { return this._parentDataProvider.rulesetId; }

  public get imodel(): IModelConnection { return this._parentDataProvider.imodel; }

  public get filter(): string { return this._filter; }

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
      } else
        node.hasChildren = false;

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
    return node.extendedData.key as NodeKey;
  }

}
