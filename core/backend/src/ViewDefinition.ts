/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ViewDefinitions */

import { Id64, JsonUtils } from "@bentley/bentleyjs-core";
import { Vector3d, Point3d, Point2d, YawPitchRollAngles, Angle } from "@bentley/geometry-core";
import {
  BisCodeSpec, Code, CodeScopeProps, CodeSpec, ElementProps, ViewDefinitionProps, ViewDefinition3dProps, ViewDefinition2dProps, SpatialViewDefinitionProps, ModelSelectorProps,
  CategorySelectorProps, Camera, AuxCoordSystemProps, AuxCoordSystem2dProps, AuxCoordSystem3dProps, ViewAttachmentProps, LightLocationProps, RelatedElement,
} from "@bentley/imodeljs-common";
import { DefinitionElement, GraphicalElement2d, SpatialLocationElement } from "./Element";
import { IModelDb } from "./IModelDb";

/** A DisplayStyle defines the parameters for 'styling' the contents of a view. Many ViewDefinitions may share the same DisplayStyle. */
export class DisplayStyle extends DefinitionElement {
  public constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }

  /** Create a Code for a DisplayStyle given a name that is meant to be unique within the scope of the specified DefinitionModel.
   * @param iModel  The IModelDb
   * @param scopeModelId The Id of the DefinitionModel that contains the DisplayStyle and provides the scope for its name.
   * @param codeValue The DisplayStyle name
   */
  public static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code {
    const codeSpec: CodeSpec = iModel.codeSpecs.getByName(BisCodeSpec.displayStyle);
    return new Code({ spec: codeSpec.id, scope: scopeModelId, value: codeValue });
  }
}

/** A DisplayStyle for 2d views. */
export class DisplayStyle2d extends DisplayStyle {
  public constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/** A DisplayStyle for 3d views. */
export class DisplayStyle3d extends DisplayStyle {
  public constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * Holds the list of Ids of GeometricModels displayed by a [[SpatialViewDefinition]]. Multiple SpatialViewDefinitions may point to the same ModelSelector.
 * @see [ModelSelectorState]($frontend)
 */
export class ModelSelector extends DefinitionElement implements ModelSelectorProps {
  /** The array of modelIds of the GeometricModels displayed by this ModelSelector */
  public models: string[];
  constructor(props: ModelSelectorProps, iModel: IModelDb) { super(props, iModel); this.models = props.models; }
  public toJSON(): ModelSelectorProps {
    const val = super.toJSON() as ModelSelectorProps;
    val.models = this.models;
    return val;
  }

  /** Create a Code for a ModelSelector given a name that is meant to be unique within the scope of the specified DefinitionModel.
   * @param iModel  The IModelDb
   * @param scopeModelId The Id of the DefinitionModel that contains the ModelSelector and provides the scope for its name.
   * @param codeValue The ModelSelector name
   */
  public static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code {
    const codeSpec: CodeSpec = iModel.codeSpecs.getByName(BisCodeSpec.modelSelector);
    return new Code({ spec: codeSpec.id, scope: scopeModelId, value: codeValue });
  }
}

/**
 * Holds a list of Ids of Categories to be displayed in a view.
 * @see [CategorySelectorState]($frontend)
 */
export class CategorySelector extends DefinitionElement implements CategorySelectorProps {
  /** The array of element Ids of the Categories selected by this CategorySelector */
  public categories: string[];
  constructor(props: CategorySelectorProps, iModel: IModelDb) { super(props, iModel); this.categories = props.categories; }
  public toJSON(): CategorySelectorProps {
    const val = super.toJSON() as CategorySelectorProps;
    val.categories = this.categories;
    return val;
  }

  /** Create a Code for a CategorySelector given a name that is meant to be unique within the scope of the specified DefinitionModel.
   * @param iModel  The IModelDb
   * @param scopeModelId The Id of the DefinitionModel that contains the CategorySelector and provides the scope for its name.
   * @param codeValue The CategorySelector name
   */
  public static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code {
    const codeSpec: CodeSpec = iModel.codeSpecs.getByName(BisCodeSpec.categorySelector);
    return new Code({ spec: codeSpec.id, scope: scopeModelId, value: codeValue });
  }
}

/**
 * The definition element for a view. ViewDefinitions specify the area/volume that is viewed, the Ids of a DisplayStyle and a CategorySelector,
 * plus additional view-specific parameters in their [[Element.jsonProperties]].
 *
 * Subclasses of ViewDefinition determine which model(s) are viewed.
 *
 * @note ViewDefinition is only available in the backend. See [ViewState]($frontend) for usage in the frontend.
 */
export abstract class ViewDefinition extends DefinitionElement implements ViewDefinitionProps {
  /** The element Id of the [[CategorySelector]] for this ViewDefinition */
  public categorySelectorId: Id64;
  /** The element Id of the [[DisplayStyle]] for this ViewDefinition */
  public displayStyleId: Id64;
  protected constructor(props: ViewDefinitionProps, iModel: IModelDb) {
    super(props, iModel);
    this.categorySelectorId = Id64.fromJSON(props.categorySelectorId);
    this.displayStyleId = Id64.fromJSON(props.displayStyleId);
  }
  public toJSON(): ViewDefinitionProps {
    const json = super.toJSON() as ViewDefinitionProps;
    json.categorySelectorId = this.categorySelectorId;
    json.displayStyleId = this.displayStyleId;
    return json;
  }

  /** Type guard for `instanceof ViewDefinition3d`  */
  public isView3d(): this is ViewDefinition3d { return this instanceof ViewDefinition3d; }
  /** Type guard for `instanceof SpatialViewDefinition` */
  public isSpatialView(): this is SpatialViewDefinition { return this instanceof SpatialViewDefinition; }

  /** Create a Code for a ViewDefinition given a name that is meant to be unique within the scope of the specified DefinitionModel.
   * @param iModel  The IModelDb
   * @param scopeModelId The Id of the DefinitionModel to contain the ViewDefinition and provides the scope for its name.
   * @param codeValue The ViewDefinition name
   */
  public static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code {
    const codeSpec: CodeSpec = iModel.codeSpecs.getByName(BisCodeSpec.viewDefinition);
    return new Code({ spec: codeSpec.id, scope: scopeModelId, value: codeValue });
  }
}

/** Defines a view of one or more 3d models. */
export abstract class ViewDefinition3d extends ViewDefinition implements ViewDefinition3dProps {
  /** If true, camera is used. Otherwise, use an orthographic projection. */
  public cameraOn: boolean;
  /** The lower left back corner of the view frustum. */
  public origin: Point3d;
  /** The extent (size) of the view frustum, in meters, along its x,y,z axes. */
  public extents: Vector3d;
  /** Rotation from world coordinates to view coordinates. */
  public angles: YawPitchRollAngles;
  /** The camera used for this view, if `cameraOn` is true. */
  public camera: Camera;

  public constructor(props: ViewDefinition3dProps, iModel: IModelDb) {
    super(props, iModel);
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
 *
 * This is how a SpatialViewDefinition selects the elements to display:
 *
 *  SpatialViewDefinition
 *    * ModelSelector
 *        * ModelIds  -------> SpatialModels    <----------GeometricElement3d.Model
 *    * CategorySelector
 *        * CategoryIds -----> SpatialCategories <----------GeometricElement3d.Category
 */
export class SpatialViewDefinition extends ViewDefinition3d implements SpatialViewDefinitionProps {
  /** The element Id of the [[ModelSelector]] for this SpatialViewDefinition. */
  public modelSelectorId: Id64;
  constructor(props: SpatialViewDefinitionProps, iModel: IModelDb) { super(props, iModel); this.modelSelectorId = Id64.fromJSON(props.modelSelectorId); }
  public toJSON(): SpatialViewDefinitionProps {
    const json = super.toJSON() as SpatialViewDefinitionProps;
    json.modelSelectorId = this.modelSelectorId;
    return json;
  }
}

/** Defines a spatial view that displays geometry on the image plane using a parallel orthographic projection. */
export class OrthographicViewDefinition extends SpatialViewDefinition {
  constructor(props: SpatialViewDefinitionProps, iModel: IModelDb) { super(props, iModel); }
}

/** Defines a view of a single 2d model. Each 2d model has its own coordinate system, so only one may appear per view. */
export class ViewDefinition2d extends ViewDefinition implements ViewDefinition2dProps {
  /** The Id of the Model displayed by this view. */
  public baseModelId: Id64;
  /** The lower-left corner of this view in Model coordinates. */
  public origin: Point2d;
  /** The delta (size) of this view, in meters, aligned with view x,y. */
  public delta: Point2d;
  /** The rotation of this view. */
  public angle: Angle;

  public constructor(props: ViewDefinition2dProps, iModel: IModelDb) {
    super(props, iModel);
    this.baseModelId = Id64.fromJSON(props.baseModelId);
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

/** Defines a view of a [[DrawingModel]]. */
export class DrawingViewDefinition extends ViewDefinition2d {
  public constructor(props: ViewDefinition2dProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/** Defines a view of a [[SheetModel]]. */
export class SheetViewDefinition extends ViewDefinition2d {
  public constructor(props: ViewDefinition2dProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/** A ViewDefinition used to display a 2d template model. */
export class TemplateViewDefinition2d extends ViewDefinition2d {
  public constructor(props: ViewDefinition2dProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/** A ViewDefinition used to display a 3d template model. */
export class TemplateViewDefinition3d extends ViewDefinition3d {
  public constructor(props: ViewDefinition3dProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/**
 * An auxiliary coordinate system element. Auxiliary coordinate systems can be used by views to show
 * coordinate information in different units and/or orientations.
 */
export abstract class AuxCoordSystem extends DefinitionElement implements AuxCoordSystemProps {
  public type!: number;
  public description?: string;
  public constructor(props: AuxCoordSystemProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * A 2d auxiliary coordinate system.
 */
export class AuxCoordSystem2d extends AuxCoordSystem implements AuxCoordSystem2dProps {
  public origin?: Point2d;
  public angle!: number;
  public constructor(props: AuxCoordSystem2dProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * A 3d auxiliary coordinate system.
 */
export class AuxCoordSystem3d extends AuxCoordSystem implements AuxCoordSystem3dProps {
  public origin?: Point3d;
  public yaw!: number;
  public pitch!: number;
  public roll!: number;
  public constructor(props: AuxCoordSystem3dProps, iModel: IModelDb) { super(props, iModel); }
}

/**
 * A spatial auxiliary coordinate system.
 */
export class AuxCoordSystemSpatial extends AuxCoordSystem3d {
}

/**
 * Represents an *attachment* of a [[ViewDefinition]] to a [[Sheet]].
 */
export class ViewAttachment extends GraphicalElement2d implements ViewAttachmentProps {
  public view: RelatedElement;
  public constructor(props: ViewAttachmentProps, iModel: IModelDb) {
    super(props, iModel);
    this.view = new RelatedElement(props.view);
    // ###NOTE: scale, displayPriority, and clipping vectors are stored in jsonProperties...
  }
}

/**
 * The position in space of a [[Light]]
 */
export class LightLocation extends SpatialLocationElement implements LightLocationProps {
  /** Whether this light is currently turned on. */
  public enabled!: boolean;
  constructor(props: LightLocationProps, iModel: IModelDb) { super(props, iModel); }
}

/** Defines a rendering texture. */
export class Texture extends DefinitionElement {
}
