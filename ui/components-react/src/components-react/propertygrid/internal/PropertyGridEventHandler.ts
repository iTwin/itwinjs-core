/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module PropertyGrid
 */
import type { IPropertyGridModelSource } from "./PropertyGridModelSource";

/**
 * Handles events and changes on PropertyGridModel data.
 * @beta
 */
export interface IPropertyGridEventHandler {
  onExpansionToggled: (selectionKey: string) => void;
}

/**
 * Handles events and changes on PropertyGridModel data.
 * @beta
 */
export class PropertyGridEventHandler {
  public constructor(private _modelSource: IPropertyGridModelSource) {
  }

  /**
   * Flips isExpand on item by given selectionKey
   * @param selectionKey item to be modified
   */
  public onExpansionToggled = (selectionKey: string) => {
    this._modelSource.modifyModel((draftModel) => {
      const item = draftModel.getItem(selectionKey);
      item.isExpanded = !item.isExpanded;
    });
  };
}
