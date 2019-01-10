/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import { TreeNodeItem, ITreeDataProvider, TreeDataChangesListener } from "./TreeDataProvider";
import { PageOptions } from "../common/PageOptions";
import { BeEvent } from "@bentley/bentleyjs-core";

/**
 * Used by [[SimpleTreeDataProvider]].
 * key - Parent id.
 * value - Child tree node items.
 */
export type SimpleTreeDataProviderHierarchy = Map<string | undefined, TreeNodeItem[]>;

/**
 * A tree data provider using [[SimpleTreeDataProviderHierarchy]].
 */
export class SimpleTreeDataProvider implements ITreeDataProvider {
  private _hierarchy: SimpleTreeDataProviderHierarchy;

  public constructor(hierarchy: SimpleTreeDataProviderHierarchy) {
    this._hierarchy = hierarchy;
  }

  public onTreeNodeChanged = new BeEvent<TreeDataChangesListener>();

  private getNodesByParentId(parentId?: string, pageOptions?: PageOptions): TreeNodeItem[] {
    const nodes = this._hierarchy.get(parentId);

    if (!nodes)
      return [];

    if (!pageOptions)
      return [...nodes];

    let pageEndIndex: number | undefined;
    if (pageOptions.size !== undefined && pageOptions.size !== 0) {
      pageEndIndex = pageOptions.size;
      pageEndIndex += pageOptions.start ? pageOptions.start : 0;
    }
    return nodes.slice(pageOptions.start, pageEndIndex);
  }

  public async getNodes(parent?: TreeNodeItem, pageOptions?: PageOptions): Promise<TreeNodeItem[]> {
    return this.getNodesByParentId(parent ? parent.id : undefined, pageOptions);
  }

  public async getNodesCount(parent?: TreeNodeItem): Promise<number> {
    return this.getNodesByParentId(parent ? parent.id : undefined).length;
  }
}

export default SimpleTreeDataProvider;
