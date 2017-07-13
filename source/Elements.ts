/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Element } from "./Element";
import { IModel, Id } from "./IModel";
import { EcRegistry } from "./EcRegistry";

/** The collection of Elements in an iModel  */
export class Elements {
  private _iModel: IModel;
  public constructor(iModel: IModel) { this._iModel = iModel; }

  /**
   * Look up an element by Id.
   * @param id  The element Id to look up
   * @return the Element or undefined if the Id is not found
   */
  public async getElementById(id: Id): Promise<Element | undefined> {
    const json = await this._iModel.getDgnDb().getElementById(id.toString());
    const stream = JSON.parse(json);
    stream._iModel = this._iModel;
    return EcRegistry.create(stream, "BisCore.Element") as Element | undefined;
  }
}
