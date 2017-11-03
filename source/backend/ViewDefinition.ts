/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { JsonUtils } from "@bentley/bentleyjs-core/lib/JsonUtils";
import { Vector3d, Point3d, Point2d, YawPitchRollAngles } from "@bentley/geometry-core/lib/PointVector";
import { Angle } from "@bentley/geometry-core/lib/Geometry";
import { ElementProps } from "../common/ElementProps";
import { Camera, ViewDefinitionProps, ViewDefinition3dProps, ViewDefinition2dProps, SpatialViewDefinitionProps, ModelSelectorProps, CategorySelectorProps } from "../common/ViewState";
import { DefinitionElement } from "./Element";

/** A DisplayStyle defines the parameters for 'styling' the contents of a View */
export class DisplayStyle extends DefinitionElement {
  public constructor(props: ElementProps) { super(props); }
}

/** A DisplayStyle for 2d views */
export class DisplayStyle2d extends DisplayStyle {
  public constructor(props: ElementProps) { super(props); }
}

/** A DisplayStyle for 3d views */
export class DisplayStyle3d extends DisplayStyle {
  public constructor(props: ElementProps) { super(props); }
}

/** A list of GeometricModels for a SpatialViewDefinition. */
export class ModelSelector extends DefinitionElement implements ModelSelectorProps {
  public models: string[];
  constructor(props: ModelSelectorProps) { super(props); this.models = props.models; }
  public toJSON(): ModelSelectorProps {
    const val = super.toJSON() as ModelSelectorProps;
    val.models = this.models;
    return val;
  }
}

/** A list of Categories to be displayed in a view. */
export class CategorySelector extends DefinitionElement implements CategorySelectorProps {
  public categories: string[];
  constructor(props: CategorySelectorProps) { super(props); this.categories = props.categories; }
  public toJSON(): CategorySelectorProps {
    const val = super.toJSON() as CategorySelectorProps;
    val.categories = this.categories;
    return val;
  }
}

/**
 * The definition element for a view. ViewDefinitions specify the area/volume that is viewed, and Ids of a DisplayStyle and a CategorySelector.
 * Subclasses of ViewDefinition determine which model(s) are viewed.
 */
export abstract class ViewDefinition extends DefinitionElement implements ViewDefinitionProps {
  public categorySelectorId: Id64;
  public displayStyleId: Id64;
  protected constructor(props: ViewDefinitionProps) {
    super(props);
    this.categorySelectorId = new Id64(props.categorySelectorId);
    this.displayStyleId = new Id64(props.displayStyleId);
  }
  public toJSON(): ViewDefinitionProps {
    const json = super.toJSON() as ViewDefinitionProps;
    json.categorySelectorId = this.categorySelectorId;
    json.displayStyleId = this.displayStyleId;
    return json;
  }

  public isView3d(): this is ViewDefinition3d { return this instanceof ViewDefinition3d; }
  public isSpatialView(): this is SpatialViewDefinition { return this instanceof SpatialViewDefinition; }
}

/** Defines a view of 3d models. */
export abstract class ViewDefinition3d extends ViewDefinition implements ViewDefinition3dProps {
  public cameraOn: boolean;  // if true, m_camera is valid.
  public origin: Point3d;        // The lower left back corner of the view frustum.
  public extents: Vector3d;      // The extent of the view frustum.
  public angles: YawPitchRollAngles;   // Rotation of the view frustum.
  public camera: Camera;         // The camera used for this view.

  public constructor(props: ViewDefinition3dProps) {
    super(props);
    this.cameraOn = JsonUtils.asBool(props.cameraOn);
    this.origin = Point3d.fromJSON(props.origin);
    this.extents = Vector3d.fromJSON(props.extents);
    this.angles = YawPitchRollAngles.fromJSON(props.angles);
    this.camera = new Camera(props.camera);
  }

  public toJSON(): ViewDefinition3dProps {
    const val = super.toJSON() as ViewDefinition3dProps;
    val.cameraOn = this.cameraOn;
    val.origin = this.origin;
    val.extents = this.extents;
    val.angles = this.angles;
    val.camera = this.camera;
    return val;
  }
}

/**
 * Defines a view of one or more SpatialModels.
 * The list of viewed models is stored by the ModelSelector.
 */
export class SpatialViewDefinition extends ViewDefinition3d implements SpatialViewDefinitionProps {
  public modelSelectorId: Id64;
  constructor(props: SpatialViewDefinitionProps) { super(props); this.modelSelectorId = new Id64(props.modelSelectorId); }
  public toJSON(): SpatialViewDefinitionProps {
    const json = super.toJSON() as SpatialViewDefinitionProps;
    json.modelSelectorId = this.modelSelectorId;
    return json;
  }
}

/** Defines a spatial view that displays geometry on the image plane using a parallel orthographic projection. */
export class OrthographicViewDefinition extends SpatialViewDefinition {
  constructor(props: SpatialViewDefinitionProps) { super(props); }
}

/** Defines a view of a 2d model. */
export class ViewDefinition2d extends ViewDefinition implements ViewDefinition2dProps {
  public baseModelId: Id64;
  public origin: Point2d;
  public delta: Point2d;
  public angle: Angle;

  public constructor(props: ViewDefinition2dProps) {
    super(props);
    this.baseModelId = new Id64(props.baseModelId);
    this.origin = Point2d.fromJSON(props.origin);
    this.delta = Point2d.fromJSON(props.delta);
    this.angle = Angle.fromJSON(props.angle);
  }
  public toJSON(): ViewDefinition2dProps {
    const val = super.toJSON() as ViewDefinition2dProps;
    val.baseModelId = this.baseModelId;
    val.origin = this.origin;
    val.delta = this.delta;
    val.angle = this.angle;
    return val;
  }
}

/** Defines a view of a DrawingModel. */
export class DrawingViewDefinition extends ViewDefinition2d {
}

/** Defines a view of a SheetModel. */
export class SheetViewDefinition extends ViewDefinition2d {
}

/** A ViewDefinition used to display a 2d template model. */
export class TemplateViewDefinition2d extends ViewDefinition2d {
}

/** A ViewDefinition used to display a 3d template model. */
export class TemplateViewDefinition3d extends ViewDefinition3d {
}
