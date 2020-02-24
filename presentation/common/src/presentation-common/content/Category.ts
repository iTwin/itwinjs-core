/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Content
 */

/**
 * A data structure that describes a [[Field]] category.
 * @public
 */
export interface CategoryDescription {
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
