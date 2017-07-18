/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Element, Code, IElement } from "./Element";
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
    try {
      const json = await this._iModel.getDgnDb().getElement(JSON.stringify(opts));
      const stream: IElement = JSON.parse(json) as IElement;
      stream._iModel = this._iModel;
      let el = EcRegistry.create(stream) as Element | undefined;
      if (el === undefined) {
        await EcRegistry.generateClassFor(stream, this._iModel);
        el = EcRegistry.create(stream) as Element | undefined;
      }
      return el;
    } catch (e) {
      return undefined;
    }
  }
}
