/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Element, ElementProps } from "./Element";
import { Code, IModel, Id } from "./IModel";
import { ClassRegistry } from "./ClassRegistry";
import { LRUMap } from "@bentley/bentleyjs-core/lib/LRUMap";

/** Parameters to specify what element to load. */
export interface ElementLoadParams {
  id?: Id | string;
  code?: Code;
  /** if true, do not load the geometry of the element */
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
   * @returns The Element or undefined if the Id is not found
   */
  public async getElement(opts: ElementLoadParams): Promise<Element | undefined> {
    // first see if the element is already in the local cache.
    if (opts.id) {
      const loaded = this._loaded.get(opts.id.toString());
      if (loaded)
        return loaded;
    }

    // Must go get the element from the iModel. Start by requesting the element's data.
    const {error, result: json} = await this._iModel.dgnDb.getElement(JSON.stringify(opts));
    if (error || !json)
      return undefined; // we didn't find an element with the specified identity. That's not an error, just an empty result.

    const props = JSON.parse(json) as ElementProps;
    props.iModel = this._iModel;

    let el = ClassRegistry.create(props) as Element | undefined;

    if (el === undefined) {
      if (ClassRegistry.isClassRegistered(props.schemaName, props.className))
        return undefined;

      // Create failed because we don't yet have a class.
      // Request the ECClass metadata from the iModel, generate a class, and register it.
      await ClassRegistry.generateClass(props.schemaName, props.className, this._iModel);
      el = ClassRegistry.create(props) as Element | undefined;

      if (el === undefined)
        return undefined;
    }

    // We have created the element. Cache it and return it.
    this._loaded.set(el.id.toString(), el);
    return el;
  }
}
