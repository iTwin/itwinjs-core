/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Hierarchies */

import { NodeKey } from "./Key";

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
