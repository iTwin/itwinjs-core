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
  [imodel: string]: {
    [rulesetId: string]: {
      hierarchy?: HierarchyUpdateInfoJSON;
      content?: ContentUpdateInfo;
    };
  };
}

/** @alpha */
export interface UpdateInfo {
  [imodel: string]: {
    [rulesetId: string]: {
      hierarchy?: HierarchyUpdateInfo;
      content?: ContentUpdateInfo;
    };
  };
}

/** @alpha */
export namespace UpdateInfo {
  /** Serialize given object to JSON. */
  export function toJSON(obj: UpdateInfo): UpdateInfoJSON {
    const json: UpdateInfoJSON = {};
    for (const imodel in obj) {
      // istanbul ignore if
      if (!obj.hasOwnProperty(imodel))
        continue;

      json[imodel] = {};
      const rulesetObj = obj[imodel];
      for (const rulesetId in rulesetObj) {
        // istanbul ignore if
        if (!rulesetObj.hasOwnProperty(rulesetId))
          continue;

        json[imodel][rulesetId] = {
          hierarchy: rulesetObj[rulesetId].hierarchy ? HierarchyUpdateInfo.toJSON(rulesetObj[rulesetId].hierarchy!) : undefined,
          content: rulesetObj[rulesetId].content,
        };
      }
    }
    return json;
  }

  /** Deserialize given object from JSON */
  export function fromJSON(json: UpdateInfoJSON): UpdateInfo {
    const obj: UpdateInfo = {};
    for (const imodel in json) {
      // istanbul ignore if
      if (!json.hasOwnProperty(imodel))
        continue;

      obj[imodel] = {};
      const rulesetJson = json[imodel];
      for (const rulesetId in rulesetJson) {
        // istanbul ignore if
        if (!rulesetJson.hasOwnProperty(rulesetId))
          continue;

        obj[imodel][rulesetId] = {
          hierarchy: rulesetJson[rulesetId].hierarchy ? HierarchyUpdateInfo.fromJSON(rulesetJson[rulesetId].hierarchy!) : undefined,
          content: rulesetJson[rulesetId].content,
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

/** @alpha */
export interface HierarchyCompareInfoJSON {
  changes: PartialHierarchyModificationJSON[];
  continuationToken?: {
    prevHierarchyNode: string;
    currHierarchyNode: string;
  };
}

/** @alpha */
export interface HierarchyCompareInfo {
  changes: PartialHierarchyModification[];
  continuationToken?: {
    prevHierarchyNode: string;
    currHierarchyNode: string;
  };
}

/** @alpha */
export namespace HierarchyCompareInfo {
  /** Serialize given object to JSON. */
  export function toJSON(obj: HierarchyCompareInfo): HierarchyCompareInfoJSON {
    return {
      ...obj,
      changes: obj.changes.map((change) => PartialHierarchyModification.toJSON(change)),
    };
  }

  /** Deserialize given object from JSON */
  export function fromJSON(json: HierarchyCompareInfoJSON): HierarchyCompareInfo {
    return {
      ...json,
      changes: json.changes.map((change) => PartialHierarchyModification.fromJSON(change)),
    };
  }
}
