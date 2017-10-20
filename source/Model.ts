/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Entity, EntityProps } from "./Entity";
import { JsonUtils } from "@bentley/bentleyjs-core/lib/JsonUtils";
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

  /** Get the Id of the special dictionary model */
  public static getDictionaryId(): Id64 { return new Id64("0X10"); }
}

/** A geometric model */
export class GeometricModel extends Model {
}
