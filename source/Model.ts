/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id, Code, IModel } from "./IModel";
import { ECClass, ECClassProps } from "./ECClass";
import { ClassRegistry } from "./ClassRegistry";
import { JsonUtils } from "@bentley/bentleyjs-core/lib/JsonUtils";
import { LRUMap } from "@bentley/bentleyjs-core/lib/LRUMap";

export interface ModelProps extends ECClassProps {
  id: Id | string;
  modeledElement: Id;
  parentModel?: Id;
  isPrivate?: boolean;
  isTemplate?: boolean;
  jsonProperties?: any;
}

/** A Model within an iModel */
export class Model extends ECClass {

  public id: Id;
  public modeledElement: Id;
  public parentModel: Id;
  public jsonProperties: any;
  public isPrivate: boolean;
  public isTemplate: boolean;

  constructor(props: ModelProps) {
    super(props);
    this.id = new Id(props.id);
    this.modeledElement = new Id(props.modeledElement);
    this.parentModel = new Id(props.parentModel);
    this.isPrivate = JsonUtils.asBool(props.isPrivate);
    this.isTemplate = JsonUtils.asBool(props.isTemplate);
    this.jsonProperties = props.jsonProperties ? props.jsonProperties : {};
  }
}

/** A geometric model */
export class GeometricModel extends Model {
}

export interface ModelLoadParams {
  id?: Id | string;
  code?: Code;
  /** if true, do not load the geometry of the model */
  noGeometry?: boolean;
}

/** The collection of Models in an iModel  */
export class Models {
  private _iModel: IModel;
  private _loaded: LRUMap<string, Model>;

  public constructor(iModel: IModel, max: number = 2000) { this._iModel = iModel; this._loaded = new LRUMap<string, Model>(max); }

  /**
   * Get an Model by Id or Code.
   * @param opts  Either the id or the code of the model
   * @returns The Model or undefined if the Id is not found
   */
  public async getModel(opts: ModelLoadParams): Promise<Model | undefined> {
    // first see if the model is already in the local cache.
    if (opts.id) {
      const loaded = this._loaded.get(opts.id.toString());
      if (loaded)
        return loaded;
    }

    // Must go get the model from the iModel. Start by requesting the model's data.
    const json: string = await this._iModel.dgnDb.getModel(JSON.stringify(opts));
    if (json.length === 0) {
      return undefined; // we didn't find a Model with the specified identity. That's not an error, just an empty result.
    }

    const props = JSON.parse(json) as ModelProps;
    props.iModel = this._iModel;

    const model = await ClassRegistry.create(props);
    if (model !== undefined)
      this._loaded.set(model.id.toString(), model); // We have created the model. Cache it before we return it.

    return model;
  }
}
