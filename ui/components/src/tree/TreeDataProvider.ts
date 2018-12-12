/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import { CheckBoxState } from "@bentley/ui-core";
import { PageOptions } from "../common/PageOptions";
import { BeEvent } from "@bentley/bentleyjs-core";

/**
 * A node item which can be displayed in a tree.
 */
export interface TreeNodeItem {
  id: string;
  parentId?: string;
  label: string;
  description?: string;
  autoExpand?: boolean;
  labelForeColor?: number;
  labelBackColor?: number;
  labelBold?: boolean;
  labelItalic?: boolean;
  icon?: string;
  isCheckboxVisible?: boolean;
  isCheckboxDisabled?: boolean;
  checkBoxState?: CheckBoxState;
  extendedData?: any;
  isEditable?: boolean;
  /** Primitive typename. See PropertyRecord.PropertyDescription */
  typename?: string;
}

/** A [[TreeNodeItem]] for immediately loaded trees */
export interface ImmediatelyLoadedTreeNodeItem extends TreeNodeItem {
  children?: TreeNodeItem[];
}

/** A [[TreeNodeItem]] for delay-loaded trees */
export interface DelayLoadedTreeNodeItem extends TreeNodeItem {
  hasChildren?: boolean;
}

/** Array of tree node data elements */
export type TreeDataProviderRaw = ImmediatelyLoadedTreeNodeItem[];

/** A Promise for TreeDataProviderRaw */
export type TreeDataProviderPromise = Promise<TreeDataProviderRaw>;

/** Signature for a method that returns TreeDataProviderPromise for supplied parent node */
export type TreeDataProviderMethod = (node?: TreeNodeItem) => Promise<DelayLoadedTreeNodeItem[]>;

/** Interface for a tree data provider class */
export interface ITreeDataProvider {
  onTreeNodeChanged?: BeEvent<TreeDataChangesListener>;
  getNodesCount(parent?: TreeNodeItem): Promise<number>;
  getNodes(parent?: TreeNodeItem, page?: PageOptions): Promise<DelayLoadedTreeNodeItem[]>;
}

/** Type definition for all BeInspireTree data providers */
export type TreeDataProvider = TreeDataProviderRaw | TreeDataProviderPromise | TreeDataProviderMethod | ITreeDataProvider;

/** Checks if [[TreeDataProvider]] is a [[TreeDataProviderRaw]] */
export const isTreeDataProviderRaw = (provider: TreeDataProvider): provider is TreeDataProviderRaw => {
  return Array.isArray(provider);
};
/** Checks if [[TreeDataProvider]] is a [[TreeDataProviderPromise]] */
export const isTreeDataProviderPromise = (provider: TreeDataProvider): provider is TreeDataProviderPromise => {
  return (undefined !== (provider as TreeDataProviderPromise).then);
};
/** Checks if [[TreeDataProvider]] is a [[TreeDataProviderMethod]] */
export const isTreeDataProviderMethod = (provider: TreeDataProvider): provider is TreeDataProviderMethod => {
  return (typeof provider === "function");
};
/** Checks if [[TreeDataProvider]] is an [[ITreeDataProvider]] */
export const isTreeDataProviderInterface = (provider: TreeDataProvider): provider is ITreeDataProvider => {
  const candidate = provider as ITreeDataProvider;
  return undefined !== candidate.getNodes && undefined !== candidate.getNodesCount;
};
/**
 * Determines whether node has children
 * @param node node to check
 * @returns whether node has children
 */
export const hasChildren = (node: TreeNodeItem) => {
  const nodeAsImmediate = node as ImmediatelyLoadedTreeNodeItem;
  if ("children" in nodeAsImmediate && nodeAsImmediate.children && nodeAsImmediate.children.length > 0)
    return true;
  const nodeAsDelayed = node as DelayLoadedTreeNodeItem;
  if ("hasChildren" in nodeAsDelayed && nodeAsDelayed.hasChildren)
    return true;
  return false;
};

/**
 * An interface tree data change listeners.
 * Contains a list of nodes that changed or undefined if root level changed.
 */
export type TreeDataChangesListener = (nodes: Array<TreeNodeItem | undefined>) => void;

/**
 * EditableTreeDataProvider provides cell editing processing for the Tree.
 */
export interface EditableTreeDataProvider extends ITreeDataProvider {
  updateLabel(nodeItem: TreeNodeItem, newLabel: string): void;
}

/**
 * MutableTreeDataProvider provides manipulation processing for the Tree.
 * Useful for Drag & Drop processing.
 */
export interface MutableTreeDataProvider extends ITreeDataProvider {
  insertNode(parent: TreeNodeItem | undefined, child: TreeNodeItem, index?: number): void;
  removeNode(parent: TreeNodeItem | undefined, child: TreeNodeItem): void;
  moveNode(parent: TreeNodeItem | undefined, newParent: TreeNodeItem | undefined, child: TreeNodeItem, index?: number): void;

  isDescendent(parent: TreeNodeItem | undefined, nodeItem: TreeNodeItem): boolean;
  getNodeIndex(parent: TreeNodeItem | undefined, child: TreeNodeItem): number;
}
