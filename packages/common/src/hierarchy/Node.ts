/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Hierarchies */

import { NodeKey, NodeKeyJSON, fromJSON as nodeKeyFromJSON } from "./Key";

/**
 * Data structure that describes a tree node.
 */
export default interface Node {
  /** A key that uniquely identifies a node. */
  key: NodeKey;
  /** Display label */
  label: string;
  /** Extensive description */
  description?: string;
  /** Image ID */
  imageId?: string;
  /** Foreground color */
  foreColor?: string;
  /** Background color */
  backColor?: string;
  /** Font style */
  fontStyle?: string;
  /** Does this node have child nodes */
  hasChildren?: boolean;
  /** Is this node selectable */
  isSelectable?: boolean;
  /** Is this node editable */
  isEditable?: boolean;
  /** Is this node expanded */
  isExpanded?: boolean;
  /** Is checkbox visible for this node */
  isCheckboxVisible?: boolean;
  /** Is this node's checkbox checked */
  isChecked?: boolean;
  /** Is this node's checkbox enabled */
  isCheckboxEnabled?: boolean;
}

/** Serialized [[Node]] JSON representation. */
export interface NodeJSON {
  key: NodeKeyJSON;
  label: string;
  description?: string;
  imageId?: string;
  foreColor?: string;
  backColor?: string;
  fontStyle?: string;
  hasChildren?: boolean;
  isSelectable?: boolean;
  isEditable?: boolean;
  isExpanded?: boolean;
  isCheckboxVisible?: boolean;
  isChecked?: boolean;
  isCheckboxEnabled?: boolean;
}

/**
 * Deserialize node from JSON
 * @param json JSON or JSON serialized to string to deserialize from
 * @returns Deserialized node
 */
export const fromJSON = (json: NodeJSON | string): Node => {
  if (typeof json === "string")
    return JSON.parse(json, reviver);
  return Object.assign({}, json, {
    key: nodeKeyFromJSON(json.key),
  });
};

/**
 * Reviver function that can be used as a second argument for
 * `JSON.parse` method when parsing [[Node]] objects.
 */
export const reviver = (key: string, value: any): any => {
  return key === "" ? fromJSON(value) : value;
};

/**
 * Deserialize nodes list from JSON
 * @param json JSON or JSON serialized to string to deserialize from
 * @returns Deserialized nodes list
 */
export const listFromJSON = (json: NodeJSON[] | string): Node[] => {
  if (typeof json === "string")
    return JSON.parse(json, listReviver);
  return json.map((m) => fromJSON(m));
};

/**
 * Reviver function that can be used as a second argument for
 * `JSON.parse` method when parsing [[Node]][] objects.
 */
export const listReviver = (key: string, value: any): any => {
  return key === "" ? listFromJSON(value) : value;
};
