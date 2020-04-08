/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { Node } from "./hierarchy/Node";

/** @alpha */
export const UPDATE_FULL = "FULL";

/** @alpha */
export interface UpdateInfo {
  [rulesetId: string]: {
    hierarchy?: HierarchyUpdateInfo;
    content?: ContentUpdateInfo;
  };
}

/** @alpha */
export type HierarchyUpdateInfo = typeof UPDATE_FULL | Array<NodeInsertionInfo | NodeDeletionInfo | NodeUpdateInfo>;

/** @alpha */
export type ContentUpdateInfo = typeof UPDATE_FULL;

/** @alpha */
export interface NodeInsertionInfo {
  type: "Insert";
  position: number;
  node: Node;
}

/** @alpha */
export interface NodeDeletionInfo {
  type: "Delete";
  node: Node;
}

/** @alpha */
export interface NodeUpdateInfo {
  type: "Update";
  node: Node;
  changes: Array<{
    name: string;
    old: unknown;
    new: unknown;
  }>;
}
