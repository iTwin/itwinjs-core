/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { Node, NodeJSON } from "./hierarchy/Node";

/** @alpha */
export const UPDATE_FULL = "FULL";

/** @alpha */
export interface UpdateInfoJSON {
  [rulesetId: string]: {
    hierarchy?: HierarchyUpdateInfoJSON;
    content?: ContentUpdateInfo;
  };
}

/** @alpha */
export interface UpdateInfo {
  [rulesetId: string]: {
    hierarchy?: HierarchyUpdateInfo;
    content?: ContentUpdateInfo;
  };
}

/** @alpha */
export namespace UpdateInfo {
  /** Serialize given object to JSON. */
  export function toJSON(obj: UpdateInfo): UpdateInfoJSON {
    const json: UpdateInfoJSON = {};
    for (const key in obj) {
      // istanbul ignore else
      if (obj.hasOwnProperty(key)) {
        json[key] = {
          hierarchy: obj[key].hierarchy ? HierarchyUpdateInfo.toJSON(obj[key].hierarchy!) : undefined,
          content: obj[key].content,
        };
      }
    }
    return json;
  }

  /** Deserialize given object from JSON */
  export function fromJSON(json: UpdateInfoJSON): UpdateInfo {
    const obj: UpdateInfo = {};
    for (const key in json) {
      // istanbul ignore else
      if (json.hasOwnProperty(key)) {
        obj[key] = {
          hierarchy: json[key].hierarchy ? HierarchyUpdateInfo.fromJSON(json[key].hierarchy!) : undefined,
          content: json[key].content,
        };
      }
    }
    return obj;
  }
}

/** @alpha */
export type HierarchyUpdateInfoJSON = typeof UPDATE_FULL | PartialHierarchyModificationJSON[];

/** @alpha */
export type HierarchyUpdateInfo = typeof UPDATE_FULL | PartialHierarchyModification[];

/** @alpha */
export namespace HierarchyUpdateInfo { // eslint-disable-line @typescript-eslint/no-redeclare
  /** Serialize given object to JSON. */
  export function toJSON(obj: HierarchyUpdateInfo): HierarchyUpdateInfoJSON {
    if (typeof obj === "string")
      return obj;
    return obj.map(PartialHierarchyModification.toJSON);
  }

  /** Deserialize given object from JSON */
  export function fromJSON(json: HierarchyUpdateInfoJSON): HierarchyUpdateInfo {
    if (typeof json === "string")
      return json;
    return json.map(PartialHierarchyModification.fromJSON);
  }
}

/** @alpha */
export type ContentUpdateInfo = typeof UPDATE_FULL;

/** @alpha */
export type PartialHierarchyModificationJSON = NodeInsertionInfoJSON | NodeDeletionInfoJSON | NodeUpdateInfoJSON;

/** @alpha */
export type PartialHierarchyModification = NodeInsertionInfo | NodeDeletionInfo | NodeUpdateInfo;

/** @alpha */
export namespace PartialHierarchyModification { // eslint-disable-line @typescript-eslint/no-redeclare
  /** Serialize given object to JSON. */
  export function toJSON(obj: PartialHierarchyModification): PartialHierarchyModificationJSON {
    return {
      ...obj,
      node: Node.toJSON(obj.node),
    };
  }

  /** Deserialize given object from JSON */
  export function fromJSON(json: PartialHierarchyModificationJSON): PartialHierarchyModification {
    return {
      ...json,
      node: Node.fromJSON(json.node),
    };
  }
}

/** @alpha */
export interface NodeInsertionInfo {
  type: "Insert";
  position: number;
  node: Node;
}

/** @alpha */
export interface NodeInsertionInfoJSON {
  type: "Insert";
  position: number;
  node: NodeJSON;
}

/** @alpha */
export interface NodeDeletionInfo {
  type: "Delete";
  node: Node;
}

/** @alpha */
export interface NodeDeletionInfoJSON {
  type: "Delete";
  node: NodeJSON;
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

/** @alpha */
export interface NodeUpdateInfoJSON {
  type: "Update";
  node: NodeJSON;
  changes: Array<{
    name: string;
    old: unknown;
    new: unknown;
  }>;
}
