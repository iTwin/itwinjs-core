/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelToken } from "@bentley/imodeljs-common";
import { KeySet } from "@bentley/ecpresentation-common";
import SelectionChangeEvent from "./SelectionChangeEvent";

/** Selection provider interface which provides main selection and sub-selection */
export default interface ISelectionProvider {
  /** An event that's fired when selection changes */
  selectionChange: SelectionChangeEvent;

  /** Return selection.
   * @param imodelToken Token of the imodel connection with which the selection is associated.
   * @param level   Level of the selection.
   */
  getSelection(imodelToken: Readonly<IModelToken>, level: number): Readonly<KeySet>;
}
