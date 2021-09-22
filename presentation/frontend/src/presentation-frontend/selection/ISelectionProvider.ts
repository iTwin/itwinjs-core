/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UnifiedSelection
 */

import { IModelConnection } from "@itwin/core-frontend";
import { KeySet } from "@bentley/presentation-common";
import { SelectionChangeEvent } from "./SelectionChangeEvent";

/**
 * Selection provider interface which provides main selection and sub-selection.
 * @public
 */
export interface ISelectionProvider {
  /** An event that's fired when selection changes */
  selectionChange: SelectionChangeEvent;

  /** Get the selection stored in the provider.
   * @param imodel iModel connection which the selection is associated with.
   * @param level Level of the selection (see [Selection levels]($docs/learning/presentation/Unified-Selection/Terminology#selection-level))
   */
  getSelection(imodel: IModelConnection, level: number): Readonly<KeySet>;
}
