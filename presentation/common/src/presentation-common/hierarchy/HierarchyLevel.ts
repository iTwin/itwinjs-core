/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Hierarchies
 */

import { Node, NodeJSON } from "./Node";

/**
 * Defines a hierarchy level that consists of an array of nodes and possibly other information.
 * @alpha
 */
export interface HierarchyLevel {
  /** A list of nodes in a hierarchy level. */
  nodes: Node[];
  /**
   * Identifies whether the hierarchy level supports filtering. If not, requesting either a hierarchy level descriptor or
   * a hierarchy level with [[HierarchyRequestOptions.instanceFilter]] will throw an error with [[PresentationStatus.InvalidArgument]] status.
   */
  supportsFiltering?: boolean;
}

/**
 * JSON representation of [[HierarchyLevel]].
 * @alpha
 */
export interface HierarchyLevelJSON {
  nodes: NodeJSON[];
  supportsFiltering?: boolean;
}

/** @alpha */
export namespace HierarchyLevel {
  /** Deserialize [[HierarchyLevel]] from JSON */
  export function fromJSON(json: HierarchyLevelJSON): HierarchyLevel {
    return {
      ...json,
      nodes: json.nodes.map(Node.fromJSON),
    };
  }
}
