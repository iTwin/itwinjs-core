/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64 } from "@bentley/bentleyjs-core";
import { EntityState } from "./EntityState";
import { JsonUtils } from "@bentley/bentleyjs-core";
import { Point2d } from "@bentley/geometry-core";
import { ModelProps, GeometricModel2dProps } from "@bentley/imodeljs-common/lib/ModelProps";
import { AxisAlignedBox3d } from "@bentley/imodeljs-common/lib/geometry/Primitives";
import { IModelConnection } from "./IModelConnection";

/** the state of a Model */
export class ModelState extends EntityState implements ModelProps {
  public readonly modeledElement: Id64;
  public readonly name: string;
  public parentModel: Id64;
  public readonly jsonProperties: any;
  public readonly isPrivate: boolean;
  public readonly isTemplate: boolean;

  constructor(props: ModelProps, iModel: IModelConnection) {
    super(props, iModel);
    this.modeledElement = Id64.fromJSON(props.modeledElement);
    this.name = props.name ? props.name : "";
    this.parentModel = Id64.fromJSON(props.parentModel)!;
    this.isPrivate = JsonUtils.asBool(props.isPrivate);
    this.isTemplate = JsonUtils.asBool(props.isTemplate);
  }

  /** Add all custom-handled properties of a Model to a json object. */
  public toJSON(): ModelProps {
    const val = super.toJSON() as ModelProps;
    val.modeledElement = this.modeledElement;
    val.parentModel = this.parentModel;
    val.name = this.name;
    if (this.isPrivate)
      val.isPrivate = this.isPrivate;
    if (this.isTemplate)
      val.isTemplate = this.isTemplate;
    return val;
  }
  public getExtents(): AxisAlignedBox3d { return new AxisAlignedBox3d(); } // NEEDS_WORK
}

export class GeometricModelState extends ModelState { }

/** the state of a 2d Geometric Model */
export class GeometricModel2dState extends GeometricModelState implements GeometricModel2dProps {
  public readonly globalOrigin: Point2d;
  constructor(props: GeometricModel2dProps, iModel: IModelConnection) {
    super(props, iModel);
    this.globalOrigin = Point2d.fromJSON(props.globalOrigin);
  }

  public toJSON(): GeometricModel2dProps {
    const val = super.toJSON() as GeometricModel2dProps;
    val.globalOrigin = this.globalOrigin;
    return val;
  }
}

export class SpatialModelState extends GeometricModelState { }
export class DrawingModelState extends GeometricModel2dState { }
export class SectionDrawingModelState extends DrawingModelState { }
export class SheetModelState extends GeometricModel2dState { }
export class WebMercatorModel extends SpatialModelState { }
