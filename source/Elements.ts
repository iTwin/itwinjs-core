/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Element, ElementProps } from "./Element";
import { Code, IModel } from "./IModel";
import { ClassRegistry } from "./ClassRegistry";
import { LRUMap } from "@bentley/bentleyjs-core/lib/LRUMap";
import { Guid, Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { assert } from "@bentley/bentleyjs-core/lib/Assert";

/** Parameters to specify what element to load. */
export interface ElementLoadParams {
  id?: Id64 | string;
  code?: Code;
  federationGuid?: string;
  /** if true, do not load the geometry of the element */
  noGeometry?: boolean;
}

/** The collection of Elements in an iModel  */
export class Elements {
  private _iModel: IModel;
  private _loaded: LRUMap<string, Element>;

  /** get the map of loaded elements */
  public get loaded() { return this._loaded; }

  public constructor(iModel: IModel, maxElements: number = 2000) { this._iModel = iModel; this._loaded = new LRUMap<string, Element>(maxElements); }

  /** Private implementation details of getElement */
  private async doGetElement(opts: ElementLoadParams): Promise<Element> {
    // first see if the element is already in the local cache.
    if (opts.id) {
      const loaded = this._loaded.get(opts.id.toString());
      if (loaded)
        return loaded;
    }

    // Must go get the element from the iModel. Start by requesting the element's data.
    const getObj = await this._iModel._getElementJson(JSON.stringify(opts));
    if (getObj.error || !getObj.result) { // todo: Shouldn't getObj.result always be non-empty if there is no error?
      return Promise.reject(new Error("Didn't find an element with the specified identity"));
    }
    const json = getObj.result;

    const props = JSON.parse(json) as ElementProps;
    props.iModel = this._iModel;

    const entity = await ClassRegistry.createInstance(props);
    const el = entity as Element;
    assert(el instanceof Element);

    // We have created the element. Cache it before we return it.
    el.setPersistent(); // elements in the cache must be immutable and in their just-loaded state. Freeze it to enforce that
    this._loaded.set(el.id.toString(), el);
    return el;
  }

  /** Get an element by Id, FederationGuid, or Code */
  public async getElement(elementId: Id64 | Guid | Code): Promise<Element> {
    if (elementId instanceof Id64) return this.doGetElement({ id: elementId });
    if (elementId instanceof Guid) return this.doGetElement({ federationGuid: elementId.toString() });
    if (elementId instanceof Code) return this.doGetElement({ code: elementId });
    assert(false);
    return Promise.reject(new Error("Invalid parameter passed to getElement"));
  }

  public async insertElement(el: Element): Promise<Id64> {
    assert(!el.isPersistent());
    return this._iModel.insertElement(JSON.stringify(el));
  }

  /** The Id of the root subject element. */
  public get rootSubjectId(): Id64 { return new Id64("0x1"); }

  /** Get the root subject element. */
  public async getRootSubject(): Promise<Element> { return this.getElement(this.rootSubjectId); }
}
