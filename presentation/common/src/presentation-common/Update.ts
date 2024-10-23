/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { NodeKey, NodeKeyJSON } from "./hierarchy/Key";
import { Node, NodeJSON, PartialNode, PartialNodeJSON } from "./hierarchy/Node";

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
 * JSON representation of [[PartialHierarchyModification]].
 * @public
 * @deprecated in 3.x. Use [[PartialHierarchyModification]]
 */
// eslint-disable-next-line @typescript-eslint/no-deprecated
export type PartialHierarchyModificationJSON = NodeInsertionInfoJSON | NodeDeletionInfoJSON | NodeUpdateInfoJSON;

/**
 * Information about a hierarchy change: insertion, deletion or node update.
 * @public
 */
export type PartialHierarchyModification = NodeInsertionInfo | NodeDeletionInfo | NodeUpdateInfo;

/** @public */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export namespace PartialHierarchyModification {
  /**
   * Serialize given object to JSON.
   * @deprecated in 3.x. Use [[PartialHierarchyModification]]
   */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  export function toJSON(obj: PartialHierarchyModification): PartialHierarchyModificationJSON {
    switch (obj.type) {
      case "Insert":
        return {
          type: "Insert",
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          parent: obj.parent === undefined ? undefined : NodeKey.toJSON(obj.parent),
          position: obj.position,
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          node: Node.toJSON(obj.node),
        };

      case "Update":
        return {
          type: "Update",
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          target: NodeKey.toJSON(obj.target),
          changes: Node.toPartialJSON(obj.changes),
        };

      case "Delete":
        return {
          type: "Delete",
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          parent: obj.parent === undefined ? undefined : NodeKey.toJSON(obj.parent),
          position: obj.position,
        };
    }
  }

  /**
   * Deserialize given object from JSON
   * @deprecated in 3.x. Use [[PartialHierarchyModification]]
   */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  export function fromJSON(json: PartialHierarchyModificationJSON): PartialHierarchyModification {
    switch (json.type) {
      case "Insert":
        return {
          type: "Insert",
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          parent: json.parent === undefined ? undefined : NodeKey.fromJSON(json.parent),
          position: json.position,
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          node: Node.fromJSON(json.node),
        };

      case "Update":
        return {
          type: "Update",
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          target: NodeKey.fromJSON(json.target),
          changes: Node.fromPartialJSON(json.changes),
        };

      case "Delete":
        return {
          type: "Delete",
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          parent: json.parent === undefined ? undefined : NodeKey.fromJSON(json.parent),
          position: json.position,
        };
    }
  }
}

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
 * JSON representation of [[NodeInsertionInfo]].
 * @public
 * @deprecated in 3.x. Use [[NodeInsertionInfo]]
 */
export interface NodeInsertionInfoJSON {
  type: "Insert";
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  parent?: NodeKeyJSON;
  position: number;
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  node: NodeJSON;
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
 * JSON representation of [[NodeDeletionInfo]].
 * @public
 * @deprecated in 3.x. Use [[NodeDeletionInfo]]
 */
export interface NodeDeletionInfoJSON {
  type: "Delete";
  /** Parent of the deleted node */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  parent?: NodeKeyJSON;
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
 * JSON representation of [[NodeUpdateInfo]].
 * @public
 * @deprecated in 3.x. Use [[NodeUpdateInfo]]
 */
export interface NodeUpdateInfoJSON {
  type: "Update";
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  target: NodeKeyJSON;
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  changes: PartialNodeJSON;
}

/**
 * JSON representation of [[HierarchyCompareInfo]].
 * @public
 * @deprecated in 3.x. Use [[HierarchyCompareInfo]].
 */
export interface HierarchyCompareInfoJSON {
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  changes: PartialHierarchyModificationJSON[];
  continuationToken?: {
    prevHierarchyNode: string;
    currHierarchyNode: string;
  };
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

/** @public */
export namespace HierarchyCompareInfo {
  /**
   * Serialize given object to JSON.
   * @deprecated in 3.x. Use [[HierarchyCompareInfo]]
   */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  export function toJSON(obj: HierarchyCompareInfo): HierarchyCompareInfoJSON {
    return {
      ...obj,
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      changes: obj.changes.map((change) => PartialHierarchyModification.toJSON(change)),
    };
  }

  /**
   * Deserialize given object from JSON
   * @deprecated in 3.x. Use [[HierarchyCompareInfo]]
   */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  export function fromJSON(json: HierarchyCompareInfoJSON): HierarchyCompareInfo {
    return {
      ...json,
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      changes: json.changes.map((change) => PartialHierarchyModification.fromJSON(change)),
    };
  }
}
