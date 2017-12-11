/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { JsonUtils } from "@bentley/bentleyjs-core/lib/JsonUtils";
import { ModelProps } from "../common/ModelProps";
import { Entity } from "./Entity";
import { IModelDb } from "./IModelDb";

/**
 * A Model is a container for persisting a collection of related elements within an iModel.
 */
export class Model extends Entity implements ModelProps {
  public modeledElement: Id64;
  public jsonProperties: any;
  public isPrivate: boolean;
  public isTemplate: boolean;

  constructor(props: ModelProps, iModel: IModelDb) {
    super(props, iModel);
    this.id = Id64.fromJSON(props.id);
    this.modeledElement = Id64.fromJSON(props.modeledElement)!;
    this.isPrivate = JsonUtils.asBool(props.isPrivate);
    this.isTemplate = JsonUtils.asBool(props.isTemplate);
    this.jsonProperties = Object.assign({}, props.jsonProperties); // make sure we have our own copy
  }

  /** Add all custom-handled properties of a Model to a json object. */
  public toJSON(): ModelProps {
    const val = super.toJSON() as ModelProps;
    val.id = this.id;
    val.modeledElement = this.modeledElement;
    if (this.parentModel)
      val.parentModel = this.parentModel;
    if (this.isPrivate)
      val.isPrivate = this.isPrivate;
    if (this.isTemplate)
      val.isTemplate = this.isTemplate;
    if (Object.keys(this.jsonProperties).length > 0)
      val.jsonProperties = this.jsonProperties;
    return val;
  }

  /** Get the Id of the special dictionary model */
  public static getDictionaryId(): Id64 { return new Id64("0x10"); }
}

/**
 * A container for persisting geometric elements.
 */
export class GeometricModel extends Model {
  constructor(props: ModelProps, iModel: IModelDb) {
    super(props, iModel);
  }
}
