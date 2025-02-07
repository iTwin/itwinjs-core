/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { NodeKey } from "./hierarchy/Key";
import { Node, PartialNode } from "./hierarchy/Node";

/**
 * A constant for indicating that a full update is required.
 * @public
 */
export const UPDATE_FULL = "FULL";

/**
 * A data structure that describes changes that need to be applied to the hierarchy and
 * content components due to some changes on the backend.
 *
 * @public
 */
export interface UpdateInfo {
  [imodel: string]: {
    [rulesetId: string]: {
      hierarchy?: HierarchyUpdateInfo;
      content?: ContentUpdateInfo;
    };
  };
}

/**
 * Information about a required hierarchy update.
 * @public
 */
export type HierarchyUpdateInfo = typeof UPDATE_FULL;

/**
 * Information about a required content update.
 * @public
 */
export type ContentUpdateInfo = typeof UPDATE_FULL;

/**
 * Information about a hierarchy change: insertion, deletion or node update.
 * @public
 */
export type PartialHierarchyModification = NodeInsertionInfo | NodeDeletionInfo | NodeUpdateInfo;

/**
 * Information about node insertion.
 * @public
 */
export interface NodeInsertionInfo {
  type: "Insert";
  /** Parent node key */
  parent?: NodeKey;
  /** Index of the new node under its parent */
  position: number;
  /** Inserted node */
  node: Node;
}

/**
 * Information about node deletion.
 * @public
 */
export interface NodeDeletionInfo {
  type: "Delete";
  /** Parent of the deleted node */
  parent?: NodeKey;
  /** Position of the deleted node among its siblings in the initial, not updated tree */
  position: number;
}

/**
 * Information about node update.
 * @public
 */
export interface NodeUpdateInfo {
  type: "Update";
  /** Key of the updated node */
  target: NodeKey;
  /** Updated node attributes */
  changes: PartialNode;
}

/**
 * Information about hierarchy modification / differences.
 * @public
 */
export interface HierarchyCompareInfo {
  /** A list of hierarchy changes */
  changes: PartialHierarchyModification[];
  /** Continuation token for requesting more changes. */
  continuationToken?: {
    prevHierarchyNode: string;
    currHierarchyNode: string;
  };
}
