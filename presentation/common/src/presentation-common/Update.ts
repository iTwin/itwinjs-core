/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/no-deprecated */
/** @packageDocumentation
 * @module Core
 */

import { NodeKey } from "./hierarchy/Key.js";
import { Node, PartialNode } from "./hierarchy/Node.js";

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
      /**
       * @deprecated in 5.2 - will not be removed until after 2026-10-01. Use the new [@itwin/presentation-hierarchies](https://github.com/iTwin/presentation/blob/master/packages/hierarchies/README.md)
       * package for creating hierarchies.
       */
      hierarchy?: HierarchyUpdateInfo;
      content?: ContentUpdateInfo;
    };
  };
}

/**
 * Information about a required hierarchy update.
 * @public
 * @deprecated in 5.2 - will not be removed until after 2026-10-01. Use the new [@itwin/presentation-hierarchies](https://github.com/iTwin/presentation/blob/master/packages/hierarchies/README.md)
 * package for creating hierarchies.
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
 * @deprecated in 5.2 - will not be removed until after 2026-10-01. Use the new [@itwin/presentation-hierarchies](https://github.com/iTwin/presentation/blob/master/packages/hierarchies/README.md)
 * package for creating hierarchies.
 */
export type PartialHierarchyModification = NodeInsertionInfo | NodeDeletionInfo | NodeUpdateInfo;

/**
 * Information about node insertion.
 * @public
 * @deprecated in 5.2 - will not be removed until after 2026-10-01. Use the new [@itwin/presentation-hierarchies](https://github.com/iTwin/presentation/blob/master/packages/hierarchies/README.md)
 * package for creating hierarchies.
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
 * @deprecated in 5.2 - will not be removed until after 2026-10-01. Use the new [@itwin/presentation-hierarchies](https://github.com/iTwin/presentation/blob/master/packages/hierarchies/README.md)
 * package for creating hierarchies.
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
 * @deprecated in 5.2 - will not be removed until after 2026-10-01. Use the new [@itwin/presentation-hierarchies](https://github.com/iTwin/presentation/blob/master/packages/hierarchies/README.md)
 * package for creating hierarchies.
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
 * @deprecated in 5.2 - will not be removed until after 2026-10-01. Use the new [@itwin/presentation-hierarchies](https://github.com/iTwin/presentation/blob/master/packages/hierarchies/README.md)
 * package for creating hierarchies.
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
