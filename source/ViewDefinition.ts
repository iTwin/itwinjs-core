/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { CreateParams, DefinitionElement, Id } from "./Element";
import { Appearance, SubCategoryOverride } from "./Category";
import { ViewFlags, HiddenLine } from "./Render";
import { Light, LightType } from "./Lighting";
import { ColorDef } from "./IModel";
import { AxisOrder, Vector3d, Point3d, Range3d, RotMatrix, Transform } from "../../geometry-core/lib/PointVector";
import { Constant } from "../../geometry-core/lib/Constant";
import { Model } from "./Model";

/** The 8 corners of the NPC cube. */
export enum Npc {
  _000 = 0,  // Left bottom rear
  _100 = 1,  // Right bottom rear
  _010 = 2,  // Left top rear
  _110 = 3,  // Right top rear
  _001 = 4,  // Left bottom front
  _101 = 5,  // Right bottom front
  _011 = 6,  // Left top front
  _111 = 7,  // Right top front

  LeftBottomRear = 0,
  RightBottomRear = 1,
  LeftTopRear = 2,
  RightTopRear = 3,
  LeftBottomFront = 4,
  RightBottomFront = 5,
  LeftTopFront = 6,
  RightTopFront = 7,
  CORNER_COUNT = 8
}

export let StandardView = {
  Top: RotMatrix.identity(),
  Bottom: new RotMatrix(1, 0, 0, 0, -1, 0, 0, 0, -1),
  Left: new RotMatrix(0, 0, -1, -1, 0, 0, 0, 1, 0),
  Right: new RotMatrix(0, 0, 1, 1, 0, 0, 0, 1, 0),
  Front: new RotMatrix(1, 0, 0, 0, 0, -1, 0, 1, 0),
  Back: new RotMatrix(-1, 0, 0, 0, 0, 1, 0, 1, 0),
  Iso: new RotMatrix(
    0.707106781186548, 0.408248290463863, -0.577350269189626,
    -0.70710678118654757, 0.40824829046386302, -0.57735026918962573,
    0, 0.81649658092772603, 0.57735026918962573),
  RightIso: new RotMatrix(
    0.707106781186548, -0.408248290463863, 0.577350269189626,
    0.70710678118654757, 0.40824829046386302, -0.57735026918962573,
    0, 0.81649658092772603, 0.57735026918962573)
};

export let StandardViewMatrices =
  [
    StandardView.Top, StandardView.Bottom, StandardView.Left, StandardView.Right,
    StandardView.Front, StandardView.Back, StandardView.Iso, StandardView.RightIso
  ];

/** adjust to any nearby standard view */
function findNearbyStandardViewMatrix(rMatrix: RotMatrix) {
  for (const test of StandardViewMatrices) {
    const a = test.maxDiff(rMatrix);
    if (a < 1.0e-7) {
      rMatrix.setFrom(test);
      return;
    }
  }
}

/** The region of physical (3d) space that appears in a view. It forms the field-of-view of a camera.
 *  It is stored as 8 points, in NpcCorner order, that must define a truncated pyramid.
 */
export class Frustum {
  public points: Point3d[];
  public constructor() { for (let i = 0; i < 8; ++i) points[i] = new Point3d(); }

  public getCorner(i: number) { return this.points[i]; }
  public getCenter(): Point3d { return this.getCorner(Npc.RightTopFront).interpolate(0.5, this.getCorner(Npc.LeftBottomRear)); }
  public distance(corner1: number, corner2: number): Point3d { return this.getCorner(corner1).distance(this.getCorner(corner2)); }
  public getFraction(): number { return this.distance(Npc.LeftTopFront, Npc.RightBottomFront) / this.distance(Npc.LeftTopRear, Npc.RightBottomRear); }
  public multiply(trans: Transform): void { trans.multiply(points, points, 8); }
  public translate(offset: Vector3d): void { for (const pt of this.points) pt.add(offset); }
  public transformBy(trans: Transform, result?: Frustum): Frustum { result = result ? result : new Frustum(); trans.multiply(result.points, this.points, 8); return result; }
  public toRange(range?: Range3d): Range3d { range = range ? range : new Range3d(); range.initFrom(this.points, 8); }
  public clone(result?: Frustum): Frustum { for (let i = 0; i < 8; ++i) Point3d.createFrom(this.points[i], result.points[i]); }
  public scaleAboutCenter(scale: number): void {
    const orig = this.clone();
    const f = 0.5 * (1.0 + scale);
    orig.getCorner(Npc._111).interpolate(f, orig.getCorner(Npc._000), this.points[Npc._000]);
    orig.getCorner(Npc._011).interpolate(f, orig.getCorner(Npc._100), this.points[Npc._100]);
    orig.getCorner(Npc._101).interpolate(f, orig.getCorner(Npc._010), this.points[Npc._010]);
    orig.getCorner(Npc._001).interpolate(f, orig.getCorner(Npc._110), this.points[Npc._110]);
    orig.getCorner(Npc._110).interpolate(f, orig.getCorner(Npc._001), this.points[Npc._001]);
    orig.getCorner(Npc._010).interpolate(f, orig.getCorner(Npc._101), this.points[Npc._101]);
    orig.getCorner(Npc._100).interpolate(f, orig.getCorner(Npc._011), this.points[Npc._011]);
    orig.getCorner(Npc._000).interpolate(f, orig.getCorner(Npc._111), this.points[Npc._111]);
  }

  // public  toDMap4d(): Map4d;
  // {
  //       DPoint3d org = GetCorner(Npc.LeftBottomRear);
  //   DVec3d xVec = DVec3d::FromStartEnd(org, GetCorner(Npc.RightBottomRear));
  //   DVec3d yVec = DVec3d::FromStartEnd(org, GetCorner(Npc.LeftTopRear));
  //   DVec3d zVec = DVec3d::FromStartEnd(org, GetCorner(Npc.LeftBottomFront));
  //   DMap4d map;
  //   bsiDMap4d_initFromVectorFrustum(&map, &org, &xVec, &yVec, &zVec, GetFraction());
  //   return map;
  // }

  public invalidate(): void { for (let i = 0; i < 8; ++i) this.points[i].set(0, 0, 0); }
  public equals(rhs: Frustum): boolean {
    for (let i = 0; i < 8; ++i) {
      if (!this.points[i].isExactEqual(rhs.points[i]))
        return false;
    }
    return true;
  }
  public static fromRange(range: Range3d): Frustum {
    const pts = this.points;
    pts[0].x = pts[3].x = pts[4].x = pts[7].x = range.low.x;
    pts[1].x = pts[2].x = pts[5].x = pts[6].x = range.high.x;
    pts[0].y = pts[1].y = pts[4].y = pts[5].y = range.low.y;
    pts[2].y = pts[3].y = pts[6].y = pts[7].y = range.high.y;
    pts[0].z = pts[1].z = pts[2].z = pts[3].z = range.low.z;
    pts[4].z = pts[5].z = pts[6].z = pts[7].z = range.high.z;
  }
}

/** A DisplayStyle defines the parameters for 'styling' the contents of a View */
export class DisplayStyle extends DefinitionElement {
  protected _subcategories: Map<string, Appearance>;
  protected _subCategoryOvr: Map<string, SubCategoryOverride>;
  public viewFlags: ViewFlags;

  constructor(opts: CreateParams) { super(opts); }

  public getEcClass(): string { return "DisplayStyle"; }
  public getStyle(name: string): any {
    const style = this.props.styles[name];
    return style ? style : new Object();
  }
  /** change the value of a style on this DisplayStyle */
  public setStyle(name: string, value: any): void { this.props.styles[name] = value; }

  /** Remove a Style from this DisplayStyle. */
  public removeStyle(name: string) { delete this.props.styles[name]; }

  /** Get the background color for this DisplayStyle */
  public getBackgroundColor(): ColorDef {
    const color = this.getStyle("backgroundColor") as ColorDef | null;
    return color ? color : ColorDef.black();
  }

  /** Set the background color for this DisplayStyle */
  public setBackgroundColor(val: ColorDef): void { this.setStyle("backgroundColor", val); }

  public getMonochromeColor(): ColorDef {
    const color = this.getStyle("monochromeColor") as ColorDef | null;
    return color ? color : ColorDef.black();
  }
  public setMonochromeColor(val: ColorDef): void { this.setStyle("monochromeColor", val); }
}

/** A DisplayStyle for 2d views */
export class DisplayStyle2d extends DisplayStyle {
  public getEcClass(): string { return "DisplayStyle2d"; }

  constructor(opts: CreateParams) { super(opts); }
}

/** A circle drawn at a Z elevation, whose diameter is the the XY diagonal of the project extents */
export class GroundPlane {
  public enabled: boolean = false;
  public elevation: number = 0.0;  // the Z height to draw the ground plane
  public aboveColor: ColorDef;     // the color to draw the ground plane if the view shows the ground from above
  public belowColor: ColorDef;     // the color to draw the ground plane if the view shows the ground from below
}

export class SkyBox {
  public enabled: boolean = false;
  public twoColor: boolean = false;
  public jpegFile: string;              // the name of a jpeg file with a spherical skybox
  public zenithColor: ColorDef;         // if no jpeg file, the color of the zenith part of the sky gradient (shown when looking straight up.)
  public nadirColor: ColorDef;          // if no jpeg file, the color of the nadir part of the ground gradient (shown when looking straight down.)
  public groundColor: ColorDef;         // if no jpeg file, the color of the ground part of the ground gradient
  public skyColor: ColorDef;            // if no jpeg file, the color of the sky part of the sky gradient
  public groundExponent: number = 4.0;  // if no jpeg file, the cutoff between ground and nadir
  public skyExponent: number = 4.0;     // if no jpeg file, the cutoff between sky and zenith
}

/** A DisplayStyle for 3d views */
export class DisplayStyle3d extends DisplayStyle {
  public groundPlane: GroundPlane;
  public skyBox: SkyBox;

  public getEcClass(): string { return "DisplayStyle3d"; }
  constructor(opts: CreateParams) { super(opts); }

  public getHiddenLineParams(): HiddenLine.Params { return this.getStyle("hline") as HiddenLine.Params; }
  public setHiddenLineParams(params: HiddenLine.Params) { this.setStyle("hline", params); }

  public setSceneLight(light: Light): void {
    if (!light.isValid())
      return;

    const sceneLights = this.getStyle("sceneLights");
    switch (light.lightType) {
      case LightType.Ambient:
        sceneLights.ambient = light;
        break;

      case LightType.Flash:
        sceneLights.flash = light;
        break;

      case LightType.Portrait:
        sceneLights.portrait = light;
        break;
    }
  }

  public setSolarLight(light: Light, direction: Vector3d) {
    const sceneLights = this.getStyle("sceneLights");
    if (light.lightType !== LightType.Solar || !light.isValid()) {
      delete sceneLights.sunDir;
      return;
    }

    sceneLights.sun = light;
    sceneLights.sunDir = direction;
  }

  public setSceneBrightness(fstop: number): void { Math.max(-3.0, Math.min(fstop, 3.0)); this.getStyle("sceneLights").fstop = fstop; }
  public getSceneBrightness(): number { return this.getStyle("sceneLights").fstop; }
}

/** A list of GeometricModels for a SpatialViewDefinition.
 *  When a SpatialViewDefinition is loaded into a ViewController, it makes a copy of its ModelSelector, so any in-memory changes do not affect the original.
 *  Changes are not saved unless someone calls Update on the modified copy.
 */
export class ModelSelector extends DefinitionElement {
  public getEcClass(): string { return "ModelSelector"; }

  public models: Set<string>;
  constructor(opts: CreateParams) { super(opts); }

  /** Get the name of this ModelSelector */
  public getName(): string { return this.code.getValue(); }

  /** Query if the specified DgnModelId is selected by this ModelSelector */
  public containsModel(modelId: Id): boolean { return this.models.has(modelId.toString()); }

  /**  Add a model to this ModelSelector */
  public addModel(id: Id): void { this.models.add(id.toString()); }

  /** Drop a model from this ModelSelector. Model will no longer be displayed by views that use this ModelSelector.
   *  @return true if the model was dropped, false if it was not previously in this ModelSelector
   */
  public dropModel(id: Id): boolean { return this.models.delete(id.toString()); }
}

/** A list of Categories to be displayed in a view.
 *  When a ViewDefinition is loaded into memory, it makes a copy of its CategorySelector, so any in-memory changes do not affect the original.
 *  Changes are not saved unless someone calls Update on the modified copy.
 */
export class CategorySelector extends DefinitionElement {
  public getEcClass(): string { return "CategorySelector"; }
  protected categories: Set<string>;

  /** Get the name of this CategorySelector */
  public getName(): string { return this.code.getValue(); }

  /** Determine whether this CategorySelector includes the specified category */
  public isCategoryViewed(categoryId: Id): boolean { return this.categories.has(categoryId.toString()); }

  /**  Add a category to this CategorySelector */
  public addCategory(id: Id): void { this.categories.add(id.toString()); }

  /** Drop a category from this CategorySelector */
  public dropCategory(id: Id): boolean { return this.categories.delete(id.toString()); }

  /** Add or Drop a category to this CategorySelector */
  public changeCategoryDisplay(categoryId: Id, add: boolean): void { if (add) this.addCategory(categoryId); else this.dropCategory(categoryId); }
}

/** Parameters used to construct a ViewDefinition */
export interface ViewDefinitionCreateParams extends CreateParams {
  categorySelector?: CategorySelector;
}

export enum ViewportStatus {
  Success = 0,
  ViewNotInitialized,
  AlreadyAttached,
  NotAttached,
  DrawFailure,
  NotResized,
  ModelNotFound,
  InvalidWindow,
  MinWindow,
  MaxWindow,
  MaxZoom,
  MaxDisplayDepth,
  InvalidUpVector,
  InvalidTargetPoint,
  InvalidLens,
  InvalidViewport,
}

/** The definition element for a view. ViewDefinitions specify the area/volume that is viewed, and points to a DisplayStyle and a CategorySelector.
 *  Subclasses of ViewDefinition determine which model(s) are viewed.
 *  A ViewController holds an editable copy of a ViewDefinition, and a ViewDefinition holds an editable copy of its DisplayStyle and CategorySelector.
 */
export abstract class ViewDefinition extends DefinitionElement {
  public getEcClass(): string { return "ViewDefinition"; }

  protected _categorySelectorId: Id;
  protected _displayStyleId: Id;
  protected _categorySelector?: CategorySelector;
  protected _displayStyle?: DisplayStyle;

  protected clearState(): void { _categorySelector = undefined; m_displayStyle = undefined; }

  protected constructor(opts: ViewDefinitionCreateParams) { super(opts); if (opts.categorySelector) this.setCategorySelector(opts.categorySelector); }

  public abstract supplyController(): ViewController;
  public isValidBaseModel(model: Model): boolean { return true; }
  public abstract viewsModel(mid: Id): boolean;
  public abstract getOrigin(): Point3d;
  public abstract getExtents(): Vector3d;

  /** Get the 3x3 orthonormal RotMatrix for this view. */
  public abstract getRotation(): RotMatrix;

  public abstract setOrigin(viewOrg: Point3d);
  public abstract setExtents(viewDelta: Vector3d);
  public abstract setRotation(viewRot: RotMatrix);
  public getTargetPoint(): Point3d { return this.getCenter(); }

  public setupFromFrustum(frustum: Frustum): ViewportStatus {
    const frustPts = frustum.points;
    const viewOrg = frustPts[Npc.LeftBottomRear];

    // frustumX, frustumY, frustumZ are vectors along edges of the frustum. They are NOT unit vectors.
    // X and Y should be perpendicular, and Z should be right handed.
    const frustumX = frustPts[Npc.RightBottomRear].minus(viewOrg);
    const frustumY = frustPts[Npc.LeftTopRear].minus(viewOrg);
    const frustumZ = frustPts[Npc.LeftBottomFront].minus(viewOrg);

    const frustMatrix = RotMatrix.createPerpendicularUnitColumns(frustumX, frustumY, AxisOrder.XYZ);
    if (!frustMatrix)
      return ViewportStatus.InvalidWindow;

    findNearbyStandardViewMatrix(frustMatrix);

    const xDir = frustMatrix.getColumn(0);
    const yDir = frustMatrix.getColumn(1);
    const zDir = frustMatrix.getColumn(2);

    // set up view Rotation matrix as rows of frustum matrix.
    const viewRot = frustMatrix.inverse();

    // Left handed frustum?
    const zSize = zDir.dotProduct(frustumZ);
    if (zSize < 0.0)
      return ViewportStatus.InvalidWindow;

    const viewDiagRoot = new Point3d();
    viewDiagRoot.plus2Scaled(xDir, xDir.DotProduct(frustumX), yDir, yDir.DotProduct(frustumY));  // vectors on the back plane
    viewDiagRoot.plusScaled(zDir, zSize);       // add in z vector perpendicular to x,y

    // use center of frustum and view diagonal for origin. Original frustum may not have been orthogonal
    const viewOrg = frustum.getCenter();
    viewOrg.plusScaled(viewDiagRoot, -0.5);

    // delta is in view coordinates
    const viewDelta = viewRot.multiply(viewDiagRoot);

    const validSize = this.validateViewDelta(viewDelta, false);
    if (validSize != ViewportStatus.Success)
      return validSize;

    this.setOrigin(viewOrg);
    this.setExtents(viewDelta);
    this.setRotation(viewRot);
    return ViewportStatus.Success;
  }

  public getExtentLimits() { return { minExtent: Constant.oneMillimeter(), maxExtent: 2.0 * Constant.diameterOfEarth() }; }
  public setupDisplayStyle(style: DisplayStyle) { this._displayStyle = style; this._displayStyleId = style.id; }
  public getDetails(): any { return props.viewDetails; }

  protected adjustAspectRatio(windowAspect: number): void {
    const extents = getExtents();
    const viewAspect = extents.x / extents.y;

    if (this instanceof DrawingViewDefinition)
      windowAspect *= this.getAspectRatioSkew();

    if (Math.abs(1.0 - (viewAspect / windowAspect)) < 1.0e-9)
      return;

    const oldDelta = extents.clone();
    if (viewAspect > windowAspect)
      extents.y = extents.x / windowAspect;
    else
      extents.x = extents.y * windowAspect;

    const origin = this.getOrigin();
    const rMatrix = this.getRotation();
    const newOrigin = rMatrix.multiply(origin);

    newOrigin.x += ((oldDelta.x - extents.x) / 2.0);
    newOrigin.y += ((oldDelta.y - extents.y) / 2.0);

    const transpose = rMatrix.transpose();
    origin = transpose.multiply(newOrigin);
    this.setOrigin(origin);
    this.setExtents(extents);
  }

protected limitWindowSize(value){
    if (value < View.minViewDelta)
        value = View.minViewDelta;
    else if (value > View.maxViewDelta)
        value = View.maxViewDelta;

    return value;
    };

/*---------------------------------------------------------------------------------**//**
* @private
* @bsimethod                                                    Paul.Connelly   10/16
+---------------+---------------+---------------+---------------+---------------+------*/
View.validateViewDelta = function(delta)
    {
    var newX = View.limitWindowSize(delta.x);
    var newY = View.limitWindowSize(delta.y);
    delta.z = View.limitWindowSize(delta.z);
    var limited = newX != delta.x || newY != delta.y;
    if (limited)
        {
        delta.x = newX;
        delta.y = newY;
        }

    return !limited;
    };

  DGNPLATFORM_EXPORT ViewportStatus ValidateViewDelta(DPoint3dR delta, bool displayMessage);

  //! Determine whether two ViewDefinitions are "equal", including their unsaved state
  bool EqualState(ViewDefinitionR other) {return _EqualState(other); }

Utf8String GetDescription() const { return GetPropertyValueString(prop_Description());} //!< Get description
DgnDbStatus SetDescription(Utf8StringCR value) {return SetPropertyValue(prop_Description(), value.c_str()); } //!< Set description

DgnViewId GetViewId() const { return DgnViewId(GetElementId().GetValue());} //!< This ViewDefinition's Id
Utf8String GetName() const { return GetCode().GetValue();} //!< Get the name of this ViewDefinition

/** @name ViewDefinition Details */
/** @{ */

//! Get the current value of a view detail 
JsonValueCR GetDetail(Utf8CP name) const { return GetDetails()[name];}

//! Change the value of a view detail 
void SetDetail(Utf8CP name, JsonValueCR value) {GetDetailsR()[name] = value; }

//! Remove a view detail 
void RemoveDetail(Utf8CP name) {GetDetailsR().removeMember(name); }
/** @} */

// //! Create a ViewController for this ViewDefinition
// DGNPLATFORM_EXPORT ViewControllerPtr LoadViewController(bool allowOverrides= true) const;

// Create a ViewController for the ViewDefinition with the specified Id
// DGNPLATFORM_EXPORT static ViewControllerPtr LoadViewController(DgnViewId viewId, DgnDbR db);

    };

bool IsView3d() const { return nullptr != _ToView3d();}
bool IsOrthographicView() const { return nullptr != _ToOrthographicView();}
bool IsSpatialView() const { return nullptr != _ToSpatialView();}
bool IsDrawingView() const { return nullptr != _ToDrawingView();}
bool IsSheetView() const { return nullptr != _ToSheetView();}
ViewDefinition2dCP ToView2d() const { return _ToView2d();}
bool IsTemplateView2d() const { return nullptr != _ToTemplateView2d();}
bool IsTemplateView3d() const { return nullptr != _ToTemplateView3d();}
ViewDefinition3dCP ToView3d() const { return _ToView3d();}
OrthographicViewDefinitionCP ToOrthographicView() const { return _ToOrthographicView();}
SpatialViewDefinitionCP ToSpatialView() const { return _ToSpatialView();}
DrawingViewDefinitionCP ToDrawingView() const { return _ToDrawingView();}
SheetViewDefinitionCP ToSheetView() const { return _ToSheetView();}
TemplateViewDefinition2dCP ToTemplateView2d() const { return _ToTemplateView2d();}
TemplateViewDefinition3dCP ToTemplateView3d() const { return _ToTemplateView3d();}
ViewDefinition3dP ToView3dP() {return const_cast<ViewDefinition3dP>(ToView3d()); }
ViewDefinition2dP ToView2dP() {return const_cast<ViewDefinition2dP>(ToView2d()); }
SpatialViewDefinitionP ToSpatialViewP() {return const_cast<SpatialViewDefinitionP>(ToSpatialView()); }
DrawingViewDefinitionP ToDrawingViewP() {return const_cast<DrawingViewDefinitionP>(ToDrawingView()); }
SheetViewDefinitionP ToSheetViewP() {return const_cast<SheetViewDefinitionP>(ToSheetView()); }
TemplateViewDefinition2dP ToTemplateView2dP() {return const_cast<TemplateViewDefinition2dP>(ToTemplateView2d()); }
TemplateViewDefinition3dP ToTemplateView3dP() {return const_cast<TemplateViewDefinition3dP>(ToTemplateView3d()); }

//! Get the CategorySelector for this ViewDefinition. 
//! @note this is a non-const method and may only be called on a writeable copy of a ViewDefinition.
DGNPLATFORM_EXPORT CategorySelectorR GetCategorySelector();
DgnElementId GetCategorySelectorId() const { return m_categorySelectorId;}

//! Get the DisplayStyle for this ViewDefinition
//! @note this is a non-const method and may only be called on a writeable copy of a ViewDefinition.
DGNPLATFORM_EXPORT DisplayStyleR GetDisplayStyle();
DgnElementId GetDisplayStyleId() const { return m_displayStyleId;}

//! Set the CategorySelector for this view.
void SetCategorySelector(CategorySelectorR categories) {BeAssert(!IsPersistent()); m_categorySelector = &categories; m_categorySelectorId = categories.GetElementId(); }

//! Get the AuxiliaryCoordinateSystem for this ViewDefinition
DGNPLATFORM_EXPORT DgnElementId GetAuxiliaryCoordinateSystemId() const;

//! Set the AuxiliaryCoordinateSystem for this view.
DGNPLATFORM_EXPORT void SetAuxiliaryCoordinateSystem(DgnElementId acsId);

//! Query if the specified model is displayed in this view
bool ViewsModel(DgnModelId modelId) {return _ViewsModel(modelId); }

//! Query if the specified Category is displayed in this view
bool ViewsCategory(DgnCategoryId id) {return GetCategorySelector().IsCategoryViewed(id); }

//! Get the origin of this view
DPoint3d GetOrigin() const { return _GetOrigin();}

//! Set the origin of this view
void SetOrigin(DPoint3dCR origin) {_SetOrigin(origin); }

//! Get the extents of this view
DVec3d GetExtents() const { return _GetExtents();}

//! Get the aspect ratio (width/height) of this view
double GetAspectRatio() const { auto extents= GetExtents(); return extents.x / extents.y;}

//! Set the extents of this view
void SetExtents(DVec3dCR delta) {_SetExtents(delta); }

RotMatrix GetRotation() const { return _GetRotation();}

//! Change the rotation of the view.
//! @note rot must be orthonormal. For 2d views, only the rotation angle about the z axis is used.
void SetRotation(RotMatrixCR rot) {_SetRotation(rot); }

//! Get the target point of the view. If there is no camera, Center() is returned.
DPoint3d GetTargetPoint() const { return _GetTargetPoint();}

//! Get the point at the geometric center of the view.
DGNPLATFORM_EXPORT DPoint3d GetCenter() const;

//! Get the unit vector that points in the view X (left-to-right) direction.
DVec3d GetXVector() const { DVec3d v; GetRotation().GetRow(v, 0); return v;}

//! Get the unit vector that points in the view Y (bottom-to-top) direction.
DVec3d GetYVector() const { DVec3d v; GetRotation().GetRow(v, 1); return v;}

//! Get the unit vector that points in the view Z (front-to-back) direction.
DVec3d GetZVector() const { DVec3d v; GetRotation().GetRow(v, 2); return v;}

//! Change the view orientation to one of the standard views.
//! @param[in] standardView the rotation to which the view should be set.
//! @return SUCCESS if the view was changed.
DGNPLATFORM_EXPORT BentleyStatus SetStandardViewRotation(StandardView standardView);

//! Set the clipping volume for elements in this view
DGNPLATFORM_EXPORT void SetViewClip(ClipVectorPtr clip);

//! Get the clipping volume for elements in this view
DGNPLATFORM_EXPORT ClipVectorPtr GetViewClip() const;

//! Set the grid settings for this view
DGNPLATFORM_EXPORT void SetGridSettings(GridOrientationType, DPoint2dCR, uint32_t);

//! Get the grid settings for this view
DGNPLATFORM_EXPORT void GetGridSettings(GridOrientationType &, DPoint2dR, uint32_t &) const;

/** Margins for "white space" to be left around view volumes for #LookAtVolume.
 *  Values mean "percent of view" and must be between 0 and .25.
 */
+===============+===============+===============+===============+===============+======*/
struct MarginPercent
{
  private:
  double m_left;
  double m_top;
  double m_right;
  double m_bottom;

  double LimitMargin(double val) {return (val < 0.0) ? 0.0 : (val > .25) ? .25 : val; }

  public:
  MarginPercent(double left, double top, double right, double bottom) {Init(left, top, right, bottom); }
  void Init(double left, double top, double right, double bottom)
  {
    m_left = LimitMargin(left);
    m_top = LimitMargin(top);
    m_right = LimitMargin(right);
    m_bottom = LimitMargin(bottom);
  }

  double Left() const   { return m_left;}
double Top() const    { return m_top;}
double Right() const  { return m_right;}
double Bottom() const { return m_bottom;}
    };

//! Change the volume that this view displays, keeping its current rotation.
//! @param[in] worldVolume The new volume, in world-coordinates, for the view. The resulting view will show all of worldVolume, by fitting a
//! view-axis-aligned bounding box around it. For views that are not aligned with the world coordinate system, this will sometimes
//! result in a much larger volume than worldVolume.
//! @param[in] aspectRatio The X/Y aspect ratio of the view into which the result will be displayed. If the aspect ratio of the volume does not
//! match aspectRatio, the shorter axis is lengthened and the volume is centered. If aspectRatio is nullptr, no adjustment is made.
//! @param[in] margin The amount of "white space" to leave around the view volume (which essentially increases the volume
//! of space shown in the view.) If nullptr, no additional white space is added.
//! @param[in] expandClippingPlanes If false, the front and back clipping planes are not moved. This is rarely desired.
//! @note For 3d views, the camera is centered on the new volume and moved along the view z axis using the default lens angle
//! such that the entire volume is visible.
//! @note, for 2d views, only the X and Y values of volume are used.
DGNPLATFORM_EXPORT void LookAtVolume(DRange3dCR worldVolume, double const* aspectRatio=nullptr, MarginPercent const* margin=nullptr, bool expandClippingPlanes= true);

DGNPLATFORM_EXPORT void LookAtViewAlignedVolume(DRange3dCR volume, double const* aspectRatio=nullptr, MarginPercent const* margin=nullptr, bool expandClippingPlanes= true);

/** @name Thumbnails */
/** @{ */
//! Create and save a thumbnail for this ViewDefinition. Thumbnails are saved as DgnViewProperty values.
//! @param[in] size Optional size (x,y) for the thumbnail. Thumbnails are usually square. Default size is 768x768 pixels.
//! @param[in] modeOverride Optional override for the RenderMode for the thumbnail. If nullptr, use RenderMode from the DisplayStyle.
//! @param[in] timeout time, in seconds, to wait for thumbnails to generate.
//! @return BE_SQLITE_OK if the thumbnail was successfully created and saved.
DGNVIEW_EXPORT BeSQLite::DbResult RenderAndSaveThumbnail(Point2d size, Render::RenderMode const* modeOverride, BeDuration timeout) const ;

//! Create a thumbnail for this ViewDefinition.
//! @param[out] image The thumbnail image.
//! @param[out] modeUsed The RenderMode that was used to generate the thumbnail.
//! @param[in] size Optional size (x,y) for the thumbnail. Thumbnails are usually square. Default size is 768x768 pixels.
//! @param[in] modeOverride Optional override for the RenderMode for the thumbnail. If nullptr, use RenderMode from the DisplayStyle.
//! @param[in] timeout time, in seconds, to wait for thumbnails to generate.
//! @return BE_SQLITE_OK if the thumbnail was successfully created and saved.
DGNVIEW_EXPORT BeSQLite::DbResult RenderThumbnail(Render::Image & image, Render::RenderMode & modeUsed, Point2d size, Render::RenderMode const* modeOverride, BeDuration timeout) const ;

//! Save a thumbnail for this ViewDefinition. Thumbnails are saved as DgnViewProperty values.
//! @param[in] size the size (x,y) of the thumbnail.
//! @param[in] thumbnail The ImageSource data of the thumbnail
//! @return BE_SQLITE_OK if the thumbnail was successfully saved.
//! @note this will overwrite any existing thumbnail for this view
DGNPLATFORM_EXPORT BeSQLite::DbResult SaveThumbnail(Point2d size, Render::ImageSourceCR thumbnail) const;

//! Read the thumbnail for this ViewDefinition.
//! @return the Render::ImageSource holding the compressed stream for the thumbnail. Will be invalid if no thumbnail available.
DGNPLATFORM_EXPORT Render::ImageSource ReadThumbnail() const;

//! Get the size (x,y) of the thumbnail for this ViewDefinition.
//! @return the size of the thumbnail. Will be {0,0} if no thumbnail is available.
DGNPLATFORM_EXPORT Point2d GetThumbnailSize() const;

//! Delete the thumbnail for this view.
DGNPLATFORM_EXPORT void DeleteThumbnail() const;
    /** @} */
};

/** @addtogroup GROUP_DgnView DgnView Module
<h4>%ViewDefintion3d Camera</h4>

This is what the parameters to the camera methods, and the values stored by ViewDefinition3d mean.
@verbatim
               v-- {origin}
          -----+-------------------------------------- -   [back plane]
          ^\   .                                    /  ^
          | \  .                                   /   |        P
        d |  \ .                                  /    |        o
        e |   \.         {targetPoint}           /     |        s
        l |    |---------------+----------------|      |        i    [focus plane]
        t |     \  ^delta.x    ^               /     b |        t
        a |      \             |              /      a |        i
        . |       \            |             /       c |        v
        z |        \           | f          /        k |        e
          |         \          | o         /         D |        Z
          |          \         | c        /          i |        |
          |           \        | u       /           s |        v
          v            \       | s      /            t |
          -     -       -----  | D -----               |   [front plane]
                ^              | i                     |
                |              | s                     |
    frontDist ->|              | t                     |
                |              |                       |
                v           \  v  / <- lens angle      v
                -              + {eyePoint}            -     positiveX ->

@endverbatim

   Notes:
         - Up vector (positiveY) points out of the screen towards you in this diagram. Likewise delta.y.
         - The view origin is in world coordinates. It is the point at the lower left of the rectangle at the
           focus plane, projected onto the back plane.
         - [delta.x,delta.y] are on the focus plane and delta.z is from the back plane to the front plane.
         - The three view vectors come from:
@verbatim
                {vector from eyePoint->targetPoint} : -Z (positive view Z points towards negative world Z)
                {the up vector}                     : +Y
                {Z cross Y}                         : +X
@endverbatim
           these three vectors form the rows of the view's RotMatrix
         - Objects in space in front of the front plane or behind the back plane are not displayed.
         - The focus plane is not necessarily centered between the front plane and back plane (though it often is). It should generally be
           between the front plane and the back plane.
         - targetPoint is not stored in the view parameters. Instead it may be derived from
           {origin},{eyePoint},[RotMatrix] and focusDist.
         - The view volume is completely specified by: @verbatim {origin}<delta>[RotMatrix] @endverbatim
         - Perspective is determined by {eyePoint}, which is independent of the view volume. Sometimes the eyepoint is not centered
           on the rectangle on the focus plane (that is, a vector from the eyepoint along the viewZ does not hit the view center.)
           This creates a 1-point perspective, which can be disconcerting. It is usually best to keep the camera centered.
         - Cameras hold a "lens angle" value which is defines the field-of-view for the camera in radians.
           The lens angle value is not used to compute the perspective transform for a view. Instead, the lens angle value
           can be used to reposition {eyePoint} when the view volume or target changes.
         - View volumes where one dimension is very small or large relative to the other dimensions (e.g. "long skinny telescope" views,
           or "wide and shallow slices", etc.) are problematic and disallowed based on ratio limits.
*/

