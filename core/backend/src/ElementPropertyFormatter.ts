/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Element } from "./Element";
import { IModelDb } from "./IModelDb";

/** @module iModels */

/** @hidden */
export class ElementPropertyFormatter {

  private _iModel: IModelDb;

  /** Construct a formatter
   * @param iModel  The IModel that contains the elements that are to be formatted.
   * *** TBD: Take presentation rules as an argument?
   */
  public constructor(iModel: IModelDb) { this._iModel = iModel; }

  /**Format the properties of an element, suitable for display in a property browser.
   * The returned object will contain the formatted properties, organized according to the presentation rules.
   * For example, the immediate properties may represent categories of properties, where each category object contains the names and values of the properties in that category.
   * @param elem        The element to formatName of briefcase to query
   * *** TBD: Take presentation rules as an argument?
   * @returns the formatted properties of the element as an anonymous element
   */
  public formatProperties(elem: Element): any {

    // *** NEEDS WORK: We want to format the element's properties right here, using presentation rules.
    // ***             *For now* we must fall back on some hard-coded formatting logic in the native code library.
    // ***             This is a very bad work-around, as it formats the properties of the persistent element in the iModel, not the element passed in!
    const propsJson: string = this._iModel.getElementPropertiesForDisplay(elem.id.toString());
    const propsObj = JSON.parse(propsJson);
    if (!propsObj) {
      throw new Error("Invalid JSON");
    }

    return propsObj;
  }
}
