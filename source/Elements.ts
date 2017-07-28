/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Element, Code, ElementParams } from "./Element";
import { IModel, Id } from "./IModel";
import { ClassRegistry } from "./ClassRegistry";
import { LRUMap } from "@bentley/bentleyjs-core/lib/LRUMap";

/**
 * Parameters to specify what element to load.
 * @export
 * @interface IElementLoad
 */
export interface IElementLoad {
  id?: Id | string;
  code?: Code;
  /**
   * if true, do not load the geometry of the element
   * @type {boolean}
   * @memberof IElementLoad
   */
  noGeometry?: boolean;
}

/** The collection of Elements in an iModel  */
export class Elements {
  private _iModel: IModel;
  private _loaded: LRUMap<string, Element>;

  public constructor(iModel: IModel, maxElements: number = 2000) { this._iModel = iModel; this._loaded = new LRUMap<string, Element>(maxElements); }

  /**
   * Get an element by Id or Code.
   * @param {IElementLoad} opts  Either the id or the code of the element
   * @returns {(Promise<Element | undefined>)} The Element or undefined if the Id is not found
   * @memberof Elements
   */
  public async getElement(opts: IElementLoad): Promise<Element | undefined> {
    // first see if the element is already in the local cache.
    if (opts.id) {
      const loaded = this._loaded.get(opts.id.toString());
      if (loaded)
        return loaded;
    }

    // Must go get the element from the iModel
    const p = new Promise<Element | undefined>((resolve, reject) => {

      // Start by requesting the element's data.
      this._iModel.getDgnDb().getElement(JSON.stringify(opts)).then((json: string) => {

        // When that comes back, try to create an element from the data.
        if (json.length === 0) {
          resolve(undefined); // we didn't find an element with the specified identity. That's not an error, just an empty result.
          return;
        }

        const stream = JSON.parse(json) as ElementParams;
        stream._iModel = this._iModel;

        let el = ClassRegistry.create(stream) as Element | undefined;

        if (el !== undefined) {
          // This is the normal case. We have the class, and it created an instance. Cache the instance and return it.
          this._loaded.set(el.id.toString(), el);
          resolve(el);
          return;
        }

        // If the create failed, that's probably because we don't yet have a class.
        // Request the ECClass metadata from the iModel and generate a class.
        ClassRegistry.generateClass(stream.schemaName, stream.className, this._iModel).then((_cls: any) => {

          // When that comes back, try again to create the element. This time it should work.
          el = ClassRegistry.create(stream) as Element | undefined;
          if (el) {
            // Now we are back in the normal case. We have the class, and we can create an instance. Cache the instance and return it.
            this._loaded.set(el.id.toString(), el);
            resolve(el);
            return;
          }

          // We got the class, but we still can't create an instance! I don't know what could be wrong!
          // TBD: assert(false);
          reject(undefined);

        }).catch((reason: any) => {
          // We couldn't get the class. That shouldn't happen.
          // TBD: assert(false);
          reject(reason);
        });

      }).catch((reason: any) => {
        // We couldn't get the element. That's normal.
        reject(reason);
      });

    });
    return p;
  }

}
