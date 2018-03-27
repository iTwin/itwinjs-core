/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { SelectedItemsSet } from "./SelectedItemsSet";
import { IModelToken } from "@bentley/imodeljs-common/lib/IModel";

/** Selection provider interface which provides main selection and sub-selection */
export interface SelectionProvider {

  /** Return selection.
   * @param[in] imodelToken Token of the imodel connection with which the selection is associated.
   * @param[in] level   Level of the selection.
   */
  getSelection(imodelToken: IModelToken, level: number): Readonly<SelectedItemsSet>;
}
