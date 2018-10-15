/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Content */

/**
 * A data structure that describes a [[Field]] category.
 */
export default interface CategoryDescription {
  /** Unique name */
  name: string;
  /** Display label */
  label: string;
  /** Extensive description */
  description: string;
  /** Priority. Categories with higher priority should appear higher in the UI */
  priority: number;
  /** Should this category be auto-expanded when it's displayed in the UI */
  expand: boolean;
}
