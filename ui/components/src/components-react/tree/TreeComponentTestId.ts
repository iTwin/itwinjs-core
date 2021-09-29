
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

/**
 * Different tree component IDs that are assigned to those components as `data-testid` attribute
 * to help locate them in tests.
 *
 * @internal
 */
export enum TreeComponentTestId {
  Node = "tree-node",
  NodeContents = "tree-node-contents",
  NodeExpansionToggle = "tree-node-expansion-toggle",
  NodeCheckbox = "tree-node-checkbox",
}
