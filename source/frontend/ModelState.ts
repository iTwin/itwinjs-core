/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { EntityState } from "./EntityState";
import { JsonUtils } from "@bentley/bentleyjs-core/lib/JsonUtils";
import { Point2d } from "@bentley/geometry-core/lib/PointVector";
import { ModelProps, GeometricModel2dProps } from "../common/ModelProps";
import { AxisAlignedBox3d } from "../common/geometry/Primitives";
import { IModel } from "../common/IModel";

/** the state of a Model */
export abstract class ModelState extends EntityState implements ModelProps {
  public readonly modeledElement: Id64;
  public readonly jsonProperties: any;
  public readonly isPrivate: boolean;
  public readonly isTemplate: boolean;

  constructor(props: ModelProps, iModel: IModel) {
    super(props, iModel);
    this.modeledElement = Id64.fromJSON(props.modeledElement);
    this.isPrivate = JsonUtils.asBool(props.isPrivate);
    this.isTemplate = JsonUtils.asBool(props.isTemplate);
  }

  /** Add all custom-handled properties of a Model to a json object. */
  public toJSON(): ModelProps {
    const val = super.toJSON() as ModelProps;
    val.modeledElement = this.modeledElement;
    if (this.isPrivate)
      val.isPrivate = this.isPrivate;
    if (this.isTemplate)
      val.isTemplate = this.isTemplate;
    return val;
  }
  public getExtents(): AxisAlignedBox3d { return new AxisAlignedBox3d(); } // NEEDS_WORK
}

/** the state of a 3d Model */
export class Model3dState extends ModelState {
}

/** the state of a 2d Model */
export class Model2dState extends ModelState implements GeometricModel2dProps {
  public readonly globalOrigin: Point2d;
  constructor(props: GeometricModel2dProps, iModel: IModel) {
    super(props, iModel);
    this.globalOrigin = Point2d.fromJSON(props.globalOrigin);
  }

  public toJSON(): GeometricModel2dProps {
    const val = super.toJSON() as GeometricModel2dProps;
    val.globalOrigin = this.globalOrigin;
    return val;
  }
}
