/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import { TreeDataProvider, TreeNodeItem } from "@bentley/ui-components/lib/tree/TreeDataProvider";
import IPresentationDataProvider from "../common/IPresentationDataProvider";
import { NodeKey, NodePathElement } from "@bentley/presentation-common";

/**
 * Presentation tree data provider.
 */
export default interface IPresentationTreeDataProvider extends TreeDataProvider, IPresentationDataProvider {
  /**
   * Returns a [[NodeKey]] from given [[TreeNodeItem]].
   */
  getNodeKey(node: TreeNodeItem): NodeKey;

  /**
   * Returns filtered node paths.
   */
  getFilteredNodePaths(filter: string): Promise<NodePathElement[]>;
}
