/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Code, IModel } from "./IModel";
import { Entity, EntityProps } from "./Entity";
import { ClassRegistry } from "./ClassRegistry";
import { JsonUtils } from "@bentley/bentleyjs-core/lib/JsonUtils";
import { LRUMap } from "@bentley/bentleyjs-core/lib/LRUMap";
import { BentleyPromise } from "@bentley/bentleyjs-core/lib/Bentley";
import { DgnDbStatus } from "@bentley/imodeljs-dgnplatform/lib/DgnDb";
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";

export interface ModelProps extends EntityProps {
  id: Id64 | string;
  modeledElement: Id64;
  parentModel?: Id64;
  isPrivate?: boolean;
  isTemplate?: boolean;
  jsonProperties?: any;
}

/** A Model within an iModel */
export class Model extends Entity implements ModelProps {
  public modeledElement: Id64;
  public parentModel: Id64;
  public jsonProperties: any;
  public isPrivate: boolean;
  public isTemplate: boolean;

  constructor(props: ModelProps) {
    super(props);
    this.id = new Id64(props.id);
    this.modeledElement = new Id64(props.modeledElement);
    this.parentModel = new Id64(props.parentModel);
    this.isPrivate = JsonUtils.asBool(props.isPrivate);
    this.isTemplate = JsonUtils.asBool(props.isTemplate);
    this.jsonProperties = Object.assign({}, props.jsonProperties); // make sure we have our own copy
  }
  /** Add all custom-handled properties to a json object. */
  public toJSON(): any {
    const val = super.toJSON();
    if (this.id.isValid())
      val.id = this.id;
    if (this.modeledElement.isValid())
      val.modeledElement = this.modeledElement;
    if (this.parentModel.isValid())
      val.parentModel = this.parentModel;
    if (this.isPrivate)
      val.isPrivate = this.isPrivate;
    if (this.isTemplate)
      val.isTemplate = this.isTemplate;
    if (Object.keys(this.jsonProperties).length > 0)
      val.jsonProperties = this.jsonProperties;
    return val;
  }
}

/** A geometric model */
export class GeometricModel extends Model {
}

/** a request to load a model. */
export interface ModelLoadParams {
  id?: Id64 | string;
  code?: Code;
}

/** The collection of Models in an iModel  */
export class Models {
  private _iModel: IModel;
  private _loaded: LRUMap<string, Model>;

  public constructor(iModel: IModel, max: number = 500) { this._iModel = iModel; this._loaded = new LRUMap<string, Model>(max); }

  /**
   * Get an Model by Id or Code.
   * @param opts  Either the id or the code of the model
   * @returns The Model or undefined if the model is not found
   */
  public async getModel(opts: ModelLoadParams): BentleyPromise<DgnDbStatus, Model | undefined> {
    // first see if the model is already in the local cache.
    if (opts.id) {
      const loaded = this._loaded.get(opts.id.toString());
      if (loaded)
        return { result: loaded };
    }

    // Must go get the model from the iModel. Start by requesting the model's data.
    const getObj = await this._iModel.getModel(JSON.stringify(opts));
    if (getObj.error || !getObj.result) { // todo: Shouldn't getObj.result always be non-empty if there is no error?
      return { result: undefined }; // we didn't find an element with the specified identity. That's not an error, just an empty result.
    }
    const json = getObj.result;

    const props = JSON.parse(json) as ModelProps;
    props.iModel = this._iModel;

    const modelObj = await ClassRegistry.createInstance(props);
    if (modelObj.error)
      return { error: modelObj.error };

    const model = modelObj.result as Model;
    assert(modelObj.result instanceof Model);

    // We have created the model. Cache it before we return it.
    model.setPersistent(); // models in the cache must be immutable and in their just-loaded state. Freeze it to enforce that
    this._loaded.set(model.id.toString(), model);
    return { result: model };
  }

  /** The Id of the repository model. */
  public get repositoryModelId(): Id64 { return new Id64("0x1"); }
}
