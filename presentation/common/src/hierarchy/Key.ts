/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Hierarchies */

import { InstanceKey, InstanceKeyJSON } from "../EC";

/**
 * Standard node types
 * @public
 */
export enum StandardNodeTypes {
  ECInstanceNode = "ECInstanceNode",
  ECClassGroupingNode = "ECClassGroupingNode",
  ECPropertyGroupingNode = "ECPropertyGroupingNode",
  DisplayLabelGroupingNode = "DisplayLabelGroupingNode",
}

/**
 * One of the node key types
 * @public
 */
export type NodeKey = BaseNodeKey | ECInstanceNodeKey | ECClassGroupingNodeKey | ECPropertyGroupingNodeKey | LabelGroupingNodeKey;
/** @public */
export namespace NodeKey {
  /**
   * Serialize given [[NodeKey]] to JSON
   * @internal
   */
  export function toJSON(key: NodeKey): NodeKeyJSON {
    if (isInstanceNodeKey(key))
      return { ...key, instanceKey: InstanceKey.toJSON(key.instanceKey) };
    return { ...key };
  }

  /**
   * Deserialize node key from JSON
   * @param json JSON or JSON serialized to string to deserialize from
   * @returns Deserialized node key
   *
   * @internal
   */
  export function fromJSON(json: NodeKeyJSON): NodeKey {
    if (isInstanceNodeKey(json))
      return { ...json, instanceKey: InstanceKey.fromJSON(json.instanceKey) };
    return { ...json };
  }

  /**
   * Checks if the supplied key is an [[ECInstanceNodeKey]]
   * @public
   */
  export function isInstanceNodeKey(key: NodeKey): key is ECInstanceNodeKey {
    return key.type === StandardNodeTypes.ECInstanceNode;
  }

  /**
   * Checks if the supplied key is an [[ECClassGroupingNodeKey]]
   * @public
   */
  export function isClassGroupingNodeKey(key: NodeKey): key is ECClassGroupingNodeKey {
    return key.type === StandardNodeTypes.ECClassGroupingNode;
  }

  /**
   * Checks if the supplied key is an [[ECPropertyGroupingNodeKey]]
   * @public
   */
  export function isPropertyGroupingNodeKey(key: NodeKey): key is ECPropertyGroupingNodeKey {
    return key.type === StandardNodeTypes.ECPropertyGroupingNode;
  }

  /**
   * Checks if the supplied key is a [[LabelGroupingNodeKey]]
   * @public
   */
  export function isLabelGroupingNodeKey(key: NodeKey): key is LabelGroupingNodeKey {
    return key.type === StandardNodeTypes.DisplayLabelGroupingNode;
  }

  /**
   * Checks if the supplied key is a grouping node key
   * @public
   */
  export function isGroupingNodeKey(key: NodeKey): key is GroupingNodeKey {
    return isClassGroupingNodeKey(key) || isPropertyGroupingNodeKey(key) || isLabelGroupingNodeKey(key);
  }
}

/**
 * Node key path. Can be used to define path from one node to another.
 * @public
 */
export type NodeKeyPath = NodeKey[];

/**
 * Data structure that describes a basic node key
 * @public
 */
export interface BaseNodeKey {
  /** Node type */
  type: string;
  /** Node hash path from root to the node whose key this is */
  pathFromRoot: string[];
}

/**
 * Data structure that describes an ECInstance node key
 * @public
 */
export interface ECInstanceNodeKey extends BaseNodeKey {
  type: StandardNodeTypes.ECInstanceNode;
  /** [[InstanceKey]] of the ECInstance represented by the node */
  instanceKey: InstanceKey;
}

/**
 * Serialized [[ECInstanceNodeKey]] JSON representation.
 * @internal
 */
export interface ECInstanceNodeKeyJSON extends BaseNodeKey {
  type: StandardNodeTypes.ECInstanceNode;
  instanceKey: InstanceKeyJSON;
}

/**
 * Data structure that describes a grouping node key
 * @public
 */
export interface GroupingNodeKey extends BaseNodeKey {
  /**
   * Get the number of instances grouped by the node represented
   * by this key.
   *
   * **Note:** this property is just a helper and is not involved
   * in identifying a node.
   */
  groupedInstancesCount: number;
}

/**
 * Data structure that describes an ECClass grouping node key
 * @public
 */
export interface ECClassGroupingNodeKey extends GroupingNodeKey {
  type: StandardNodeTypes.ECClassGroupingNode;
  /** Full name of the grouping ECClass */
  className: string;
}

/**
 * Data structure that describes an ECProperty grouping node key
 * @public
 */
export interface ECPropertyGroupingNodeKey extends GroupingNodeKey {
  type: StandardNodeTypes.ECPropertyGroupingNode;
  /** Full name of the grouping ECProperty class */
  className: string;
  /** Name of the ECProperty */
  propertyName: string;
  /** Grouping value */
  groupingValue: any;
}

/**
 * Data structure that describes a display label grouping node key
 * @public
 */
export interface LabelGroupingNodeKey extends GroupingNodeKey {
  type: StandardNodeTypes.DisplayLabelGroupingNode;
  /** Grouping display label */
  label: string;
}

/**
 * One of the serialized node key types
 * @internal
 */
export type NodeKeyJSON = BaseNodeKey | ECInstanceNodeKeyJSON | ECClassGroupingNodeKey | ECPropertyGroupingNodeKey | LabelGroupingNodeKey;
