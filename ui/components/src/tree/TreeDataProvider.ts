/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
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
  description: string;
  hasChildren: boolean;
  labelForeColor?: number;
  labelBackColor?: number;
  labelBold?: boolean;
  labelItalic?: boolean;
  iconPath?: string;
  displayCheckBox?: boolean;
  checkBoxState?: CheckBoxState;
  isCheckBoxEnabled?: boolean;
  extendedData?: any;
}

/**
 * TreeDataProvider provides data to the DataTree.
 */
export interface TreeDataProvider {
  onTreeNodeChanged?: TreeDataChangeEvent;

  getRootNodesCount(): Promise<number>;
  getRootNodes(options?: PageOptions): Promise<ReadonlyArray<Readonly<TreeNodeItem>>>;
  getChildNodesCount(parentNode: TreeNodeItem): Promise<number>;
  getChildNodes(parentNode: TreeNodeItem, options?: PageOptions): Promise<ReadonlyArray<Readonly<TreeNodeItem>>>;
}

/** An interface Tree Data Change listeners */
export declare type TreeDataChangesListener = () => void;

/** Tree Data Change event */
export class TreeDataChangeEvent extends BeEvent<TreeDataChangesListener> { }

/**
 * MutableTreeDataProvider provides manipulation processing for the DataTree.
 * Useful for Drag & Drop processing.
 */
export interface MutableTreeDataProvider {

  addRootNode(rootNode: TreeNodeItem): void;
  insertRootNode(rootNode: TreeNodeItem, index: number): void;
  removeRootNode(rootNode: TreeNodeItem): void;
  moveRootNode(rootNode: TreeNodeItem, newIndex: number): void;

  addChildNode(parent: TreeNodeItem, child: TreeNodeItem): void;
  insertChildNode(parent: TreeNodeItem, child: TreeNodeItem, index: number): void;
  removeChildNode(parent: TreeNodeItem, child: TreeNodeItem): void;
  moveChildNode(parent: TreeNodeItem, child: TreeNodeItem, newIndex: number): void;

  isDescendent(parent: TreeNodeItem, nodeItem: TreeNodeItem): boolean;
  getRootNodeIndex(rootNode: TreeNodeItem): number;
  getChildNodeIndex(parent: TreeNodeItem, child: TreeNodeItem): number;
}
