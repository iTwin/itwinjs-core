/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module UnifiedSelection */

import { IModelToken } from "@bentley/imodeljs-common";
import { KeySet } from "@bentley/ecpresentation-common";
import SelectionChangeEvent from "./SelectionChangeEvent";

/**
 * Selection provider interface which provides main selection and sub-selection
 */
export default interface ISelectionProvider {
  /** An event that's fired when selection changes */
  selectionChange: SelectionChangeEvent;

  /** Get the selection stored in the provider.
   * @param imodelToken Token of the imodel connection which the selection is associated with.
   * @param level Level of the selection (see [Selection levels]($docs/learning/unified-selection/Terminology#selection-level))
   */
  getSelection(imodelToken: Readonly<IModelToken>, level: number): Readonly<KeySet>;
}
