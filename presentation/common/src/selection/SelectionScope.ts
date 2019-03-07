/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module UnifiedSelection */

/** Data structure that describes a [selection scope]($docs/learning/unified-selection/Terminology#selection-scope) */
export interface SelectionScope {
  id: string;
  label: string;
  description?: string;
}
