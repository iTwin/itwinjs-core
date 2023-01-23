/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import { DelayLoadedTreeNodeItem, ImmediatelyLoadedTreeNodeItem, TreeNodeItem } from "@itwin/components-react";
import { Descriptor, NodeKey } from "@itwin/presentation-common";
import { PresentationInstanceFilterInfo } from "../instance-filter-builder/PresentationInstanceFilterBuilder";

/**
 * @alpha
 */
export interface PresentationTreeNodeItemFilteringInfo {
  descriptor: Descriptor | (() => Promise<Descriptor>);
  active?: PresentationInstanceFilterInfo;
}

/**
 * @alpha
 */
export interface PresentationTreeNodeItem extends DelayLoadedTreeNodeItem {
  key: NodeKey;
  filtering?: PresentationTreeNodeItemFilteringInfo;
}

/**
 * @alpha
 */
export interface PresentationInfoTreeNodeItem extends ImmediatelyLoadedTreeNodeItem {
  message: string;
  isSelectionDisabled: true;
  children: undefined;
}

/**
 * @alpha
 */
export function isPresentationTreeNodeItem(item: TreeNodeItem): item is PresentationTreeNodeItem {
  return (item as PresentationTreeNodeItem).key !== undefined;
}

/**
 * @alpha
 */
export function isPresentationInfoTreeNodeItem(item: TreeNodeItem): item is PresentationInfoTreeNodeItem {
  return (item as PresentationInfoTreeNodeItem).message !== undefined;
}
