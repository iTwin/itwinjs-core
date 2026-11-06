/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module SelectionSet
 */

import { Id64, Id64Arg, Id64Set } from "@itwin/core-bentley";
import { IModelConnection } from "../IModelConnection";
import { IModelDisplayReference } from "../IModelDisplayReference";
import { SelectionProcessing, SelectionToolBase } from "./SelectTool";

type ElementIdsByIModelConnection = Map<IModelConnection, Id64Arg>;

/** Tool for picking elements across all iModels displayed by a view.
 * @beta
 */
export class MultiIModelSelectionTool extends SelectionToolBase {
  public static override toolId = "MultiIModelSelect";

  protected override get allowExternalIModels(): boolean { return true; }

  public updateSelection(elementIds: ElementIdsByIModelConnection, process: SelectionProcessing): boolean {
    let returnValue = false;
    for (const [iModel, ids] of elementIds) {
      switch (process) {
        case SelectionProcessing.AddElementToSelection:
          if (iModel.selectionSet.add(ids))
            returnValue = true;
          break;
        case SelectionProcessing.RemoveElementFromSelection:
          if (iModel.selectionSet.remove(ids))
            returnValue = true;
          break;
        case SelectionProcessing.InvertElementInSelection:
          if (iModel.selectionSet.invert(ids))
            returnValue = true;
          break;
        case SelectionProcessing.ReplaceSelectionWithElement:
          iModel.selectionSet.replace(ids);
          returnValue = true;
          break;
        default:
          return false;
      }
    }

    if (SelectionProcessing.ReplaceSelectionWithElement === process) {
      for (const iModel of this.iModels) {
        if (!elementIds.has(iModel) && iModel.selectionSet.isActive) {
          iModel.selectionSet.emptyAll();
          returnValue = true;
        }
      }
    }

    if (returnValue)
      this.syncSelectionMode();

    return returnValue;
  }

  public async processSelection(elementIds: ElementIdsByIModelConnection, process: SelectionProcessing): Promise<boolean> { return this.updateSelection(elementIds, process); }

  protected override async processSelections(elementIds: ReadonlyMap<IModelDisplayReference, Id64Arg>, process: SelectionProcessing): Promise<boolean> {
    const byIModel = new Map<IModelConnection, Id64Set>();
    for (const [ref, ids] of elementIds) {
      let selectedIds = byIModel.get(ref.iModel);
      if (!selectedIds)
        byIModel.set(ref.iModel, selectedIds = new Set());

      for (const id of Id64.iterable(ids))
        selectedIds.add(id);
    }

    return this.processSelection(byIModel, process);
  }

  public static async startTool(): Promise<boolean> { return new MultiIModelSelectionTool().run(); }
}