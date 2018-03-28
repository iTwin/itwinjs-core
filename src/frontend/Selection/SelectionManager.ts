/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelToken } from "@bentley/imodeljs-common";
import { Keys } from "@bentley/ecpresentation-common";
import { SelectionProvider } from "./SelectionProvider";
import { SelectionChangeEvent } from "./SelectionChangeEvent";

export interface SelectionManager extends SelectionProvider {
  /** An event that's broadcasted when selection changes */
  selectionChange: SelectionChangeEvent;

  /** Add to selection.
   * @param[in] source The name of the selection source that is modifying the selection.
   * @param[in] imodelToken Token of the imodel connection with which the selection is associated.
   * @param[in] keys The keys to add to selection.
   * @param[in] level Level of the selection.
   * @param[in] rulesetId Id of the ruleset associated with the selection.
   */
  addToSelection(source: string, imodelToken: Readonly<IModelToken>, keys: Keys, level: number, rulesetId?: string): void;

  /** Remove from selection.
   * @param[in] source The name of the selection source that is modifying the selection.
   * @param[in] imodelToken Token of the imodel connection with which the selection is associated.
   * @param[in] keys The keys to remove from selection.
   * @param[in] level Level of the selection.
   * @param[in] rulesetId Id of the ruleset associated with the selection.
   */
  removeFromSelection(source: string, imodelToken: Readonly<IModelToken>, keys: Keys, level: number, rulesetId?: string): void;

  /** Change selection.
   * @param[in] source The name of the selection source that is modifying the selection.
   * @param[in] imodelToken Token of the imodel connection with which the selection is associated.
   * @param[in] keys The keys indicating the new selection.
   * @param[in] level Level of the selection.
   * @param[in] rulesetId Id of the ruleset associated with the selection.
   */
  replaceSelection(source: string, imodelToken: Readonly<IModelToken>, keys: Keys, level: number, rulesetId?: string): void;

  /** Clear selection.
   * @param[in] source The name of the selection source that is modifying the selection.
   * @param[in] imodelToken Token of the imodel connection with which the selection is associated.
   * @param[in] level Level of the selection.
   * @param[in] rulesetId Id of the ruleset associated with the selection.
   */
  clearSelection(source: string, imodelToken: Readonly<IModelToken>, level: number, rulesetId?: string): void;

}
