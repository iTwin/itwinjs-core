/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import { TreeNodeItem, TreeDataProvider, TreeDataChangeEvent } from "./TreeDataProvider";
import { PageOptions } from "../common/PageOptions";

/**
 * Used by [[SimpleTreeDataProvider]].
 * key - Parent id.
 * value - Child tree node items.
 */
export type SimpleTreeDataProviderHierarchy = Map<string | undefined, TreeNodeItem[]>;

/**
 * A tree data provider using [[SimpleTreeDataProviderHierarchy]].
 */
export default class SimpleTreeDataProvider implements TreeDataProvider {
  private _hierarchy: SimpleTreeDataProviderHierarchy;

  public constructor(hierarchy: SimpleTreeDataProviderHierarchy) {
    this._hierarchy = hierarchy;
  }

  public onTreeNodeChanged: TreeDataChangeEvent = new TreeDataChangeEvent();

  private getNodes(parentId?: string, pageOptions?: PageOptions): ReadonlyArray<Readonly<TreeNodeItem>> {
    const nodes = this._hierarchy.get(parentId);
    if (!nodes)
      return [];
    if (!pageOptions)
      return nodes;

    let pageEndIndex: number | undefined;
    if (pageOptions.size !== undefined && pageOptions.size !== 0) {
      pageEndIndex = pageOptions.size;
      pageEndIndex += pageOptions.start ? pageOptions.start : 0;
    }
    return nodes.slice(pageOptions.start, pageEndIndex);
  }

  public async getRootNodes(pageOptions?: PageOptions): Promise<ReadonlyArray<Readonly<TreeNodeItem>>> {
    return this.getNodes(undefined, pageOptions);
  }

  public async getRootNodesCount(): Promise<number> {
    return this.getNodes().length;
  }

  public async getChildNodes(parentNode: TreeNodeItem, pageOptions?: PageOptions): Promise<ReadonlyArray<Readonly<TreeNodeItem>>> {
    return this.getNodes(parentNode.id, pageOptions);
  }

  public async getChildNodesCount(parentNode: TreeNodeItem): Promise<number> {
    return this.getNodes(parentNode.id).length;
  }

}
