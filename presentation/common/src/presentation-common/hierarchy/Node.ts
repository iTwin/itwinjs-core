/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Hierarchies
 */

import { LabelDefinition } from "../LabelDefinition";
import { NodeKey } from "./Key";

/**
 * Data structure that describes a tree node.
 * @public
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
   * @deprecated in 3.x. Use [[extendedData]] instead. See [extended data usage page]($docs/presentation/customization/ExtendedDataUsage.md) for more details.
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
 */
export type PartialNode = AllOrNone<Partial<Node>, "key" | "label">;

type AllOrNone<T, P extends keyof T> = Omit<T, P> & ({ [K in P]?: never } | Required<Pick<T, P>>);
