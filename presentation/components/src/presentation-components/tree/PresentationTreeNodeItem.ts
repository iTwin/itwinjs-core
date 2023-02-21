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
 * Data structure that describes information for tree item hierarchy level filtering.
 * @beta
 */
export interface PresentationTreeNodeItemFilteringInfo {
  /**
   * Descriptor that describes instances of this tree node item hierarchy level. It can be used to create instance
   * filter using [[PresentationInstanceFilterBuilder]].
   *
   * It can be set to a function in order to lazy load it.
   */
  descriptor: Descriptor | (() => Promise<Descriptor>);
  /** Currently active filter for this item hierarchy. */
  active?: PresentationInstanceFilterInfo;
}

/**
 * Data structure that describes tree node item created by [[PresentationTreeDataProvider]].
 * @beta
 */
export interface PresentationTreeNodeItem extends DelayLoadedTreeNodeItem {
  /** Node key of the node from which this item was created. */
  key: NodeKey;
  /** Information for this item hierarchy level filtering. */
  filtering?: PresentationTreeNodeItemFilteringInfo;
}

/**
 * Data structure that describes tree node item created by [[PresentationTreeDataProvider]]
 * which is used to carry information message.
 * @beta
 */
export interface PresentationInfoTreeNodeItem extends ImmediatelyLoadedTreeNodeItem {
  /** Message that his tree item is carrying. */
  message: string;
  /** Selection is disabled for this type of tree item. */
  isSelectionDisabled: true;
  /** This type of tree item cannot have children. */
  children: undefined;
}

/**
 * Function that checks if supplied [TreeNodeItem]($components-react) is [[PresentationTreeNodeItem]].
 * @beta
 */
export function isPresentationTreeNodeItem(item: TreeNodeItem): item is PresentationTreeNodeItem {
  return (item as PresentationTreeNodeItem).key !== undefined;
}

/**
 * Function that checks if supplied [TreeNodeItem]($components-react) is [[PresentationInfoTreeNodeItem]].
 * @beta
 */
export function isPresentationInfoTreeNodeItem(item: TreeNodeItem): item is PresentationInfoTreeNodeItem {
  return (item as PresentationInfoTreeNodeItem).message !== undefined;
}
