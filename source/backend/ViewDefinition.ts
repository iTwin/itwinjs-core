/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { DefinitionElement } from "./Element";
import { ElementProps } from "../ElementProps";
import { Appearance, SubCategoryOverride } from "./Category";
import { ViewFlags, HiddenLine, ColorDef } from "../Render";
import { Light, LightType } from "../Lighting";
import { ClipVector } from "../ClipVector";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { Vector3d, Vector2d, Point3d, Point2d, Range3d, RotMatrix, Transform, YawPitchRollAngles } from "@bentley/geometry-core/lib/PointVector";
import { AxisOrder, Angle, Geometry } from "@bentley/geometry-core/lib/Geometry";
import { Map4d } from "@bentley/geometry-core/lib/numerics/Geometry4d";
import { Constant } from "@bentley/geometry-core/lib/Constant";
import { JsonUtils } from "@bentley/bentleyjs-core/lib/JsonUtils";
import { assert } from "@bentley/bentleyjs-core/lib/Assert";

export class ViewController { }

/** The 8 corners of the NPC cube. */
export const enum Npc {
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
  CORNER_COUNT = 8,
}

export const enum GridOrientationType {
  View = 0,
  WorldXY = 1, // Top
  WorldYZ = 2, // Right
  WorldXZ = 3, // Front
  AuxCoord = 4,
  GeoCoord = 5,
}

export let standardView = {
  Top: RotMatrix.identity,
  Bottom: RotMatrix.createRowValues(1, 0, 0, 0, -1, 0, 0, 0, -1),
  Left: RotMatrix.createRowValues(0, 0, -1, -1, 0, 0, 0, 1, 0),
  Right: RotMatrix.createRowValues(0, 0, 1, 1, 0, 0, 0, 1, 0),
  Front: RotMatrix.createRowValues(1, 0, 0, 0, 0, -1, 0, 1, 0),
  Back: RotMatrix.createRowValues(-1, 0, 0, 0, 0, 1, 0, 1, 0),
  Iso: RotMatrix.createRowValues(
    0.707106781186548, 0.408248290463863, -0.577350269189626,
    -0.70710678118654757, 0.40824829046386302, -0.57735026918962573,
    0, 0.81649658092772603, 0.57735026918962573),
  RightIso: RotMatrix.createRowValues(
    0.707106781186548, -0.408248290463863, 0.577350269189626,
    0.70710678118654757, 0.40824829046386302, -0.57735026918962573,
    0, 0.81649658092772603, 0.57735026918962573),
};

export let standardViewMatrices = [
  standardView.Top, standardView.Bottom, standardView.Left, standardView.Right,
  standardView.Front, standardView.Back, standardView.Iso, standardView.RightIso,
];

/** adjust to any nearby standard view */
function findNearbyStandardViewMatrix(rMatrix: RotMatrix): void {
  for (const test of standardViewMatrices) {
    if (test.maxDiff(rMatrix) < 1.0e-7) {
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
  public constructor() { for (let i = 0; i < 8; ++i) this.points[i] = new Point3d(); }
  public getCorner(i: number) { return this.points[i]; }
  public getCenter(): Point3d { return this.getCorner(Npc.RightTopFront).interpolate(0.5, this.getCorner(Npc.LeftBottomRear)); }
  public distance(corner1: number, corner2: number): number { return this.getCorner(corner1).distance(this.getCorner(corner2)); }
  public getFraction(): number { return this.distance(Npc.LeftTopFront, Npc.RightBottomFront) / this.distance(Npc.LeftTopRear, Npc.RightBottomRear); }
  public multiply(trans: Transform): void { trans.multiplyPoint3dArrayInPlace(this.points); }
  public translate(offset: Vector3d): void { for (const pt of this.points) pt.plus(offset); }
  public transformBy(trans: Transform, result?: Frustum): Frustum { result = result ? result : new Frustum(); trans.multiplyPoint3dArray(this.points, result.points); return result; }
  public toRange(range?: Range3d): Range3d { range = range ? range : new Range3d(); Range3d.createArray(this.points, range); return range; }
  public clone(result?: Frustum): Frustum { result = result ? result : new Frustum(); for (let i = 0; i < 8; ++i) Point3d.createFrom(this.points[i], result.points[i]); return result; }
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

  public toDMap4d(): Map4d | undefined {
    const org = this.getCorner(Npc.LeftBottomRear);
    const xVec = org.vectorTo(this.getCorner(Npc.RightBottomRear));
    const yVec = org.vectorTo(this.getCorner(Npc.LeftTopRear));
    const zVec = org.vectorTo(this.getCorner(Npc.LeftBottomFront));
    return Map4d.createVectorFrustum(org, xVec, yVec, zVec, this.getFraction());
  }

  public invalidate(): void { for (let i = 0; i < 8; ++i) this.points[i].set(0, 0, 0); }
  public equals(rhs: Frustum): boolean {
    for (let i = 0; i < 8; ++i) {
      if (!this.points[i].isExactEqual(rhs.points[i]))
        return false;
    }
    return true;
  }

  /** Initialize this Frustum from a Range3d */
  public initFromRange(range: Range3d): void {
    const pts = this.points;
    pts[0].x = pts[3].x = pts[4].x = pts[7].x = range.low.x;
    pts[1].x = pts[2].x = pts[5].x = pts[6].x = range.high.x;
    pts[0].y = pts[1].y = pts[4].y = pts[5].y = range.low.y;
    pts[2].y = pts[3].y = pts[6].y = pts[7].y = range.high.y;
    pts[0].z = pts[1].z = pts[2].z = pts[3].z = range.low.z;
    pts[4].z = pts[5].z = pts[6].z = pts[7].z = range.high.z;
  }

  /** Create a new Frustum from a Range3d */
  public static fromRange(range: Range3d): Frustum {
    const frustum = new Frustum();
    frustum.initFromRange(range);
    return frustum;
  }
}

/** A DisplayStyle defines the parameters for 'styling' the contents of a View */
export class DisplayStyle extends DefinitionElement {
  protected _subcategories: Map<string, Appearance>;
  protected _subCategoryOvr: Map<string, SubCategoryOverride>;
  public viewFlags: ViewFlags;

  constructor(props: ElementProps) { super(props); }

  public getStyles(): any { const p = this.jsonProperties as any; if (!p.styles) p.styles = new Object(); return p.styles; }
  public getStyle(name: string): any {
    const style: object = this.getStyles()[name];
    return style ? style : new Object();
  }
  /** change the value of a style on this DisplayStyle */
  public setStyle(name: string, value: any): void { this.getStyles()[name] = value; }

  /** Remove a Style from this DisplayStyle. */
  public removeStyle(name: string) { delete this.getStyles()[name]; }

  /** Get the background color for this DisplayStyle */
  public getBackgroundColor(): ColorDef { return ColorDef.fromJSON(this.getStyle("backgroundColor")); }

  /** Set the background color for this DisplayStyle */
  public setBackgroundColor(val: ColorDef): void { this.setStyle("backgroundColor", val); }

  public getMonochromeColor(): ColorDef { return ColorDef.fromJSON(this.getStyle("monochromeColor")); }
  public setMonochromeColor(val: ColorDef): void { this.setStyle("monochromeColor", val); }
}

/** A DisplayStyle for 2d views */
export class DisplayStyle2d extends DisplayStyle {
  constructor(props: ElementProps) { super(props); }
}

/** A circle drawn at a Z elevation, whose diameter is the the XY diagonal of the project extents */
export class GroundPlane {
  public enabled: boolean = false;
  public elevation: number = 0.0;  // the Z height to draw the ground plane
  public aboveColor: ColorDef;     // the color to draw the ground plane if the view shows the ground from above
  public belowColor: ColorDef;     // the color to draw the ground plane if the view shows the ground from below
}

/** the SkyBox is a draws in the background of spatial views to provide context. */
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
  public constructor(props: ElementProps) { super(props); }
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
  public getSceneBrightness(): number { return JsonUtils.asDouble(this.getStyle("sceneLights").fstop, 0.0); }
}

/** A list of GeometricModels for a SpatialViewDefinition.
 *  When a SpatialViewDefinition is loaded into a ViewController, it makes a copy of its ModelSelector, so any in-memory changes do not affect the original.
 *  Changes are not saved unless someone calls Update on the modified copy.
 */
export class ModelSelector extends DefinitionElement {
  protected models: Set<string>;
  constructor(props: ElementProps) { super(props); this.models = new Set<string>(); }

  /** Get the name of this ModelSelector */
  public getName(): string { return this.code.getValue(); }

  /** Query if the specified DgnModelId is selected by this ModelSelector */
  public containsModel(modelId: Id64): boolean { return this.models.has(modelId.toString()); }

  /**  Add a model to this ModelSelector */
  public addModel(id: Id64): void { this.models.add(id.toString()); }

  /** Drop a model from this ModelSelector. Model will no longer be displayed by views that use this ModelSelector.
   *  @returns true if the model was dropped, false if it was not previously in this ModelSelector
   */
  public dropModel(id: Id64): boolean { return this.models.delete(id.toString()); }
}

/** A list of Categories to be displayed in a view.
 *  When a ViewDefinition is loaded into memory, it makes a copy of its CategorySelector, so any in-memory changes do not affect the original.
 *  Changes are not saved unless someone calls Update on the modified copy.
 */
export class CategorySelector extends DefinitionElement {
  protected categories: Set<string>;
  constructor(props: ElementProps) { super(props); this.categories = new Set<string>(); }

  /** Get the name of this CategorySelector */
  public getName(): string { return this.code.getValue(); }

  /** Determine whether this CategorySelector includes the specified category */
  public isCategoryViewed(categoryId: Id64): boolean { return this.categories.has(categoryId.toString()); }

  /**  Add a category to this CategorySelector */
  public addCategory(id: Id64): void { this.categories.add(id.toString()); }

  /** Drop a category from this CategorySelector */
  public dropCategory(id: Id64): boolean { return this.categories.delete(id.toString()); }

  /** Add or Drop a category to this CategorySelector */
  public changeCategoryDisplay(categoryId: Id64, add: boolean): void { if (add) this.addCategory(categoryId); else this.dropCategory(categoryId); }
}

/** Parameters used to construct a ViewDefinition */
export interface ViewDefinitionProps extends ElementProps {
  categorySelectorId?: Id64;
  displayStyleId?: any;
  categorySelector?: CategorySelector;
  displayStyle?: DisplayStyle;
}

export const enum ViewportStatus {
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

/** Margins for white space to be left around view volumes for ViewDefinition.lookAtVolume.
 *  Values mean "percent of view" and must be between 0 and .25.
 */
export class MarginPercent {
  private static limitMargin(val: number) { return (val < 0.0) ? 0.0 : (val > .25) ? .25 : val; }
  constructor(public left: number, public top: number, public right: number, public bottom: number) {
    this.left = MarginPercent.limitMargin(left);
    this.top = MarginPercent.limitMargin(top);
    this.right = MarginPercent.limitMargin(right);
    this.bottom = MarginPercent.limitMargin(bottom);
  }
}

/**
 * The definition element for a view. ViewDefinitions specify the area/volume that is viewed, and points to a DisplayStyle and a CategorySelector.
 * Subclasses of ViewDefinition determine which model(s) are viewed.
 * A ViewController holds an editable copy of a ViewDefinition, and a ViewDefinition holds an editable copy of its DisplayStyle and CategorySelector.
 */
export abstract class ViewDefinition extends DefinitionElement implements ViewDefinitionProps {
  public categorySelectorId: Id64;
  public displayStyleId: Id64;
  protected _categorySelector?: CategorySelector;
  protected _displayStyle?: DisplayStyle;
  protected clearState(): void { this._categorySelector = undefined; this._displayStyle = undefined; }
  protected constructor(props: ViewDefinitionProps) {
    super(props);
    this.categorySelectorId = new Id64(props.categorySelectorId);
    this.displayStyleId = new Id64(props.displayStyleId);
    if (props.categorySelector)
      this.setCategorySelector(props.categorySelector.copyForEdit<CategorySelector>());
    if (props.displayStyle)
      this.setDisplayStyle(props.displayStyle.copyForEdit<DisplayStyle>());
  }

  public isView3d(): boolean { return this instanceof ViewDefinition3d; }
  public isSpatialView(): boolean { return this instanceof SpatialViewDefinition; }

  /** Determine whether this ViewDefinition views a given model */
  public abstract viewsModel(modelId: Id64): boolean;

  /** Get the origin of this view */
  public abstract getOrigin(): Point3d;

  /** Get the extents of this view */
  public abstract getExtents(): Vector3d;

  /** Get the 3x3 ortho-normal RotMatrix for this view. */
  public abstract getRotation(): RotMatrix;

  /** Set the origin of this view */
  public abstract setOrigin(viewOrg: Point3d): void;

  /** Set the extents of this view */
  public abstract setExtents(viewDelta: Vector3d): void;

  /** Change the rotation of the view.
   *  @note rot must be ortho-normal. For 2d views, only the rotation angle about the z axis is used.
   */
  public abstract setRotation(viewRot: RotMatrix): void;

  /**  Get the target point of the view. If there is no camera, center is returned. */
  public getTargetPoint(): Point3d { return this.getCenter(); }

  /**  Get the point at the geometric center of the view. */
  public getCenter(): Point3d {
    const delta = this.getRotation().transpose().multiplyVector(this.getExtents());
    return this.getOrigin().plusScaled(delta, 0.0);
  }

  /**
   * Initialize the origin, extents, and rotation of this ViewDefinition from an existing Frustum
   * @param frustum the input Frustum.
   */
  public setupFromFrustum(frustum: Frustum): ViewportStatus {
    const frustPts = frustum.points;
    let viewOrg = frustPts[Npc.LeftBottomRear];

    // frustumX, frustumY, frustumZ are vectors along edges of the frustum. They are NOT unit vectors.
    // X and Y should be perpendicular, and Z should be right handed.
    const frustumX = viewOrg.vectorTo(frustPts[Npc.RightBottomRear]);
    const frustumY = viewOrg.vectorTo(frustPts[Npc.LeftTopRear]);
    const frustumZ = viewOrg.vectorTo(frustPts[Npc.LeftBottomFront]);

    const frustMatrix = RotMatrix.createPerpendicularUnitColumns(frustumX, frustumY, AxisOrder.XYZ);
    if (!frustMatrix)
      return ViewportStatus.InvalidWindow;

    findNearbyStandardViewMatrix(frustMatrix);

    const xDir = frustMatrix.getColumn(0);
    const yDir = frustMatrix.getColumn(1);
    const zDir = frustMatrix.getColumn(2);

    // set up view Rotation matrix as rows of frustum matrix.
    const viewRot = frustMatrix.inverse();
    if (!viewRot)
      return ViewportStatus.InvalidWindow;

    // Left handed frustum?
    const zSize = zDir.dotProduct(frustumZ);
    if (zSize < 0.0)
      return ViewportStatus.InvalidWindow;

    const viewDiagRoot = new Vector3d();
    viewDiagRoot.plus2Scaled(xDir, xDir.dotProduct(frustumX), yDir, yDir.dotProduct(frustumY));  // vectors on the back plane
    viewDiagRoot.plusScaled(zDir, zSize);       // add in z vector perpendicular to x,y

    // use center of frustum and view diagonal for origin. Original frustum may not have been orthogonal
    viewOrg = frustum.getCenter().plusScaled(viewDiagRoot, -0.5);

    // delta is in view coordinates
    const viewDelta = viewRot.multiplyVector(viewDiagRoot);
    const validSize = this.validateViewDelta(viewDelta, false);
    if (validSize !== ViewportStatus.Success)
      return validSize;

    this.setOrigin(viewOrg);
    this.setExtents(viewDelta);
    this.setRotation(viewRot);
    return ViewportStatus.Success;
  }

  protected getExtentLimits() { return { minExtent: Constant.oneMillimeter, maxExtent: 2.0 * Constant.diameterOfEarth }; }
  public setDisplayStyle(style: DisplayStyle) { assert(!style.isPersistent()); this._displayStyle = style; this.displayStyleId = style.id; }
  public getDetails(): any { if (!this.jsonProperties.viewDetails) this.jsonProperties.viewDetails = new Object(); return this.jsonProperties.viewDetails; }

  protected adjustAspectRatio(windowAspect: number): void {
    const extents = this.getExtents();
    const viewAspect = extents.x / extents.y;
    windowAspect *= this.getAspectRatioSkew();

    if (Math.abs(1.0 - (viewAspect / windowAspect)) < 1.0e-9)
      return;

    const oldDelta = extents.clone();
    if (viewAspect > windowAspect)
      extents.y = extents.x / windowAspect;
    else
      extents.x = extents.y * windowAspect;

    let origin = this.getOrigin();
    const trans = Transform.createOriginAndMatrix(Point3d.createZero(), this.getRotation());
    const newOrigin = trans.multiplyPoint(origin);

    newOrigin.x += ((oldDelta.x - extents.x) / 2.0);
    newOrigin.y += ((oldDelta.y - extents.y) / 2.0);

    origin = (trans.inverse() as Transform).multiplyPoint(newOrigin);
    this.setOrigin(origin);
    this.setExtents(extents);
  }

  protected validateViewDelta(delta: Vector3d, messageNeeded?: boolean): ViewportStatus {
    const limit = this.getExtentLimits();
    let error = ViewportStatus.Success;

    const limitWindowSize = (v: number) => {
      if (v < limit.minExtent) {
        v = limit.minExtent;
        error = ViewportStatus.MinWindow;
      } else if (v > limit.maxExtent) {
        v = limit.maxExtent;
        error = ViewportStatus.MaxWindow;
      }
      return v;
    };

    delta.x = limitWindowSize(delta.x);
    delta.y = limitWindowSize(delta.y);
    delta.z = limitWindowSize(delta.z);

    if (messageNeeded && error !== ViewportStatus.Success) {
      //      Viewport::OutputFrustumErrorMessage(error);
    }

    return error;
  }

  /** Get the name of this ViewDefinition */
  public getName(): string { return this.code.getValue(); }

  /** Get the current value of a view detail */
  public getDetail(name: string): any { const v = this.getDetails()[name]; return v ? v : {}; }

  /** Change the value of a view detail */
  public setDetail(name: string, value: any) { this.getDetails()[name] = value; }

  /** Remove a view detail */
  public removeDetail(name: string) { delete this.getDetails()[name]; }

  /** Get the CategorySelector for this ViewDefinition.
   *  @note this method may only be called on a writeable copy of a ViewDefinition.
   */
  public getCategorySelector() {
    /* NEEDS WORK if (!this._categorySelector)
      this.categorySelector = this.iModel.iModelToken.
    */
    return this._categorySelector;

  }
  public getCategorySelectorId() { return this.categorySelectorId; }

  /** Get the DisplayStyle for this ViewDefinition
   *  @note this is a non-const method and may only be called on a writeable copy of a ViewDefinition.
   */
  public getDisplayStyle() {/*NEEDS_WORK*/ return this._displayStyle; }
  public getDisplayStyleId() { return this.displayStyleId; }

  /** Set the CategorySelector for this view. */
  public setCategorySelector(categories: CategorySelector) { this._categorySelector = categories; this.categorySelectorId = categories.id; }

  /** Get the AuxiliaryCoordinateSystem for this ViewDefinition */
  public getAuxiliaryCoordinateSystemId(): Id64 { return new Id64(this.getDetail("acs")); }

  /** Set the AuxiliaryCoordinateSystem for this view. */
  public setAuxiliaryCoordinateSystem(acsId: Id64) {
    if (acsId.isValid())
      this.setDetail("acs", acsId.toString());
    else
      this.removeDetail("acs");
  }

  /** Query if the specified Category is displayed in this view */
  public viewsCategory(id: Id64): boolean { return this._categorySelector!.isCategoryViewed(id); }

  /**  Get the aspect ratio (width/height) of this view */
  public getAspectRatio(): number { const extents = this.getExtents(); return extents.x / extents.y; }

  /** Get the aspect ratio skew (x/y, usually 1.0) that can be used to exaggerate one axis of the view. */
  public getAspectRatioSkew(): number { return JsonUtils.asDouble(this.getDetail("aspectSkew"), 1.0); }

  /** Set the aspect ratio skew for this view */
  public setAspectRatioSkew(val: number) {
    if (!val || val === 1.0) {
      this.removeDetail("aspectSkew");
    } else {
      this.setDetail("aspectSkew", val);
    }
  }

  /** Get the unit vector that points in the view X (left-to-right) direction. */
  public getXVector(): Vector3d { return this.getRotation().getRow(0); }

  /**  Get the unit vector that points in the view Y (bottom-to-top) direction. */
  public getYVector(): Vector3d { return this.getRotation().getRow(1); }

  /** Get the unit vector that points in the view Z (front-to-back) direction. */
  public getZVector(): Vector3d { return this.getRotation().getRow(2); }

  /** Set the clipping volume for this view. */
  public setViewClip(clip?: ClipVector) {
    if (clip && clip.isValid())
      this.setDetail("clip", clip.toJSON());
    else
      this.removeDetail("clip");
  }

  /** Get the clipping volume for this view */
  public getViewClip(): ClipVector { return ClipVector.fromJSON(this.getDetail("clip")); }

  /** Set the grid settings for this view */
  public setGridSettings(orientation: GridOrientationType, spacing: Point2d, gridsPerRef: number): void {
    switch (orientation) {
      case GridOrientationType.WorldYZ:
      case GridOrientationType.WorldXZ:
        if (!this.isView3d())
          return;
        break;

      case GridOrientationType.GeoCoord:
        if (!this.isSpatialView())
          return;
        break;
    }

    const details = this.getDetails();
    JsonUtils.setOrRemoveNumber(details, "gridOrient", orientation, GridOrientationType.WorldXY);
    JsonUtils.setOrRemoveNumber(details, "gridPerRef", gridsPerRef, 10);
    JsonUtils.setOrRemoveNumber(details, "gridSpaceX", spacing.x, 1.0);
    JsonUtils.setOrRemoveNumber(details, "gridSpaceY", spacing.y, spacing.x);
  }

  /** Get the grid settings for this view */
  public getGridSettings() {
    const out: any = {};
    out.orientation = JsonUtils.asInt(this.getDetail("gridOrient"), GridOrientationType.WorldXY);
    out.gridsPerRef = JsonUtils.asInt(this.getDetail("gridPerRef"), 10);
    out.spacing.x = JsonUtils.asInt(this.getDetail("gridSpaceX"), 1.0);
    out.spacing.y = JsonUtils.asInt(this.getDetail("gridSpaceY"), out.spacing.x);
    return out;
  }

  /**
   * Change the volume that this view displays, keeping its current rotation.
   * @param worldVolume The new volume, in world-coordinates, for the view. The resulting view will show all of worldVolume, by fitting a
   * view-axis-aligned bounding box around it. For views that are not aligned with the world coordinate system, this will sometimes
   * result in a much larger volume than worldVolume.
   * @param aspectRatio The X/Y aspect ratio of the view into which the result will be displayed. If the aspect ratio of the volume does not
   * match aspectRatio, the shorter axis is lengthened and the volume is centered. If aspectRatio is undefined, no adjustment is made.
   * @param margin The amount of "white space" to leave around the view volume (which essentially increases the volume
   * of space shown in the view.) If undefined, no additional white space is added.
   * @note, for 2d views, only the X and Y values of volume are used.
   */
  public lookAtVolume(volume: Range3d, aspect?: number, margin?: MarginPercent) {
    const rangeBox = volume.corners();
    this.getRotation().multiplyVectorArrayInPlace(rangeBox);
    return this.lookAtViewAlignedVolume(Range3d.createArray(rangeBox), aspect, margin);
  }

  public lookAtViewAlignedVolume(volume: Range3d, aspect?: number, margin?: MarginPercent) {
    const viewRot = this.getRotation().clone();

    const newOrigin = volume.low.clone();
    let newDelta = Vector3d.createStartEnd(volume.high, volume.low);

    const minimumDepth = Constant.oneMillimeter;
    if (newDelta.z < minimumDepth) {
      newOrigin.z -= (minimumDepth - newDelta.z) / 2.0;
      newDelta.z = minimumDepth;
    }

    let origNewDelta = newDelta.clone();

    const isCamera: boolean = this.isView3d();
    const isCameraOn: boolean = isCamera && this.cameraOn;
    if (isCameraOn) {
      // If the camera is on, the only way to guarantee we can see the entire volume is to set delta at the front plane, not focus plane.
      // That generally causes the view to be too large (objects in it are too small), since we can't tell whether the objects are at
      // the front or back of the view. For this reason, don't attempt to add any "margin" to camera views.
    } else if (margin) {
      // compute how much space we'll need for both of X and Y margins in root coordinates
      const wPercent = margin.left + margin.right;
      const hPercent = margin.top + margin.bottom;

      const marginHoriz = wPercent / (1 - wPercent) * newDelta.x;
      const marginVert = hPercent / (1 - hPercent) * newDelta.y;

      // compute left and bottom margins in root coordinates
      const marginLeft = margin.left / (1 - wPercent) * newDelta.x;
      const marginBottom = margin.bottom / (1 - hPercent) * newDelta.y;

      // add the margins to the range
      newOrigin.x -= marginLeft;
      newOrigin.y -= marginBottom;
      newDelta.x += marginHoriz;
      newDelta.y += marginVert;

      // don't fix the origin due to changes in delta here
      origNewDelta = newDelta.clone();
    } else {
      newDelta.scale(1.04); // default "dilation"
    }

    if (isCameraOn) {
      // make sure that the zDelta is large enough so that entire model will be visible from any rotation
      const diag = newDelta.magnitudeXY();
      if (diag > newDelta.z)
        newDelta.z = diag;
    }

    this.validateViewDelta(newDelta, true);

    this.setExtents(newDelta);
    if (aspect)
      this.adjustAspectRatio(aspect);

    newDelta = this.getExtents();

    newOrigin.x -= (newDelta.x - origNewDelta.x) / 2.0;
    newOrigin.y -= (newDelta.y - origNewDelta.y) / 2.0;
    newOrigin.z -= (newDelta.z - origNewDelta.z) / 2.0;

    this.setOrigin(viewRot.multiplyInverseXYZAsPoint3d(newOrigin.x, newOrigin.y, newOrigin.z)!);

    if (!isCamera)
      return;

    const cameraDef: Camera = this.camera;
    cameraDef.validateLens();
    // move the camera back so the entire x,y range is visible at front plane
    const frontDist = Math.max(newDelta.x, newDelta.y) / (2.0 * Math.tan(cameraDef.getLensAngle().radians / 2.0));
    const backDist = frontDist + newDelta.z;

    cameraDef.setFocusDistance(frontDist); // do this even if the camera isn't currently on.
    this.centerEyePoint(backDist); // do this even if the camera isn't currently on.
    this.verifyFocusPlane(); // changes delta/origin
  }
}

/**
 * This is what the parameters to the camera methods, and the values stored by ViewDefinition3d mean.
 * @verbatim
 *                v-- {origin}
 *           -----+-------------------------------------- -   [back plane]
 *           ^\   .                                    /  ^
 *           | \  .                                   /   |        P
 *         d |  \ .                                  /    |        o
 *         e |   \.         {targetPoint}           /     |        s
 *         l |    |---------------+----------------|      |        i    [focus plane]
 *         t |     \  ^delta.x    ^               /     b |        t
 *         a |      \             |              /      a |        i
 *         . |       \            |             /       c |        v
 *         z |        \           | f          /        k |        e
 *           |         \          | o         /         D |        Z
 *           |          \         | c        /          i |        |
 *           |           \        | u       /           s |        v
 *           v            \       | s      /            t |
 *           -     -       -----  | D -----               |   [front plane]
 *                 ^              | i                     |
 *                 |              | s                     |
 *     frontDist ->|              | t                     |
 *                 |              |                       |
 *                 v           \  v  / <- lens angle      v
 *                 -              + {eyePoint}            -     positiveX ->
 * @endverbatim
 *    Notes:
 *          - Up vector (positiveY) points out of the screen towards you in this diagram. Likewise delta.y.
 *          - The view origin is in world coordinates. It is the point at the lower left of the rectangle at the
 *            focus plane, projected onto the back plane.
 *          - [delta.x,delta.y] are on the focus plane and delta.z is from the back plane to the front plane.
 *          - The three view vectors come from:
 * @verbatim
 *                 {vector from eyePoint->targetPoint} : -Z (positive view Z points towards negative world Z)
 *                 {the up vector}                     : +Y
 *                 {Z cross Y}                         : +X
 * @endverbatim
 *            these three vectors form the rows of the view's RotMatrix
 *          - Objects in space in front of the front plane or behind the back plane are not displayed.
 *          - The focus plane is not necessarily centered between the front plane and back plane (though it often is). It should generally be
 *            between the front plane and the back plane.
 *          - targetPoint is not stored in the view parameters. Instead it may be derived from
 *            {origin},{eyePoint},[RotMatrix] and focusDist.
 *          - The view volume is completely specified by: @verbatim {origin}<delta>[RotMatrix] @endverbatim
 *          - Perspective is determined by {eyePoint}, which is independent of the view volume. Sometimes the eyepoint is not centered
 *            on the rectangle on the focus plane (that is, a vector from the eyepoint along the viewZ does not hit the view center.)
 *            This creates a 1-point perspective, which can be disconcerting. It is usually best to keep the camera centered.
 *          - Cameras hold a "lens angle" value which is defines the field-of-view for the camera in radians.
 *            The lens angle value is not used to compute the perspective transform for a view. Instead, the lens angle value
 *            can be used to reposition {eyePoint} when the view volume or target changes.
 *          - View volumes where one dimension is very small or large relative to the other dimensions (e.g. "long skinny telescope" views,
 *            or "wide and shallow slices", etc.) are problematic and disallowed based on ratio limits.
 */

/** The current position, lens angle, and focus distance of a camera. */
export class Camera {
  public lens: Angle;
  public focusDistance: number = 0.0;
  public eye: Point3d = new Point3d(0.0, 0.0, 0.0);

  public static isValidLensAngle(val: Angle) { return val.radians > (Math.PI / 8.0) && val < Angle.createRadians(Math.PI); }
  public invalidateFocus() { this.focusDistance = 0.0; }
  public isFocusValid() { return this.focusDistance > 0.0 && this.focusDistance < 1.0e14; }
  public getFocusDistance() { return this.focusDistance; }
  public setFocusDistance(dist: number) { this.focusDistance = dist; }
  public isLensValid() { return Camera.isValidLensAngle(this.lens); }
  public validateLens() { if (!this.isLensValid()) this.lens = Angle.createRadians(Math.PI / 2.0); }
  public getLensAngle() { return this.lens; }
  public setLensAngle(angle: Angle) { this.lens = angle; }
  public getEyePoint() { return this.eye; }
  public setEyePoint(pt: Point3d) { this.eye = pt; }
  public isValid() { return this.isLensValid() && this.isFocusValid(); }
  public isEqual(other: Camera) { return this.lens === other.lens && this.focusDistance === other.focusDistance && this.eye.isExactEqual(other.eye); }

  public static fromJSON(json?: any): Camera {
    const camera = new Camera();
    if (json) {
      camera.lens = Angle.fromJSON(json.lens);
      camera.focusDistance = JsonUtils.asDouble(json.focusDistance);
      camera.eye = Point3d.fromJSON(json.eye);
    }
    return camera;
  }
}

/** Parameters to construct a ViewDefinition3d */
export interface ViewDefinition3dProps extends ViewDefinitionProps {
  cameraOn?: any;  // if true, m_camera is valid.
  origin?: any;    // The lower left back corner of the view frustum.
  extents?: any;   // The extent of the view frustum.
  angles?: any;    // Rotation of the view frustum.
  camera?: any;    // The camera used for this view.
  displayStyle?: DisplayStyle3d;
}

/** Defines a view of 3d models. */
export abstract class ViewDefinition3d extends ViewDefinition implements ViewDefinition3dProps {
  protected _cameraOn: boolean;  // if true, m_camera is valid.
  public origin: Point3d;        // The lower left back corner of the view frustum.
  public extents: Vector3d;      // The extent of the view frustum.
  public rotation: RotMatrix;    // Rotation of the view frustum.
  public camera: Camera;         // The camera used for this view.

  public setupFromFrustum(frustum: Frustum): ViewportStatus {
    const stat = super.setupFromFrustum(frustum);
    if (ViewportStatus.Success !== stat)
      return stat;

    this.turnCameraOff();
    const frustPts = frustum.points;

    // use comparison of back, front plane X sizes to indicate camera or flat view ...
    const xBack = frustPts[Npc.LeftBottomRear].distance(frustPts[Npc.RightBottomRear]);
    const xFront = frustPts[Npc.LeftBottomFront].distance(frustPts[Npc.RightBottomFront]);

    const sFlatViewFractionTolerance = 1.0e-6;
    if (xFront > xBack * (1.0 + sFlatViewFractionTolerance))
      return ViewportStatus.InvalidWindow;

    // see if the frustum is tapered, and if so, set up camera eyepoint and adjust viewOrg and delta.
    const compression = xFront / xBack;
    if (compression >= (1.0 - sFlatViewFractionTolerance))
      return ViewportStatus.Success;

    let viewOrg = frustPts[Npc.LeftBottomRear];
    const viewDelta = this.getExtents().clone();
    const zDir = this.getZVector();
    const frustumZ = viewOrg.vectorTo(frustPts[Npc.LeftBottomFront]);
    const frustOrgToEye = frustumZ.scale(1.0 / (1.0 - compression));
    const eyePoint = viewOrg.plus(frustOrgToEye);

    const backDistance = frustOrgToEye.dotProduct(zDir);         // distance from eye to back plane of frustum
    const focusDistance = backDistance - (viewDelta.z / 2.0);
    const focalFraction = focusDistance / backDistance;           // ratio of focus plane distance to back plane distance

    viewOrg = eyePoint.plus2Scaled(frustOrgToEye, -focalFraction, zDir, focusDistance - backDistance);    // now project that point onto back plane
    viewDelta.x *= focalFraction;                                  // adjust view delta for x and y so they are also at focus plane
    viewDelta.y *= focalFraction;

    this.setEyePoint(eyePoint);
    this.setFocusDistance(focusDistance);
    this.setOrigin(viewOrg);
    this.setExtents(viewDelta);
    this.setLensAngle(this.calcLensAngle());
    this.enableCamera();
    return ViewportStatus.Success;
  }

  protected static calculateMaxDepth(delta: Vector3d, zVec: Vector3d): number {
    // We are going to limit maximum depth to a value that will avoid subtractive cancellation
    // errors on the inverse frustum matrix. - These values will occur when the Z'th row values
    // are very small in comparison to the X-Y values.  If the X-Y values are exactly zero then
    // no error is possible and we'll arbitrarily limit to 1.0E8.
    const depthRatioLimit = 1.0E8;          // Limit for depth Ratio.
    const maxTransformRowRatio = 1.0E5;
    const minXYComponent = Math.min(Math.abs(zVec.x), Math.abs(zVec.y));
    const maxDepthRatio = (0.0 === minXYComponent) ? depthRatioLimit : Math.min((maxTransformRowRatio / minXYComponent), depthRatioLimit);

    return Math.max(delta.x, delta.y) * maxDepthRatio;
  }

  public getOrigin(): Point3d { return this.origin; }
  public getExtents(): Vector3d { return this.extents; }
  public getRotation(): RotMatrix { return this.rotation; }
  public setOrigin(origin: Point3d) { this.origin = origin; }
  public setExtents(extents: Vector3d) { this.extents = extents; }
  public setRotation(rot: RotMatrix) { this.rotation = rot; }
  protected enableCamera(): void { this._cameraOn = true; }
  public supportsCamera(): boolean { return true; }
  public get cameraOn() { return this._cameraOn; }

  private static minimumFrontDistance() { return 300 * Constant.oneMillimeter; }
  public isEyePointAbove(elevation: number): boolean { return !this.cameraOn ? (this.getZVector().z > 0) : (this.getEyePoint().z > elevation); }
  // void VerifyFocusPlane();//!< private
  // DGNPLATFORM_EXPORT DPoint3d ComputeEyePoint(Frustum const& frust) const ;//!< private

  public constructor(props: ViewDefinition3dProps) {
    super(props);
    this._cameraOn = JsonUtils.asBool(props.cameraOn);
    this.origin = Point3d.fromJSON(props.origin);
    this.extents = Vector3d.fromJSON(props.extents);
    this.rotation = YawPitchRollAngles.fromJSON(props.angles).toRotMatrix();
    this.camera = Camera.fromJSON(props.camera);
    if (props.displayStyle)
      this.setupDisplayStyle3d(props.displayStyle);
  }

  public getDisplayStyle3d() { return this.getDisplayStyle() as DisplayStyle3d; }
  public setupDisplayStyle3d(style: DisplayStyle3d) { super.setupDisplayStyle(style); }

  /** Turn the camera off for this view. After this call, the camera parameters in this view definition are ignored and views that use it will
   *  display with an orthographic (infinite focal length) projection of the view volume from the view direction.
   *  @note To turn the camera back on, call #lookAt
   */
  public turnCameraOff() { this._cameraOn = false; }

  /** Determine whether the camera is valid for this view */
  public isCameraValid() { return this.camera.isValid(); }

  /** Calculate the lens angle formed by the current delta and focus distance */
  public calcLensAngle(): Angle {
    const maxDelta = Math.max(this.extents.x, this.extents.y);
    return Angle.createRadians(2.0 * Math.atan2(maxDelta * 0.5, this.camera.getFocusDistance()));
  }

  /** Get the target point of the view. If there is no camera, view center is returned. */
  public getTargetPoint(): Point3d {
    if (!this.cameraOn)
      return super.getTargetPoint();

    const viewZ = this.getRotation().getRow(2);
    return this.getEyePoint().plusScaled(viewZ, -1.0 * this.getFocusDistance());
  }

  /**
   * Position the camera for this view and point it at a new target point.
   * @param eyePoint The new location of the camera.
   * @param targetPoint The new location to which the camera should point. This becomes the center of the view on the focus plane.
   * @param upVector A vector that orients the camera's "up" (view y). This vector must not be parallel to the vector from eye to target.
   * @param newExtents  The new size (width and height) of the view rectangle. The view rectangle is on the focus plane centered on the targetPoint.
   * If newExtents is undefined, the existing size is unchanged.
   * @param frontDistance The distance from the eyePoint to the front plane. If undefined, the existing front distance is used.
   * @param backDistance The distance from the eyePoint to the back plane. If undefined, the existing back distance is used.
   * @returns a status indicating whether the camera was successfully positioned. See values at [[ViewportStatus]] for possible errors.
   * @e If the aspect ratio of viewDelta does not match the aspect ratio of a Viewport into which this view is displayed, it will be
   * adjusted when the Viewport is synchronized from this view.
   * @e This method modifies this ViewController. If this ViewController is attached to Viewport, you must call Viewport.synchWithViewController
   * see the new changes in the DgnViewport.
   */
  public lookAt(eyePoint: Point3d, targetPoint: Point3d, upVector: Vector3d, newExtents?: Vector2d, frontDistance?: number, backDistance?: number): ViewportStatus {
    const yVec = upVector.normalize();
    if (!yVec) // up vector zero length?
      return ViewportStatus.InvalidUpVector;

    const zVec = this.getEyePoint().vectorTo(targetPoint); // z defined by direction from eye to target
    const focusDist = zVec.normalizeWithLength(zVec).mag; // set focus at target point

    if (focusDist <= ViewDefinition3d.minimumFrontDistance()) // eye and target are too close together
      return ViewportStatus.InvalidTargetPoint;

    const xVec = new Vector3d();
    if (yVec.crossProduct(zVec).normalizeWithLength(xVec).mag < Geometry.smallMetricDistance)
      return ViewportStatus.InvalidUpVector;    // up is parallel to z

    if (zVec.crossProduct(xVec).normalizeWithLength(yVec).mag < Geometry.smallMetricDistance)
      return ViewportStatus.InvalidUpVector;

    // we now have rows of the rotation matrix
    const rotation = RotMatrix.createRows(xVec, yVec, zVec);

    backDistance = backDistance ? backDistance : this.getBackDistance();
    frontDistance = frontDistance ? frontDistance : this.getFrontDistance();

    const delta = newExtents ? new Vector3d(Math.abs(newExtents.x), Math.abs(newExtents.y), this.extents.z) : this.extents;

    frontDistance = Math.max(frontDistance!, (.5 * Constant.oneMeter));
    backDistance = Math.max(backDistance!, focusDist + (.5 * Constant.oneMeter));

    if (backDistance < focusDist) // make sure focus distance is in front of back distance.
      backDistance = focusDist + Constant.oneMillimeter;

    if (frontDistance > focusDist)
      frontDistance = focusDist - ViewDefinition3d.minimumFrontDistance();

    if (frontDistance < ViewDefinition3d.minimumFrontDistance())
      frontDistance = ViewDefinition3d.minimumFrontDistance();

    // BeAssert(backDistance > frontDistance);
    delta.z = (backDistance! - frontDistance);

    const frontDelta = delta.scale(frontDistance / focusDist);
    const stat = this.validateViewDelta(frontDelta, false); // validate window size on front (smallest) plane
    if (ViewportStatus.Success !== stat)
      return stat;

    if (delta.z > ViewDefinition3d.calculateMaxDepth(delta, zVec)) // make sure we're not zoomed out too far
      return ViewportStatus.MaxDisplayDepth;

    // The origin is defined as the lower left of the view rectangle on the focus plane, projected to the back plane.
    // Start at eye point, and move to center of back plane, then move left half of width. and down half of height
    const origin = eyePoint.plus3Scaled(zVec, -backDistance!, xVec, -0.5 * delta.x, yVec, -0.5 * delta.y);

    this.setEyePoint(eyePoint);
    this.setRotation(rotation);
    this.setFocusDistance(focusDist);
    this.setOrigin(origin);
    this.setExtents(delta);
    this.setLensAngle(this.calcLensAngle());
    this.enableCamera();
    return ViewportStatus.Success;
  }

  /**
   * Position the camera for this view and point it at a new target point, using a specified lens angle.
   * @param eyePoint The new location of the camera.
   * @param targetPoint The new location to which the camera should point. This becomes the center of the view on the focus plane.
   * @param upVector A vector that orients the camera's "up" (view y). This vector must not be parallel to the vector from eye to target.
   * @param fov The angle, in radians, that defines the field-of-view for the camera. Must be between .0001 and pi.
   * @param frontDistance The distance from the eyePoint to the front plane. If undefined, the existing front distance is used.
   * @param backDistance The distance from the eyePoint to the back plane. If undefined, the existing back distance is used.
   * @returns Status indicating whether the camera was successfully positioned. See values at [[ViewportStatus]] for possible errors.
   * @note The aspect ratio of the view remains unchanged.
   */
  public lookAtUsingLensAngle(eyePoint: Point3d, targetPoint: Point3d, upVector: Vector3d, fov: Angle, frontDistance?: number, backDistance?: number): ViewportStatus {
    const focusDist = eyePoint.distance(targetPoint);
    if (focusDist <= Constant.oneMillimeter)       // eye and target are too close together
      return ViewportStatus.InvalidTargetPoint;

    if (fov.radians < .0001 || fov.radians > Math.PI)
      return ViewportStatus.InvalidLens;

    const extent = 2.0 * Math.tan(fov.radians / 2.0) * focusDist;
    const delta = Vector2d.create(this.getExtents().x, this.getExtents().y);
    const longAxis = Math.max(delta.x, delta.y);
    delta.scale(extent / longAxis, delta);

    return this.lookAt(eyePoint, targetPoint, upVector, delta, frontDistance, backDistance);
  }

  /**
   * Move the camera relative to its current location by a distance in camera coordinates.
   * @param distance to move camera. Length is in world units, direction relative to current camera orientation.
   * @returns Status indicating whether the camera was successfully positioned. See values at [[ViewportStatus]] for possible errors.
   */
  public moveCameraLocal(distance: Vector3d): ViewportStatus {
    const distWorld = this.getRotation().multiplyTransposeVector(distance);
    return this.moveCameraWorld(distWorld);
  }

  /**
   * Move the camera relative to its current location by a distance in world coordinates.
   * @param distance in world units.
   * @returns Status indicating whether the camera was successfully positioned. See values at [[ViewportStatus]] for possible errors.
   */
  public moveCameraWorld(distance: Vector3d): ViewportStatus {
    if (!this.cameraOn) {
      this.origin.plus(distance, this.origin);
      return ViewportStatus.Success;
    }

    const newTarget = this.getTargetPoint().plus(distance);
    const newEyePt = this.getEyePoint().plus(distance);
    return this.lookAt(newEyePt, newTarget, this.getYVector());
  }

  /**
   * Rotate the camera from its current location about an axis relative to its current orientation.
   * @param angle The angle to rotate the camera.
   * @param axis The axis about which to rotate the camera. The axis is a direction relative to the current camera orientation.
   * @param aboutPt The point, in world coordinates, about which the camera is rotated. If aboutPt is undefined, the camera rotates in place
   *  (i.e. about the current eyePoint).
   * @note Even though the axis is relative to the current camera orientation, the aboutPt is in world coordinates, \b not relative to the camera.
   * @returns Status indicating whether the camera was successfully positioned. See values at [[ViewportStatus]] for possible errors.
   */
  public rotateCameraLocal(angle: Angle, axis: Vector3d, aboutPt?: Point3d): ViewportStatus {
    const axisWorld = this.getRotation().multiplyTransposeVector(axis);
    return this.rotateCameraWorld(angle, axisWorld, aboutPt);
  }

  /**
   * Rotate the camera from its current location about an axis in world coordinates.
   * @param angle The angle to rotate the camera.
   * @param axis The world-based axis (direction) about which to rotate the camera.
   * @param aboutPt The point, in world coordinates, about which the camera is rotated. If aboutPt is undefined, the camera rotates in place
   *  (i.e. about the current eyePoint).
   * @returns Status indicating whether the camera was successfully positioned. See values at [[ViewportStatus]] for possible errors.
   */
  public rotateCameraWorld(angle: Angle, axis: Vector3d, aboutPt?: Point3d): ViewportStatus {
    const about = aboutPt ? aboutPt : this.getEyePoint();
    const rotation = RotMatrix.createRotationAroundVector(axis, angle);
    const trans = Transform.createFixedPointAndMatrix(about, rotation!);
    const newTarget = trans.multiplyPoint(this.getTargetPoint());
    const upVec = rotation!.multiplyVector(this.gtYVector());
    return this.lookAt(this.getEyePoint(), newTarget, upVec);
  }

  /** Get the distance from the eyePoint to the front plane for this view. */
  public getFrontDistance(): number { return this.getBackDistance() - this.extents.z; }

  /** Get the distance from the eyePoint to the back plane for this view. */
  public getBackDistance(): number {
    // backDist is the z component of the vector from the origin to the eyePoint .
    const eyeOrg = this.origin.vectorTo(this.getEyePoint());
    this.getRotation().multiplyVector(eyeOrg, eyeOrg);
    return eyeOrg.z;
  }

  /**
   * Place the eyepoint of the camera so it is aligned with the center of the view. This removes any 1-point perspective skewing that may be
   * present in the current view.
   * @param backDistance If defined, the new the distance from the eyepoint to the back plane. Otherwise the distance from the
   * current eyepoint is used.
   */
  public centerEyePoint(backDistance?: number): void {
    const eyePoint = this.getExtents().scale(0.5);
    eyePoint.z = backDistance ? backDistance : this.getBackDistance();
    const eye = this.getRotation().multiplyTransposeXYZ(eyePoint.x, eyePoint.y, eyePoint.z);
    this.camera.setEyePoint(this.getOrigin().plus(eye));
  }

  /** Center the focus distance of the camera halfway between the front plane and the back plane, keeping the eyepoint,
   * lens angle, rotation, back distance, and front distance unchanged.
   * @note The focus distance, origin, and delta values are modified, but the view encloses the same volume and appears visually unchanged.
   */
  public centerFocusDistance(): void {
    const backDist = this.getBackDistance();
    const frontDist = this.getFrontDistance();
    const eye = this.getEyePoint();
    const target = eye.plusScaled(this.getZVector(), frontDist - backDist);
    this.lookAtUsingLensAngle(eye, target, this.getYVector(), this.getLensAngle(), frontDist, backDist);
  }

  /** Get the current location of the eyePoint for camera in this view. */
  public getEyePoint(): Point3d { return this.camera.eye; }

  /** Get the lens angle for this view. */
  public getLensAngle(): Angle { return this.camera.lens; }

  /** Set the lens angle for this view.
   *  @param angle The new lens angle in radians. Must be greater than 0 and less than pi.
   *  @note This does not change the view's current field-of-view. Instead, it changes the lens that will be used if the view
   *  is subsequently modified and the lens angle is used to position the eyepoint.
   *  @note To change the field-of-view (i.e. "zoom") of a view, pass a new viewDelta to #lookAt
   */
  public setLensAngle(angle: Angle): void { this.camera.lens = angle; }

  /** Change the location of the eyePoint for the camera in this view.
   * @param pt The new eyepoint.
   * @note This method is generally for internal use only. Moving the eyePoint arbitrarily can result in skewed or illegal perspectives.
   * The most common method for user-level camera positioning is #lookAt.
   */
  public setEyePoint(pt: Point3d): void { this.camera.eye = pt; }

  /** Set the focus distance for this view.
   *  @note Changing the focus distance changes the plane on which the delta.x and delta.y values lie. So, changing focus distance
   *  without making corresponding changes to delta.x and delta.y essentially changes the lens angle, causing a "zoom" effect
   */
  public setFocusDistance(dist: number): void { this.camera.setFocusDistance(dist); }

  /**  Get the distance from the eyePoint to the focus plane for this view. */
  public getFocusDistance(): number { return this.camera.focusDistance; }
}

/** Parameters to construct a SpatialDefinition */
export interface SpatialViewDefinitionProps extends ViewDefinition3dProps {
  modelSelector?: ModelSelector;
}

/** Defines a view of one or more SpatialModels.
 * The list of viewed models is stored by the ModelSelector.
 */
export class SpatialViewDefinition extends ViewDefinition3d implements SpatialViewDefinitionProps {
  public modelSelectorId: Id64;
  protected _modelSelector: ModelSelector;
  constructor(props: SpatialViewDefinitionProps) { super(props); if (props.modelSelector) this.setModelSelector(props.modelSelector); }

  //   //! Get a writable reference to the ModelSelector for this SpatialViewDefinition
  //   DGNPLATFORM_EXPORT ModelSelectorR GetModelSelector();

  public viewsModel(modelId: Id64) { return this._modelSelector.containsModel(modelId); }

  /** Set the ModelSelector for this SpatialViewDefinition
   * @param models The new ModelSelector.
   */
  public setModelSelector(models: ModelSelector) { this._modelSelector = models; this.modelSelectorId = models.id; }
}

/** Defines a spatial view that displays geometry on the image plane using a parallel orthographic projection. */
export class OrthographicViewDefinition extends SpatialViewDefinition {
  constructor(props: SpatialViewDefinitionProps) { super(props); }

  // tslint:disable-next-line:no-empty
  public enableCamera(): void { }
  public supportsCamera(): boolean { return false; }
}
