/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Hierarchies */

import { default as Node, NodeJSON, fromJSON as nodeFromJson } from "./Node";

/** Data related to node hierachy filtering */
export interface NodePathFilteringData {
  /** FilterText occurances in a node label */
  occurances: number;
  /** FilterText occurances in all of node children */
  childrenOccurances: number;
}

/**
 * Describes a single step in the nodes path.
 */
export default interface NodePathElement {
  node: Node;
  index: number;
  isMarked: boolean;
  children: NodePathElement[];
  filteringData?: NodePathFilteringData;
}

/** Serialized [[NodePathElement]] JSON representation. */
export interface NodePathElementJSON {
  node: NodeJSON;
  index: number;
  isMarked: boolean;
  children: NodePathElementJSON[];
  filteringData?: NodePathFilteringData;
}

/**
 * Deserialize [[NodePathElement]] from JSON
 * @param json JSON or JSON serialized to string to deserialize from
 * @returns Deserialized [[NodePathElement]]
 */
export const fromJSON = (json: NodePathElementJSON | string): NodePathElement => {
  if (typeof json === "string")
    return JSON.parse(json, reviver);
  return Object.assign({}, json, {
    node: nodeFromJson(json.node),
    children: listFromJSON(json.children),
  });
};

/**
 * Reviver function that can be used as a second argument for
 * `JSON.parse` method when parsing [[NodePathElement]] objects.
 */
export const reviver = (key: string, value: any): any => {
  return key === "" ? fromJSON(value) : value;
};

/**
 * Deserialize [[NodePathElement]] list from JSON
 * @param json JSON or JSON serialized to string to deserialize from
 * @returns Deserialized [[NodePathElement]] list
 */
export const listFromJSON = (json: NodePathElementJSON[] | string): NodePathElement[] => {
  if (typeof json === "string")
    return JSON.parse(json, listReviver);
  return json.map((m) => fromJSON(m));
};

/**
 * Reviver function that can be used as a second argument for
 * `JSON.parse` method when parsing [[NodePathElement]][] objects.
 */
export const listReviver = (key: string, value: any): any => {
  return key === "" ? listFromJSON(value) : value;
};
