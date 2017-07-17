/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Element, Code } from "./Element";
import { IModel, Id } from "./IModel";
import { EcRegistry } from "./EcRegistry";

//
export interface IElementLoad {
  id?: Id | string;
  code?: Code;
  noGeometry?: boolean;
}

/** The collection of Elements in an iModel  */
export class Elements {
  private _iModel: IModel;
  public constructor(iModel: IModel) { this._iModel = iModel; }

  /**
   * Get an element by Id or Code.
   * @param opts  Either the id or the code of the element
   * @return the Element or undefined if the Id is not found
   */
  public async getElement(opts: IElementLoad): Promise<Element | undefined> {
    const json = await this._iModel.getDgnDb().getElement(JSON.stringify(opts));
    const stream = JSON.parse(json);
    stream._iModel = this._iModel;
    return EcRegistry.create(stream, "BisCore.Element") as Element | undefined;
  }
}
