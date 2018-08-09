/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module UnifiedSelection */

import { IModelConnection } from "@bentley/imodeljs-frontend";
import { KeySet } from "@bentley/presentation-common";
import SelectionChangeEvent from "./SelectionChangeEvent";

/**
 * Selection provider interface which provides main selection and sub-selection
 */
export default interface ISelectionProvider {
  /** An event that's fired when selection changes */
  selectionChange: SelectionChangeEvent;

  /** Get the selection stored in the provider.
   * @param imodel iModel connection which the selection is associated with.
   * @param level Level of the selection (see [Selection levels]($docs/learning/unified-selection/Terminology#selection-level))
   */
  getSelection(imodel: IModelConnection, level: number): Readonly<KeySet>;
}
