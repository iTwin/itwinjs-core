/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ViewDefinitions */

import { Id64, Id64Array, Id64String, JsonUtils } from "@bentley/bentleyjs-core";
import { Angle, Matrix3d, Point2d, Point3d, Range2d, Range3d, StandardViewIndex, Transform, Vector3d, YawPitchRollAngles } from "@bentley/geometry-core";
import { AnalysisStyleProps, AuxCoordSystem2dProps, AuxCoordSystem3dProps, AuxCoordSystemProps, BisCodeSpec, Camera, CategorySelectorProps, Code, CodeScopeProps, CodeSpec, ColorDef, ContextRealityModelProps, DisplayStyle3dSettings, DisplayStyleProps, DisplayStyleSettings, LightLocationProps, ModelSelectorProps, RelatedElement, SpatialViewDefinitionProps, ViewAttachmentProps, ViewDefinition2dProps, ViewDefinition3dProps, ViewDefinitionProps, ViewFlags, BackgroundMapProps } from "@bentley/imodeljs-common";
import { DefinitionElement, GraphicalElement2d, SpatialLocationElement } from "./Element";
import { IModelDb } from "./IModelDb";

/** A DisplayStyle defines the parameters for 'styling' the contents of a view.
 * Internally a DisplayStyle consists of a dictionary of several named 'styles' describing specific aspects of the display style as a whole.
 * Many ViewDefinitions may share the same DisplayStyle.
 * @public
 */
export abstract class DisplayStyle extends DefinitionElement implements DisplayStyleProps {
  public static get className(): string { return "DisplayStyle"; }
  public abstract get settings(): DisplayStyleSettings;

  /** @internal */
  protected constructor(props: DisplayStyleProps, iModel: IModelDb) {
    super(props, iModel);
  }

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

/** A DisplayStyle for 2d views.
 * @public
 */
export class DisplayStyle2d extends DisplayStyle {
  public static get className(): string { return "DisplayStyle2d"; }
  private readonly _settings: DisplayStyleSettings;

  public get settings(): DisplayStyleSettings { return this._settings; }

  /** @internal */
  public constructor(props: DisplayStyleProps, iModel: IModelDb) {
    super(props, iModel);
    this._settings = new DisplayStyleSettings(this.jsonProperties);
  }
  /**
   * Create a DisplayStyle2d for use by a ViewDefinition.
   * @param iModelDb The iModel
   * @param definitionModelId The [[DefinitionModel]]
   * @param name The name/CodeValue of the DisplayStyle2d
   * @returns The newly constructed DisplayStyle2d element.
   * @throws [[IModelError]] if unable to create the element.
   */
  public static create(iModelDb: IModelDb, definitionModelId: Id64String, name: string): DisplayStyle2d {
    const displayStyleProps: DisplayStyleProps = {
      classFullName: this.classFullName,
      code: this.createCode(iModelDb, definitionModelId, name),
      model: definitionModelId,
      isPrivate: false,
      backgroundColor: new ColorDef(),
      monochromeColor: ColorDef.white,
      viewFlags: ViewFlags.createFrom(),
    };
    return new DisplayStyle2d(displayStyleProps, iModelDb);
  }
  /**
   * Insert a DisplayStyle2d for use by a ViewDefinition.
   * @param iModelDb Insert into this iModel
   * @param definitionModelId Insert the new DisplayStyle2d into this DefinitionModel
   * @param name The name of the DisplayStyle2d
   * @returns The Id of the newly inserted DisplayStyle2d element.
   * @throws [[IModelError]] if unable to insert the element.
   */
  public static insert(iModelDb: IModelDb, definitionModelId: Id64String, name: string): Id64String {
    const displayStyle = this.create(iModelDb, definitionModelId, name);
    return iModelDb.elements.insertElement(displayStyle);
  }
}

/** Creation options for display styles
 * @public
 */
export interface DisplayStyleCreationOptions {
  viewFlags?: ViewFlags;
  backgroundColor?: ColorDef;
  analysisStyle?: AnalysisStyleProps;
  contextRealityModels?: ContextRealityModelProps[];
  scheduleScript?: object;
  backgroundMap?: BackgroundMapProps;
}
/** A DisplayStyle for 3d views.
 * See [how to create a DisplayStyle3d]$(docs/learning/backend/CreateElements.md#DisplayStyle3d).
 * @public
 */
export class DisplayStyle3d extends DisplayStyle {
  public static get className(): string { return "DisplayStyle3d"; }
  private readonly _settings: DisplayStyle3dSettings;

  public get settings(): DisplayStyle3dSettings { return this._settings; }

  /** @internal */
  public constructor(props: DisplayStyleProps, iModel: IModelDb) {
    super(props, iModel);
    this._settings = new DisplayStyle3dSettings(this.jsonProperties);
  }

  /** Create a DisplayStyle3d for use by a ViewDefinition.
   * @param iModelDb The iModel
   * @param definitionModelId The [[DefinitionModel]]
   * @param name The name/CodeValue of the DisplayStyle3d
   * @returns The newly constructed DisplayStyle3d element.
   * @throws [[IModelError]] if unable to create the element.
   */
  public static create(iModelDb: IModelDb, definitionModelId: Id64String, name: string, options?: DisplayStyleCreationOptions): DisplayStyle3d {
    const stylesIn: { [k: string]: any } = { viewflags: (options && options.viewFlags) ? options.viewFlags : new ViewFlags() };

    if (options) {
      if (options.analysisStyle)
        stylesIn.analysisStyle = options.analysisStyle;

      if (options.backgroundColor)
        stylesIn.backgroundColor = options.backgroundColor;

      if (options.scheduleScript)
        stylesIn.scheduleScript = options.scheduleScript;

      if (options.contextRealityModels)
        stylesIn.contextRealityModels = options.contextRealityModels;

      if (options.backgroundMap)
        stylesIn.backgroundMap = options.backgroundMap;
    }

    const displayStyleProps: DisplayStyleProps = {
      classFullName: this.classFullName,
      code: this.createCode(iModelDb, definitionModelId, name),
      model: definitionModelId,
      jsonProperties: { styles: stylesIn },
      isPrivate: false,

    };
    return new DisplayStyle3d(displayStyleProps, iModelDb);
  }
  /**
   * Insert a DisplayStyle3d for use by a ViewDefinition.
   * @param iModelDb Insert into this iModel
   * @param definitionModelId Insert the new DisplayStyle3d into this [[DefinitionModel]]
   * @param name The name of the DisplayStyle3d
   * @returns The Id of the newly inserted DisplayStyle3d element.
   * @throws [[IModelError]] if unable to insert the element.
   */
  public static insert(iModelDb: IModelDb, definitionModelId: Id64String, name: string, options?: DisplayStyleCreationOptions): Id64String {
    const displayStyle = this.create(iModelDb, definitionModelId, name, options);
    return iModelDb.elements.insertElement(displayStyle);
  }
}

/** Holds the list of Ids of GeometricModels displayed by a [[SpatialViewDefinition]]. Multiple SpatialViewDefinitions may point to the same ModelSelector.
 * @see [ModelSelectorState]($frontend)
 * See [how to create a ModelSelector]$(docs/learning/backend/CreateElements.md#ModelSelector).
 * @public
 */
export class ModelSelector extends DefinitionElement implements ModelSelectorProps {
  public static get className(): string { return "ModelSelector"; }

  /** The array of modelIds of the GeometricModels displayed by this ModelSelector */
  public models: string[];
  /** @internal */
  constructor(props: ModelSelectorProps, iModel: IModelDb) { super(props, iModel); this.models = props.models; }
  /** @internal */
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
  /**
   * Create a ModelSelector which is used to select which Models are displayed by a ViewDefinition.
   * @param iModelDb The iModel
   * @param definitionModelId The [[DefinitionModel]]
   * @param name The name/CodeValue of the ModelSelector
   * @param models Array of models to select for display
   * @returns The newly constructed ModelSelector element.
   * @throws [[IModelError]] if unable to create the element.
   */
  public static create(iModelDb: IModelDb, definitionModelId: Id64String, name: string, models: Id64Array): ModelSelector {
    const modelSelectorProps: ModelSelectorProps = {
      classFullName: this.classFullName,
      code: this.createCode(iModelDb, definitionModelId, name),
      model: definitionModelId,
      models,
      isPrivate: false,
    };
    return new ModelSelector(modelSelectorProps, iModelDb);
  }
  /**
   * Insert a ModelSelector which is used to select which Models are displayed by a ViewDefinition.
   * @param iModelDb Insert into this iModel
   * @param definitionModelId Insert the new ModelSelector into this DefinitionModel
   * @param name The name/CodeValue of the ModelSelector
   * @param models Array of models to select for display
   * @returns The Id of the newly inserted ModelSelector element.
   * @throws [[IModelError]] if unable to insert the element.
   */
  public static insert(iModelDb: IModelDb, definitionModelId: Id64String, name: string, models: Id64Array): Id64String {
    const modelSelector = this.create(iModelDb, definitionModelId, name, models);
    return iModelDb.elements.insertElement(modelSelector);
  }
}

/** Holds a list of Ids of Categories to be displayed in a view.
 * @see [CategorySelectorState]($frontend)
 * See [how to create a CategorySelector]$(docs/learning/backend/CreateElements.md#CategorySelector).
 * @public
 */
export class CategorySelector extends DefinitionElement implements CategorySelectorProps {
  public static get className(): string { return "CategorySelector"; }
  /** The array of element Ids of the Categories selected by this CategorySelector */
  public categories: string[];
  /** @internal */
  constructor(props: CategorySelectorProps, iModel: IModelDb) { super(props, iModel); this.categories = props.categories; }
  /** @internal */
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
  /**
   * Create a CategorySelector which is used to select which categories are displayed by a ViewDefinition.
   * @param iModelDb The iModel
   * @param definitionModelId The [[DefinitionModel]]
   * @param name The name of the CategorySelector
   * @param categories Array of categories to select for display
   * @returns The newly constructed CategorySelector element.
   * @throws [[IModelError]] if unable to create the element.
   */
  public static create(iModelDb: IModelDb, definitionModelId: Id64String, name: string, categories: Id64Array): CategorySelector {
    const categorySelectorProps: CategorySelectorProps = {
      classFullName: this.classFullName,
      code: this.createCode(iModelDb, definitionModelId, name),
      model: definitionModelId,
      categories,
      isPrivate: false,
    };
    return new CategorySelector(categorySelectorProps, iModelDb);
  }
  /**
   * Insert a CategorySelector which is used to select which categories are displayed by a ViewDefinition.
   * @param iModelDb Insert into this iModel
   * @param definitionModelId Insert the new CategorySelector into this DefinitionModel
   * @param name The name of the CategorySelector
   * @param categories Array of categories to select for display
   * @returns The Id of the newly inserted CategorySelector element.
   * @throws [[IModelError]] if unable to insert the element.
   */
  public static insert(iModelDb: IModelDb, definitionModelId: Id64String, name: string, categories: Id64Array): Id64String {
    const categorySelector = this.create(iModelDb, definitionModelId, name, categories);
    return iModelDb.elements.insertElement(categorySelector);
  }
}

/**
 * The definition element for a view. ViewDefinitions specify the area/volume that is viewed, the Ids of a DisplayStyle and a CategorySelector,
 * plus additional view-specific parameters in their [[Element.jsonProperties]].
 *
 * Subclasses of ViewDefinition determine which model(s) are viewed.
 *
 * **Example: Obtaining the background color for a view**
 * ``` ts
 * [[include:ViewDefinition.getBackgroundColor]]
 * ```
 *
 * @note ViewDefinition is only available in the backend. See [ViewState]($frontend) for usage in the frontend.
 * @public
 */
export abstract class ViewDefinition extends DefinitionElement implements ViewDefinitionProps {
  public static get className(): string { return "ViewDefinition"; }
  /** The element Id of the [[CategorySelector]] for this ViewDefinition */
  public categorySelectorId: Id64String;
  /** The element Id of the [[DisplayStyle]] for this ViewDefinition */
  public displayStyleId: Id64String;

  /** @internal */
  protected constructor(props: ViewDefinitionProps, iModel: IModelDb) {
    super(props, iModel);
    this.categorySelectorId = Id64.fromJSON(props.categorySelectorId);
    this.displayStyleId = Id64.fromJSON(props.displayStyleId);
  }

  /** @internal */
  public toJSON(): ViewDefinitionProps {
    const json = super.toJSON() as ViewDefinitionProps;
    json.categorySelectorId = this.categorySelectorId;
    json.displayStyleId = this.displayStyleId;
    return json;
  }

  /** Type guard for `instanceof ViewDefinition3d`  */
  public isView3d(): this is ViewDefinition3d { return this instanceof ViewDefinition3d; }
  /** Type guard for 'instanceof ViewDefinition2d` */
  public isView2d(): this is ViewDefinition2d { return this instanceof ViewDefinition2d; }
  /** Type guard for `instanceof SpatialViewDefinition` */
  public isSpatialView(): this is SpatialViewDefinition { return this instanceof SpatialViewDefinition; }
  /** Type guard for 'instanceof DrawingViewDefinition' */
  public isDrawingView(): this is DrawingViewDefinition { return this instanceof DrawingViewDefinition; }

  /** Load this view's DisplayStyle from the IModelDb. */
  public loadDisplayStyle(): DisplayStyle { return this.iModel.elements.getElement<DisplayStyle>(this.displayStyleId); }

  /** Load this view's CategorySelector from the IModelDb. */
  public loadCategorySelector(): CategorySelector { return this.iModel.elements.getElement<CategorySelector>(this.categorySelectorId); }

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

/** Defines a view of one or more 3d models.
 * @public
 */
export abstract class ViewDefinition3d extends ViewDefinition implements ViewDefinition3dProps {
  public static get className(): string { return "ViewDefinition3d"; }
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

  /** @internal */
  public constructor(props: ViewDefinition3dProps, iModel: IModelDb) {
    super(props, iModel);
    this.cameraOn = JsonUtils.asBool(props.cameraOn);
    this.origin = Point3d.fromJSON(props.origin);
    this.extents = Vector3d.fromJSON(props.extents);
    this.angles = YawPitchRollAngles.fromJSON(props.angles);
    this.camera = new Camera(props.camera);
  }

  /** @internal */
  public toJSON(): ViewDefinition3dProps {
    const val = super.toJSON() as ViewDefinition3dProps;
    val.cameraOn = this.cameraOn;
    val.origin = this.origin;
    val.extents = this.extents;
    val.angles = this.angles;
    val.camera = this.camera;
    return val;
  }

  /** Load this view's DisplayStyle3d from the IModelDb. */
  public loadDisplayStyle3d(): DisplayStyle3d { return this.iModel.elements.getElement<DisplayStyle3d>(this.displayStyleId); }
}

/** Defines a view of one or more SpatialModels.
 * The list of viewed models is stored by the ModelSelector.
 *
 * This is how a SpatialViewDefinition selects the elements to display:
 *
 *  SpatialViewDefinition
 *    * ModelSelector
 *        * ModelIds  -------> SpatialModels    <----------GeometricElement3d.Model
 *    * CategorySelector
 *        * CategoryIds -----> SpatialCategories <----------GeometricElement3d.Category
 * @public
 */
export class SpatialViewDefinition extends ViewDefinition3d implements SpatialViewDefinitionProps {
  public static get className(): string { return "SpatialViewDefinition"; }
  /** The element Id of the [[ModelSelector]] for this SpatialViewDefinition. */
  public modelSelectorId: Id64String;
  /** @internal */
  constructor(props: SpatialViewDefinitionProps, iModel: IModelDb) { super(props, iModel); this.modelSelectorId = Id64.fromJSON(props.modelSelectorId); }
  /** @internal */
  public toJSON(): SpatialViewDefinitionProps {
    const json = super.toJSON() as SpatialViewDefinitionProps;
    json.modelSelectorId = this.modelSelectorId;
    return json;
  }
  /** Load this view's ModelSelector from the IModelDb. */
  public loadModelSelector(): ModelSelector { return this.iModel.elements.getElement<ModelSelector>(this.modelSelectorId); }
}

/** Defines a spatial view that displays geometry on the image plane using a parallel orthographic projection.
 * See [how to create a OrthographicViewDefinition]$(docs/learning/backend/CreateElements.md#OrthographicViewDefinition).
 * @public
 */
export class OrthographicViewDefinition extends SpatialViewDefinition {
  public static get className(): string { return "OrthographicViewDefinition"; }
  constructor(props: SpatialViewDefinitionProps, iModel: IModelDb) { super(props, iModel); }
  /**
   * Create an OrthographicViewDefinition
   * @param iModelDb The iModel
   * @param definitionModelId The [[DefinitionModel]]
   * @param name The name/CodeValue of the view
   * @param modelSelectorId The [[ModelSelector]] that this view should use
   * @param categorySelectorId The [[CategorySelector]] that this view should use
   * @param displayStyleId The [[DisplayStyle3d]] that this view should use
   * @param range Defines the view origin and extents
   * @param standardView Optionally defines the view's rotation
   * @returns The newly constructed OrthographicViewDefinition element
   * @throws [[IModelError]] if there is a problem creating the view
   */
  public static create(iModelDb: IModelDb, definitionModelId: Id64String, name: string, modelSelectorId: Id64String, categorySelectorId: Id64String, displayStyleId: Id64String, range: Range3d, standardView = StandardViewIndex.Iso): OrthographicViewDefinition {
    const rotation = Matrix3d.createStandardWorldToView(standardView);
    const angles = YawPitchRollAngles.createFromMatrix3d(rotation);
    const rotationTransform = Transform.createOriginAndMatrix(undefined, rotation);
    const rotatedRange = rotationTransform.multiplyRange(range);
    const viewDefinitionProps: SpatialViewDefinitionProps = {
      classFullName: this.classFullName,
      model: definitionModelId,
      code: this.createCode(iModelDb, definitionModelId, name),
      modelSelectorId,
      categorySelectorId,
      displayStyleId,
      origin: rotation.multiplyTransposeXYZ(rotatedRange.low.x, rotatedRange.low.y, rotatedRange.low.z),
      extents: rotatedRange.diagonal(),
      angles,
      cameraOn: false,
      camera: new Camera(), // not used when cameraOn === false
    };
    return new OrthographicViewDefinition(viewDefinitionProps, iModelDb);
  }
  /**
   * Insert an OrthographicViewDefinition
   * @param iModelDb Insert into this iModel
   * @param definitionModelId Insert the new OrthographicViewDefinition into this DefinitionModel
   * @param name The name/CodeValue of the view
   * @param modelSelectorId The [[ModelSelector]] that this view should use
   * @param categorySelectorId The [[CategorySelector]] that this view should use
   * @param displayStyleId The [[DisplayStyle3d]] that this view should use
   * @param range Defines the view origin and extents
   * @param standardView Optionally defines the view's rotation
   * @returns The Id of the newly inserted OrthographicViewDefinition element
   * @throws [[IModelError]] if there is an insert problem.
   */
  public static insert(iModelDb: IModelDb, definitionModelId: Id64String, name: string, modelSelectorId: Id64String, categorySelectorId: Id64String, displayStyleId: Id64String, range: Range3d, standardView = StandardViewIndex.Iso): Id64String {
    const viewDefinition = this.create(iModelDb, definitionModelId, name, modelSelectorId, categorySelectorId, displayStyleId, range, standardView);
    return iModelDb.elements.insertElement(viewDefinition);
  }
  /** Set a new viewed range without changing the rotation or any other properties. */
  public setRange(range: Range3d): void {
    const rotation = this.angles.toMatrix3d();
    const rotationTransform = Transform.createOriginAndMatrix(undefined, rotation);
    const rotatedRange = rotationTransform.multiplyRange(range);
    this.origin = Point3d.createFrom(rotation.multiplyTransposeXYZ(rotatedRange.low.x, rotatedRange.low.y, rotatedRange.low.z));
    this.extents = rotatedRange.diagonal();
  }
}

/** Defines a view of a single 2d model. Each 2d model has its own coordinate system, so only one may appear per view.
 * @public
 */
export class ViewDefinition2d extends ViewDefinition implements ViewDefinition2dProps {
  public static get className(): string { return "ViewDefinition2d"; }
  /** The Id of the Model displayed by this view. */
  public baseModelId: Id64String;
  /** The lower-left corner of this view in Model coordinates. */
  public origin: Point2d;
  /** The delta (size) of this view, in meters, aligned with view x,y. */
  public delta: Point2d;
  /** The rotation of this view. */
  public angle: Angle;

  /** @internal */
  public constructor(props: ViewDefinition2dProps, iModel: IModelDb) {
    super(props, iModel);
    this.baseModelId = Id64.fromJSON(props.baseModelId);
    this.origin = Point2d.fromJSON(props.origin);
    this.delta = Point2d.fromJSON(props.delta);
    this.angle = Angle.fromJSON(props.angle);
  }
  /** @internal */
  public toJSON(): ViewDefinition2dProps {
    const val = super.toJSON() as ViewDefinition2dProps;
    val.baseModelId = this.baseModelId;
    val.origin = this.origin;
    val.delta = this.delta;
    val.angle = this.angle;
    return val;
  }

  /** Load this view's DisplayStyle2d from the IModelDb. */
  public loadDisplayStyle2d(): DisplayStyle2d { return this.iModel.elements.getElement<DisplayStyle2d>(this.displayStyleId); }
}

/** Defines a view of a [[DrawingModel]].
 * @public
 */
export class DrawingViewDefinition extends ViewDefinition2d {
  public static get className(): string { return "DrawingViewDefinition"; }
  /** @internal */
  public constructor(props: ViewDefinition2dProps, iModel: IModelDb) {
    super(props, iModel);
  }

  /** Create a DrawingViewDefinition
   * @param iModelDb The iModel
   * @param definitionModelId The [[DefinitionModel]]
   * @param name The name/CodeValue of the view
   * @param baseModelId The base [[DrawingModel]]
   * @param categorySelectorId The [[CategorySelector]] that this view should use
   * @param displayStyleId The [[DisplayStyle2d]] that this view should use
   * @param range Defines the view origin and extents
   * @throws [[IModelError]] if there is a problem creating the element.
   */
  public static create(iModelDb: IModelDb, definitionModelId: Id64String, name: string, baseModelId: Id64String, categorySelectorId: Id64String, displayStyleId: Id64String, range: Range2d): DrawingViewDefinition {
    const viewDefinitionProps: ViewDefinition2dProps = {
      classFullName: this.classFullName,
      model: definitionModelId,
      code: this.createCode(iModelDb, definitionModelId, name),
      baseModelId,
      categorySelectorId,
      displayStyleId,
      origin: { x: range.low.x, y: range.low.y },
      delta: range.diagonal(),
      angle: 0,
    };
    return new DrawingViewDefinition(viewDefinitionProps, iModelDb);
  }

  /** Insert a DrawingViewDefinition
   * @param iModelDb Insert into this iModel
   * @param definitionModelId Insert the new DrawingViewDefinition into this [[DefinitionModel]]
   * @param name The name/CodeValue of the view
   * @param baseModelId The base [[DrawingModel]]
   * @param categorySelectorId The [[CategorySelector]] that this view should use
   * @param displayStyleId The [[DisplayStyle2d]] that this view should use
   * @param range Defines the view origin and extents
   * @throws [[IModelError]] if there is an insert problem.
   */
  public static insert(iModelDb: IModelDb, definitionModelId: Id64String, name: string, baseModelId: Id64String, categorySelectorId: Id64String, displayStyleId: Id64String, range: Range2d): Id64String {
    const viewDefinition = this.create(iModelDb, definitionModelId, name, baseModelId, categorySelectorId, displayStyleId, range);
    return iModelDb.elements.insertElement(viewDefinition);
  }
}

/** Defines a view of a [[SheetModel]].
 * @public
 */
export class SheetViewDefinition extends ViewDefinition2d {
  public static get className(): string { return "SheetViewDefinition"; }
}

/** A ViewDefinition used to display a 2d template model.
 * @internal
 */
export class TemplateViewDefinition2d extends ViewDefinition2d {
  public static get className(): string { return "TemplateViewDefinition2d"; }
}

/** A ViewDefinition used to display a 3d template model.
 * @internal
 */
export class TemplateViewDefinition3d extends ViewDefinition3d {
  public static get className(): string { return "TemplateViewDefinition3d"; }
}

/** An auxiliary coordinate system element. Auxiliary coordinate systems can be used by views to show
 * coordinate information in different units and/or orientations.
 * @public
 */
export abstract class AuxCoordSystem extends DefinitionElement implements AuxCoordSystemProps {
  public static get className(): string { return "AuxCoordSystem"; }
  public type!: number;
  public description?: string;
  public constructor(props: AuxCoordSystemProps, iModel: IModelDb) { super(props, iModel); }
}

/** A 2d auxiliary coordinate system.
 * @public
 */
export class AuxCoordSystem2d extends AuxCoordSystem implements AuxCoordSystem2dProps {
  public static get className(): string { return "AuxCoordSystem2d"; }
  public origin?: Point2d;
  public angle!: number;
  public constructor(props: AuxCoordSystem2dProps, iModel: IModelDb) { super(props, iModel); }

  /** Create a Code for a AuxCoordSystem2d element given a name that is meant to be unique within the scope of the specified DefinitionModel.
   * @param iModel  The IModelDb
   * @param scopeModelId The Id of the DefinitionModel that contains the AuxCoordSystem2d element and provides the scope for its name.
   * @param codeValue The AuxCoordSystem2d name
   */
  public static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code {
    const codeSpec: CodeSpec = iModel.codeSpecs.getByName(BisCodeSpec.auxCoordSystem2d);
    return new Code({ spec: codeSpec.id, scope: scopeModelId, value: codeValue });
  }
}

/** A 3d auxiliary coordinate system.
 * @public
 */
export class AuxCoordSystem3d extends AuxCoordSystem implements AuxCoordSystem3dProps {
  public static get className(): string { return "AuxCoordSystem3d"; }
  public origin?: Point3d;
  public yaw!: number;
  public pitch!: number;
  public roll!: number;
  public constructor(props: AuxCoordSystem3dProps, iModel: IModelDb) { super(props, iModel); }

  /** Create a Code for a AuxCoordSystem3d element given a name that is meant to be unique within the scope of the specified DefinitionModel.
   * @param iModel  The IModelDb
   * @param scopeModelId The Id of the DefinitionModel that contains the AuxCoordSystem3d element and provides the scope for its name.
   * @param codeValue The AuxCoordSystem3d name
   */
  public static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code {
    const codeSpec: CodeSpec = iModel.codeSpecs.getByName(BisCodeSpec.auxCoordSystem3d);
    return new Code({ spec: codeSpec.id, scope: scopeModelId, value: codeValue });
  }
}

/** A spatial auxiliary coordinate system.
 * @public
 */
export class AuxCoordSystemSpatial extends AuxCoordSystem3d {
  public static get className(): string { return "AuxCoordSystemSpatial"; }
  /** Create a Code for a AuxCoordSystemSpatial element given a name that is meant to be unique within the scope of the specified DefinitionModel.
   * @param iModel  The IModelDb
   * @param scopeModelId The Id of the DefinitionModel that contains the AuxCoordSystemSpatial element and provides the scope for its name.
   * @param codeValue The AuxCoordSystemSpatial name
   */
  public static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code {
    const codeSpec: CodeSpec = iModel.codeSpecs.getByName(BisCodeSpec.auxCoordSystemSpatial);
    return new Code({ spec: codeSpec.id, scope: scopeModelId, value: codeValue });
  }
}

/** Represents an *attachment* of a [[ViewDefinition]] to a [[Sheet]].
 * @public
 */
export class ViewAttachment extends GraphicalElement2d implements ViewAttachmentProps {
  public static get className(): string { return "ViewAttachment"; }
  public view: RelatedElement;
  public constructor(props: ViewAttachmentProps, iModel: IModelDb) {
    super(props, iModel);
    this.view = new RelatedElement(props.view);
    // ###NOTE: scale, displayPriority, and clipping vectors are stored in jsonProperties...
  }
}

/** The position in space of a Light.
 * @public
 */
export class LightLocation extends SpatialLocationElement implements LightLocationProps {
  public static get className(): string { return "LightLocation"; }
  /** Whether this light is currently turned on. */
  public enabled!: boolean;
  /** @internal */
  constructor(props: LightLocationProps, iModel: IModelDb) { super(props, iModel); }
}
