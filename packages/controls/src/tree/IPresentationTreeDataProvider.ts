/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Hierarchies */

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
   * @param filter Filter.
   */
  getFilteredNodePaths(filter: string): Promise<ReadonlyArray<Readonly<NodePathElement>>>;
}
