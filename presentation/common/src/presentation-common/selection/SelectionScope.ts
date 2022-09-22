/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UnifiedSelection
 */

/**
 * Data structure that describes a [selection scope]($docs/presentation/unified-selection/index#selection-scopes)
 *
 * @public
 */
export interface SelectionScope {
  /** Unique ID of the selection scope */
  id: string;
  /** Label */
  label: string;
  /** Description */
  description?: string;
}

/** @alpha */
export interface ElementSelectionScopeProps {
  id: "element";
  ancestorLevel?: number;
}

/** @alpha */
export type SelectionScopeProps = ElementSelectionScopeProps | { id: string };
