/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import { DelayLoadedTreeNodeItem, TreeNodeItem } from "@itwin/components-react";
import { Descriptor, NodeKey } from "@itwin/presentation-common";
import { PresentationInstanceFilterInfo } from "../instance-filter-builder/PresentationInstanceFilterBuilder";

/** @alpha */
export interface PresentationTreeNodeItemFilteringInfo {
  descriptor: Descriptor | (() => Promise<Descriptor>);
  active?: PresentationInstanceFilterInfo;
}

/** @alpha */
export interface PresentationTreeNodeItem extends DelayLoadedTreeNodeItem {
  key: NodeKey;
  filtering?: PresentationTreeNodeItemFilteringInfo;
}

/** @alpha */
export function isPresentationTreeNodeItem(item: TreeNodeItem): item is PresentationTreeNodeItem {
  return (item as PresentationTreeNodeItem).key !== undefined;
}
