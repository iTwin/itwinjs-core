/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import { BeEvent } from "@itwin/core-bentley";
import type { PageOptions } from "../common/PageOptions";
import type { ITreeDataProvider, TreeDataChangesListener, TreeNodeItem } from "./TreeDataProvider";

/**
 * Used by [[SimpleTreeDataProvider]].
 * key - Parent id.
 * value - Child tree node items.
 * @public
 */
export type SimpleTreeDataProviderHierarchy = Map<string | undefined, TreeNodeItem[]>;

/**
 * A tree data provider using [[SimpleTreeDataProviderHierarchy]].
 * @public
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
