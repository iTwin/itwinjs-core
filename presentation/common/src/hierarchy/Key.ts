/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Hierarchies */

import { InstanceKey, InstanceKeyJSON, instanceKeyFromJSON } from "../EC";

/**
 * Standard node types
 */
export enum StandardNodeTypes {
  ECInstanceNode = "ECInstanceNode",
  ECClassGroupingNode = "ECClassGroupingNode",
  ECPropertyGroupingNode = "ECPropertyGroupingNode",
  DisplayLabelGroupingNode = "DisplayLabelGroupingNode",
}

/** One of the node key types */
export type NodeKey = BaseNodeKey | ECInstanceNodeKey | ECClassGroupingNodeKey | ECPropertyGroupingNodeKey | LabelGroupingNodeKey;

/** Node key path. Can be used to define path from root to some specific node */
export type NodeKeyPath = NodeKey[];

/**
 * Data structure that describes a basic node key
 */
export interface BaseNodeKey {
  /** Node type */
  type: string;
  /** Node hash path from root to the node whose key this is */
  pathFromRoot: string[];
}

/**
 * Data structure that describes an ECInstance node key
 */
export interface ECInstanceNodeKey extends BaseNodeKey {
  type: StandardNodeTypes.ECInstanceNode;
  /** [[InstanceKey]] of the ECInstance represented by the node */
  instanceKey: InstanceKey;
}

/**
 * Serialized [[ECInstanceNodeKey]] JSON representation.
 *
 * @hidden
 */
export interface ECInstanceNodeKeyJSON extends BaseNodeKey {
  type: StandardNodeTypes.ECInstanceNode;
  instanceKey: InstanceKeyJSON;
}

/**
 * Data structure that describes a grouping node key
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
 */
export interface ECClassGroupingNodeKey extends GroupingNodeKey {
  type: StandardNodeTypes.ECClassGroupingNode;
  /** Full name of the grouping ECClass */
  className: string;
}

/**
 * Data structure that describes an ECProperty grouping node key
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
 */
export interface LabelGroupingNodeKey extends GroupingNodeKey {
  type: StandardNodeTypes.DisplayLabelGroupingNode;
  /** Grouping display label */
  label: string;
}

/**
 * One of the serialized node key types
 *
 * @hidden
 */
export type NodeKeyJSON = BaseNodeKey | ECInstanceNodeKeyJSON | ECClassGroupingNodeKey | ECPropertyGroupingNodeKey | LabelGroupingNodeKey;

/**
 * Deserialize node key from JSON
 * @param json JSON or JSON serialized to string to deserialize from
 * @returns Deserialized node key
 *
 * @hidden
 */
export const nodeKeyFromJSON = (json: NodeKeyJSON): NodeKey => {
  switch (json.type) {
    case StandardNodeTypes.ECInstanceNode:
      return { ...json, instanceKey: instanceKeyFromJSON((json as ECInstanceNodeKeyJSON).instanceKey) };
    default:
      return { ...json };
  }
};

/** Checks if the supplied key is an [[ECInstanceNodeKey]] */
export const isInstanceNodeKey = (key: NodeKey): key is ECInstanceNodeKey => {
  return key.type === StandardNodeTypes.ECInstanceNode;
};

/** Checks if the supplied key is an [[ECClassGroupingNodeKey]] */
export const isClassGroupingNodeKey = (key: NodeKey): key is ECClassGroupingNodeKey => {
  return key.type === StandardNodeTypes.ECClassGroupingNode;
};

/** Checks if the supplied key is an [[ECPropertyGroupingNodeKey]] */
export const isPropertyGroupingNodeKey = (key: NodeKey): key is ECPropertyGroupingNodeKey => {
  return key.type === StandardNodeTypes.ECPropertyGroupingNode;
};

/** Checks if the supplied key is a [[LabelGroupingNodeKey]] */
export const isLabelGroupingNodeKey = (key: NodeKey): key is LabelGroupingNodeKey => {
  return key.type === StandardNodeTypes.DisplayLabelGroupingNode;
};

/** Checks if the supplied key is a grouping node key */
export const isGroupingNodeKey = (key: NodeKey): key is GroupingNodeKey => {
  return isClassGroupingNodeKey(key) || isPropertyGroupingNodeKey(key) || isLabelGroupingNodeKey(key);
};
