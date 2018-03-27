/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { SelectedItem } from "./SelectedItem";
import { SelectionProvider } from "./SelectionProvider";
import { SelectionChangeEvent } from "./SelectionChangeEvent";
import { IModelToken } from "@bentley/imodeljs-common/lib/IModel";

export interface SelectionManager extends SelectionProvider {
  /** An event that's broadcasted when selection changes */
  selectionChange: SelectionChangeEvent;

  /** Add to selection.
   * @param[in] source The name of the selection source that is modifying the selection.
   * @param[in] imodelToken Token of the imodel connection with which the selection is associated.
   * @param[in] items The items to add to selection.
   * @param[in] level Level of the selection.
   * @param[in] rulesetId Id of the ruleset associated with the selection.
   */
  addToSelection(source: string, imodelToken: IModelToken, items: SelectedItem[], level: number, rulesetId?: string): void;

  /** Remove from selection.
   * @param[in] source The name of the selection source that is modifying the selection.
   * @param[in] imodelToken Token of the imodel connection with which the selection is associated.
   * @param[in] items The items to remove from selection.
   * @param[in] level Level of the selection.
   * @param[in] rulesetId Id of the ruleset associated with the selection.
   */
  removeFromSelection(source: string, imodelToken: IModelToken, items: SelectedItem[], level: number, rulesetId?: string): void;

  /** Change selection.
   * @param[in] source The name of the selection source that is modifying the selection.
   * @param[in] imodelToken Token of the imodel connection with which the selection is associated.
   * @param[in] items The items indicating the new selection.
   * @param[in] level Level of the selection.
   * @param[in] rulesetId Id of the ruleset associated with the selection.
   */
  replaceSelection(source: string, imodelToken: IModelToken, items: SelectedItem[], level: number, rulesetId?: string): void;

  /** Clear selection.
   * @param[in] source The name of the selection source that is modifying the selection.
   * @param[in] imodelToken Token of the imodel connection with which the selection is associated.
   * @param[in] level Level of the selection.
   * @param[in] rulesetId Id of the ruleset associated with the selection.
   */
  clearSelection(source: string, imodelToken: IModelToken, level: number, rulesetId?: string): void;

}
