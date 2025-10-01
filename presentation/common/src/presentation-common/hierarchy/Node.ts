/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/no-deprecated */
/** @packageDocumentation
 * @module Hierarchies
 */

import { LabelDefinition } from "../LabelDefinition.js";
import { NodeKey } from "./Key.js";

/**
 * Data structure that describes a tree node.
 * @public
 * @deprecated in 5.2. Use the new [@itwin/presentation-hierarchies](https://github.com/iTwin/presentation/blob/master/packages/hierarchies/README.md)
 * package for creating hierarchies.
 */
export interface Node {
  /** A key that uniquely identifies a node. */
  key: NodeKey;
  /** Definition of node display label */
  label: LabelDefinition;
  /** Extensive description */
  description?: string;
  /**
   * Image ID
   * @deprecated in 3.3.0 - might be removed in next major version. Use [[extendedData]] instead. See [extended data usage page]($docs/presentation/customization/ExtendedDataUsage.md) for more details. Will
   * be removed with [[PropertyGroup.imageId]] and [[PropertyRangeGroupSpecification.imageId]].
   */
  imageId?: string;
  /** Does this node have child nodes */
  hasChildren?: boolean;
  /** Is this node selectable */
  isSelectionDisabled?: boolean;
  /** Is this node editable */
  isEditable?: boolean;
  /** Is this node expanded */
  isExpanded?: boolean;
  /**
   * Identifies whether the hierarchy level below this node supports filtering. If not, requesting either a hierarchy level descriptor or
   * a hierarchy level with [[HierarchyRequestOptions.instanceFilter]] will throw an error with [[PresentationStatus.InvalidArgument]] status.
   */
  supportsFiltering?: boolean;
  /** Extended data injected into this node */
  extendedData?: {
    [key: string]: any;
  };
}

/**
 * Partial node definition.
 * @public
 * @deprecated in 5.2. Use the new [@itwin/presentation-hierarchies](https://github.com/iTwin/presentation/blob/master/packages/hierarchies/README.md)
 * package for creating hierarchies.
 */
export type PartialNode = AllOrNone<Partial<Node>, "key" | "label">;

type AllOrNone<T, P extends keyof T> = Omit<T, P> & ({ [K in P]?: never } | Required<Pick<T, P>>);
