/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Hierarchies */

import { TreeDataProvider, TreeNodeItem } from "@bentley/ui-components/lib/tree/TreeDataProvider";
import IECPresentationDataProvider from "../common/IECPresentationDataProvider";
import { NodeKey, NodePathElement } from "@bentley/ecpresentation-common";

/**
 * ECPresentation tree data provider.
 */
export default interface IECPresentationTreeDataProvider extends TreeDataProvider, IECPresentationDataProvider {
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
