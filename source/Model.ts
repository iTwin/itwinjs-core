/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id, Code, IModel } from "./IModel";
import { ECClass, ECClassProps } from "./ECClass";
import { ClassRegistry } from "./ClassRegistry";
import { LRUMap } from "@bentley/bentleyjs-core/lib/LRUMap";

export interface ModelProps extends ECClassProps {
  model: Id | string;
  modeledElement: Id;
  parentModel?: Id;
}

/** A Model within an iModel */
export class Model extends ECClass {

  public id: Id;
  public modeledElement: Id;
  public parentModel: Id;

  constructor(props: ModelProps)  {
    super(props);
  }
}

/** A geometric model */
export class GeometricModel extends Model {
}

export interface ModelLoadParams {
  id?: Id | string;
  code?: Code;
  /** if true, do not load the geometry of the element */
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
    // first see if the element is already in the local cache.
    if (opts.id) {
      const loaded = this._loaded.get(opts.id.toString());
      if (loaded)
        return loaded;
    }

    // Must go get the element from the iModel. Start by requesting the element's data.
    const {error, result: json} = await this._iModel.dgnDb.getModel(JSON.stringify(opts));
    if (error || !json)
      return undefined; // we didn't find a model with the specified identity. That's not an error, just an empty result.

    const props = JSON.parse(json) as ModelProps;
    props.iModel = this._iModel;

    let model = ClassRegistry.create(props) as Model | undefined;

    if (model === undefined) {
      if (ClassRegistry.isClassRegistered(props.schemaName, props.className))
        return undefined;

      // Create failed because we don't yet have a class.
      // Request the ECClass metadata from the iModel, generate a class, and register it.
      await ClassRegistry.generateClass(props.schemaName, props.className, this._iModel);
      model = ClassRegistry.create(props) as Model | undefined;

      if (model === undefined)
        return undefined;
    }

    // We have created the model. Cache it and return it.
    this._loaded.set(model.id.toString(), model);
    return model;
  }
}
