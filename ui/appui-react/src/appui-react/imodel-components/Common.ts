/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelComponents
 */

/**
 * An option of how class grouping should work in a component.
 * @beta
 */
export enum ClassGroupingOption {
  /** Class grouping is disabled */
  No,
  /** Class grouping is enabled */
  Yes,
  /** Class grouping is enabled and grouping node shows grouped items count */
  YesWithCounts,
}

/**
 * Data structure that describes info used to filter visibility tree.
 * @alpha
 */
export interface VisibilityTreeFilterInfo {
  filter: string;
  activeMatchIndex?: number;
}
