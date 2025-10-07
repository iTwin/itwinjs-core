/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/no-deprecated */
/** @packageDocumentation
 * @module Hierarchies
 */

import { Node } from "./Node.js";

/**
 * Describes a single step in the nodes path.
 * @public
 * @deprecated in 5.2 - will not be removed until after 2026-10-01. Use the new [@itwin/presentation-hierarchies](https://github.com/iTwin/presentation/blob/master/packages/hierarchies/README.md)
 * package for creating hierarchies.
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

/**
 * Data related to node hierarchy filtering
 * @public
 * @deprecated in 5.2 - will not be removed until after 2026-10-01. Use the new [@itwin/presentation-hierarchies](https://github.com/iTwin/presentation/blob/master/packages/hierarchies/README.md)
 * package for creating hierarchies.
 */
export interface NodePathFilteringData {
  /** Number of filter matches in the current element */
  matchesCount: number;
  /** Number of filter matches in the current element's children (recursively) */
  childMatchesCount: number;
}
