/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Element, Code } from "./Element";
import { IModel, Id } from "./IModel";
import { EcRegistry } from "./EcRegistry";
import { LRUMap } from "@bentley/bentleyjs-common/lib/LRUMap";

//
export interface IElementLoad {
  id?: Id | string;
  code?: Code;
  noGeometry?: boolean;
}

/** The collection of Elements in an iModel  */
export class Elements {
  private _iModel: IModel;
  private _loaded: LRUMap<string, Element>;

  public constructor(iModel: IModel, maxElements: number = 2000) { this._iModel = iModel; this._loaded = new LRUMap<string, Element>(maxElements); }

  /**
   * Get an element by Id or Code.
   * @param opts  Either the id or the code of the element
   * @return the Element or undefined if the Id is not found
   */
  public async getElement(opts: IElementLoad): Promise<Element | undefined> {
    // first see if the element is already in the local cache.
    if (opts.id) {
      const loaded = this._loaded.get(opts.id.toString());
      if (loaded)
        return loaded;
    }

    const json = await this._iModel.getDgnDb().getElement(JSON.stringify(opts));

    const stream = JSON.parse(json);
    stream._iModel = this._iModel;

    const el = EcRegistry.create(stream, "BisCore.Element") as Element | undefined;
    if (el) { // found it, register it in the local cache.
      this._loaded.set(el.id.toString(), el);
    }
    return el;
  }
}
