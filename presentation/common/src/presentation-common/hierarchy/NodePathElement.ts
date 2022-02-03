/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Hierarchies
 */

import type { NodeJSON } from "./Node";
import { Node } from "./Node";

/**
 * Serialized [[NodePathElement]] JSON representation.
 * @public
 */
export interface NodePathElementJSON {
  node: NodeJSON;
  index: number;
  isMarked?: boolean;
  children: NodePathElementJSON[];
  filteringData?: NodePathFilteringDataJSON;
}

/**
 * Describes a single step in the nodes path.
 * @public
 */
export interface NodePathElement {
  /** Node instance */
  node: Node;
  /** Node index  */
  index: number;
  /** Is this element part of the marked path */
  isMarked?: boolean;
  /** Child path elements */
  children: NodePathElement[];
  /** Additional filtering-related information */
  filteringData?: NodePathFilteringData;
}

/** @public */
export namespace NodePathElement {
  /** Serialize given [[NodePathElement]] to JSON */
  export function toJSON(npe: NodePathElement): NodePathElementJSON {
    const result: NodePathElementJSON = {
      node: Node.toJSON(npe.node),
      index: npe.index,
      children: npe.children.map(NodePathElement.toJSON),
    };
    if (undefined !== npe.isMarked)
      result.isMarked = npe.isMarked;
    if (undefined !== npe.filteringData)
      result.filteringData = NodePathFilteringData.toJSON(npe.filteringData);
    return result;
  }

  /** Deserialize [[NodePathElement]] from JSON */
  export function fromJSON(json: NodePathElementJSON | string): NodePathElement {
    if (typeof json === "string")
      return JSON.parse(json, reviver);
    const result: NodePathElement = {
      index: json.index,
      node: Node.fromJSON(json.node),
      children: listFromJSON(json.children),
    };
    if (undefined !== json.isMarked)
      result.isMarked = json.isMarked;
    if (undefined !== json.filteringData)
      result.filteringData = NodePathFilteringData.fromJSON(json.filteringData);
    return result;
  }

  /**
   * Reviver function that can be used as a second argument for
   * `JSON.parse` method when parsing [[NodePathElement]] objects.
   *
   * @internal
   */
  export function reviver(key: string, value: any): any {
    return key === "" ? fromJSON(value) : value;
  }

  /**
   * Deserialize [[NodePathElement]] list from JSON
   * @param json JSON or JSON serialized to string to deserialize from
   * @returns Deserialized [[NodePathElement]] list
   *
   * @internal
   */
  export function listFromJSON(json: NodePathElementJSON[] | string): NodePathElement[] {
    if (typeof json === "string")
      return JSON.parse(json, listReviver);
    return json.map((m) => fromJSON(m));
  }

  /**
   * Reviver function that can be used as a second argument for
   * `JSON.parse` method when parsing [[NodePathElement]][] objects.
   *
   * @internal
   */
  export function listReviver(key: string, value: any): any {
    return key === "" ? listFromJSON(value) : value;
  }
}

/**
 * Serialized [[NodePathFilteringData]] JSON representation.
 * @public
 */
export interface NodePathFilteringDataJSON {
  occurances: number;
  childrenOccurances: number;
}

/**
 * Data related to node hierarchy filtering
 * @public
 */
export interface NodePathFilteringData {
  /** Number of filter matches in the current element */
  matchesCount: number;
  /** Number of filter matches in the current element's children (recursively) */
  childMatchesCount: number;
}

/** @public */
export namespace NodePathFilteringData {
  /** Serialize given [[NodePathFilteringData]] to JSON */
  export function toJSON(npfd: NodePathFilteringData): NodePathFilteringDataJSON {
    return {
      occurances: npfd.matchesCount,
      childrenOccurances: npfd.childMatchesCount,
    };
  }

  /** Deserialize [[NodePathFilteringData]] from JSON */
  export function fromJSON(json: NodePathFilteringDataJSON): NodePathFilteringData {
    return {
      matchesCount: json.occurances,
      childMatchesCount: json.childrenOccurances,
    };
  }
}
