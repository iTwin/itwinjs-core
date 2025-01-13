/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UnifiedSelection
 */

/**
 * Data structure that describes a [selection scope]($docs/presentation/unified-selection/index#selection-scopes).
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

/**
 * A data structure that defines properties for applying element selection scope.
 * @public
 */
export interface ElementSelectionScopeProps {
  /** Identifies this as the "element" selection scope */
  id: "element";
  /**
   * Specifies how far "up" we should walk to find the target element. When not specified or `0`,
   * the target element matches the request element. When `1`, the target element matches the direct parent element.
   * When `2`, the target element is parent of the parent element and so on. In all situations when this is `> 0`,
   * we're not walking further than the last existing element, for example when `ancestorLevel = 1` (direct parent
   * element is requested), but the request element doesn't have a parent, the request element is returned as the result.
   */
  ancestorLevel?: number;
}

/**
 * A data structure that defines properties for applying a selection scope.
 * @public
 */
export type SelectionScopeProps = ElementSelectionScopeProps | { id: string };
