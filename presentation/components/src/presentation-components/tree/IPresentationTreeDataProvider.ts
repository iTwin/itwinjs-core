/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import { NodeKey, NodePathElement } from "@itwin/presentation-common";
import { ITreeDataProvider, TreeNodeItem } from "@itwin/components-react";
import { IPresentationDataProvider } from "../common/IPresentationDataProvider";

/**
 * Presentation tree data provider.
 * @public
 */
export interface IPresentationTreeDataProvider extends ITreeDataProvider, IPresentationDataProvider {
  /**
   * Returns a [[NodeKey]] from given [[TreeNodeItem]].
   */
  getNodeKey(node: TreeNodeItem): NodeKey;

  /**
   * Returns filtered node paths.
   */
  getFilteredNodePaths(filter: string): Promise<NodePathElement[]>;
}
