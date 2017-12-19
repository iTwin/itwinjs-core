/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64, Guid } from "@bentley/bentleyjs-core/lib/Id";
import { JsonUtils } from "@bentley/bentleyjs-core/lib/JsonUtils";
import { Vector3d, Vector2d, Point3d, Point2d, Range3d, RotMatrix, Transform, YawPitchRollAngles, LowAndHighXYZ, LowAndHighXY, Range2d } from "@bentley/geometry-core/lib/PointVector";
import { AxisOrder, Angle, Geometry } from "@bentley/geometry-core/lib/Geometry";
import { Map4d } from "@bentley/geometry-core/lib/numerics/Geometry4d";
import { Constant } from "@bentley/geometry-core/lib/Constant";
import { ClipVector } from "@bentley/geometry-core/lib/numerics/ClipVector";
import { ElementProps, RelatedElement } from "./ElementProps";
import { EntityProps } from "./EntityProps";
import { ModelProps, GeometricModel2dProps } from "./ModelProps";
import { Light, LightType } from "./Lighting";
import { ViewFlags, HiddenLine, ColorDef, ColorRgb } from "./Render";
import { Code } from "./Code";
import { IModel } from "./IModel";
import { AxisAlignedBox3d } from "./geometry/Primitives";

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

// tslint:disable-next-line:variable-name
export const NpcCorners = [
  new Point3d(0.0, 0.0, 0.0),
  new Point3d(1.0, 0.0, 0.0),
  new Point3d(0.0, 1.0, 0.0),
  new Point3d(1.0, 1.0, 0.0),
  new Point3d(0.0, 0.0, 1.0),
  new Point3d(1.0, 0.0, 1.0),
  new Point3d(0.0, 1.0, 1.0),
  new Point3d(1.0, 1.0, 1.0),
];
Object.freeze(NpcCorners);

// tslint:disable-next-line:variable-name
export const NpcCenter = new Point3d(.5, .5, .5);
Object.freeze(NpcCenter);

export const enum GridOrientationType {
  View = 0,
  WorldXY = 1, // Top
  WorldYZ = 2, // Right
  WorldXZ = 3, // Front
  AuxCoord = 4,
  GeoCoord = 5,
}

export const enum StandardViewId {
  NotStandard = -1,
  Top = 1,
  Bottom = 2,
  Left = 3,
  Right = 4,
  Front = 5,
  Back = 6,
  Iso = 7,
  RightIso = 8,
}

export const standardView = {
  Top: RotMatrix.identity,
  Bottom: RotMatrix.createRowValues(1, 0, 0, 0, -1, 0, 0, 0, -1),
  Left: RotMatrix.createRowValues(0, -1, 0, 0, 0, 1, -1, 0, 0),
  Right: RotMatrix.createRowValues(0, 1, 0, 0, 0, 1, 1, 0, 0),
  Front: RotMatrix.createRowValues(1, 0, 0, 0, 0, 1, 0, -1, 0),
  Back: RotMatrix.createRowValues(-1, 0, 0, 0, 0, 1, 0, 1, 0),
  Iso: RotMatrix.createRowValues(
    0.707106781186548, -0.70710678118654757, 0.00000000000000000,
    0.408248290463863, 0.40824829046386302, 0.81649658092772603,
    -0.577350269189626, -0.57735026918962573, 0.57735026918962573),
  RightIso: RotMatrix.createRowValues(
    0.707106781186548, 0.70710678118654757, 0.00000000000000000,
    -0.408248290463863, 0.40824829046386302, 0.81649658092772603,
    0.577350269189626, -0.57735026918962573, 0.57735026918962573),
};
Object.freeze(standardView);

export const standardViewMatrices = [
  standardView.Top, standardView.Bottom, standardView.Left, standardView.Right,
  standardView.Front, standardView.Back, standardView.Iso, standardView.RightIso,
];
Object.freeze(standardViewMatrices);

/** adjust to any nearby standard view */
function findNearbyStandardViewMatrix(rMatrix: RotMatrix): void {
  for (const test of standardViewMatrices) {
    if (test.maxDiff(rMatrix) < 1.0e-7) {
      rMatrix.setFrom(test);
      return;
    }
  }
}

/**
 * The region of physical (3d) space that appears in a view. It forms the field-of-view of a camera.
 * It is stored as 8 points, in NpcCorner order, that must define a truncated pyramid.
 */
export class Frustum {
  public readonly points: Point3d[] = [];
  /** constructor for Frustum. Members are initialized to the Npc cube. */
  public constructor() { for (let i = 0; i < 8; ++i) this.points[i] = NpcCorners[i].clone(); }
  public initNpc() { for (let i = 0; i < 8; ++i) Point3d.createFrom(NpcCorners[i], this.points[i]); return this; }
  public getCorner(i: number) { return this.points[i]; }
  public getCenter(): Point3d { return this.getCorner(Npc.RightTopFront).interpolate(0.5, this.getCorner(Npc.LeftBottomRear)); }
  public distance(corner1: number, corner2: number): number { return this.getCorner(corner1).distance(this.getCorner(corner2)); }
  public getFraction(): number { return Geometry.safeDivideFraction(this.distance(Npc.LeftTopFront, Npc.RightBottomFront), this.distance(Npc.LeftTopRear, Npc.RightBottomRear), 0); }
  public multiply(trans: Transform): void { trans.multiplyPoint3dArrayInPlace(this.points); }
  public translate(offset: Vector3d): void { for (const pt of this.points) pt.plus(offset); }
  public transformBy(trans: Transform, result?: Frustum): Frustum { result = result ? result : new Frustum(); trans.multiplyPoint3dArray(this.points, result.points); return result; }
  public toRange(range?: Range3d): Range3d { range = range ? range : new Range3d(); Range3d.createArray(this.points, range); return range; }
  public clone(result?: Frustum): Frustum { result = result ? result : new Frustum(); for (let i = 0; i < 8; ++i) Point3d.createFrom(this.points[i], result.points[i]); return result; }
  public setFrom(other: Frustum) { other.clone(this); }
  public scaleAboutCenter(scale: number): void {
    const orig = this.clone();
    const f = 0.5 * (1.0 + scale);
    orig.points[Npc._111].interpolate(f, orig.points[Npc._000], this.points[Npc._000]);
    orig.points[Npc._011].interpolate(f, orig.points[Npc._100], this.points[Npc._100]);
    orig.points[Npc._101].interpolate(f, orig.points[Npc._010], this.points[Npc._010]);
    orig.points[Npc._001].interpolate(f, orig.points[Npc._110], this.points[Npc._110]);
    orig.points[Npc._110].interpolate(f, orig.points[Npc._001], this.points[Npc._001]);
    orig.points[Npc._010].interpolate(f, orig.points[Npc._101], this.points[Npc._101]);
    orig.points[Npc._100].interpolate(f, orig.points[Npc._011], this.points[Npc._011]);
    orig.points[Npc._000].interpolate(f, orig.points[Npc._111], this.points[Npc._111]);
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
  public initFromRange(range: LowAndHighXYZ | LowAndHighXY): void {
    const getZ = (arg: any): number => arg.z !== undefined ? arg.z : 0;
    const pts = this.points;
    pts[0].x = pts[3].x = pts[4].x = pts[7].x = range.low.x;
    pts[1].x = pts[2].x = pts[5].x = pts[6].x = range.high.x;
    pts[0].y = pts[1].y = pts[4].y = pts[5].y = range.low.y;
    pts[2].y = pts[3].y = pts[6].y = pts[7].y = range.high.y;
    pts[0].z = pts[1].z = pts[2].z = pts[3].z = getZ(range.low);
    pts[4].z = pts[5].z = pts[6].z = pts[7].z = getZ(range.high);
  }

  /** Create a new Frustum from a Range3d */
  public static fromRange(range: LowAndHighXYZ | LowAndHighXY): Frustum {
    const frustum = new Frustum();
    frustum.initFromRange(range);
    return frustum;
  }

  /** make sure the frustum point order does not include mirroring. If so, reverse the order. */
  public fixPointOrder() {
    const pts = this.points;
    const u = pts[Npc._000].vectorTo(pts[Npc._001]);
    const v = pts[Npc._000].vectorTo(pts[Npc._010]);
    const w = pts[Npc._000].vectorTo(pts[Npc._100]);

    if (u.tripleProduct(v, w) <= 0)
      return;

    // frustum has mirroring, reverse points
    for (let i = 0; i < 8; i += 2) {
      const tmpPoint = pts[i];
      pts[i] = pts[i + 1];
      pts[i + 1] = tmpPoint;
    }
  }
}

/** the constructor for an EntityState (for cloning). */
export interface EntityStateCtor extends FunctionConstructor {
  new(args: EntityProps, iModel: IModel, state?: EntityState): EntityState;
}

export class EntityState implements EntityProps {
  public readonly id: Id64;
  public readonly iModel: IModel;
  public readonly classFullName: string;
  public readonly jsonProperties: any;

  constructor(props: EntityProps, iModel: IModel) {
    this.classFullName = props.classFullName;
    this.iModel = iModel;
    this.id = Id64.fromJSON(props.id);
    this.jsonProperties = !props.jsonProperties ? {} : JSON.parse(JSON.stringify(props.jsonProperties)); // make sure we have our own copy
  }

  public toJSON(): EntityProps {
    const val: any = {};
    val.classFullName = this.classFullName;
    if (this.id.isValid())
      val.id = this.id;
    if (Object.keys(this.jsonProperties).length > 0)
      val.jsonProperties = this.jsonProperties;
    return val;
  }

  public equals<T extends EntityState>(other: T): boolean { return JSON.stringify(this.toJSON()) === JSON.stringify(other.toJSON()); }

  /** Make an independent copy of this EntityState */
  public clone<T extends EntityState>() { return new (this.constructor as EntityStateCtor)(this.toJSON(), this.iModel, this) as T; }
}

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
}

/** the state of a 2d Model */
export class Model2dState extends ModelState implements GeometricModel2dProps {
  public readonly extents: Range2d;
  constructor(props: GeometricModel2dProps, iModel: IModel) {
    super(props, iModel);
  }
  public toJSON(): GeometricModel2dProps {
    const val = super.toJSON() as GeometricModel2dProps;
    return val;
  }
}

export class ElementState extends EntityState implements ElementProps {
  public readonly model: Id64;
  public readonly code: Code;
  public readonly parent?: RelatedElement;
  public readonly federationGuid?: Guid;
  public readonly userLabel?: string;

  constructor(props: ElementProps, iModel: IModel) {
    super(props, iModel);
    this.code = Code.fromJSON(props.code);
    this.model = Id64.fromJSON(props.model);
    this.parent = RelatedElement.fromJSON(props.parent);
    this.federationGuid = Guid.fromJSON(props.federationGuid);
    this.userLabel = props.userLabel;
  }

  public toJSON(): ElementProps {
    const val = super.toJSON() as ElementProps;
    if (this.code.spec.isValid())
      val.code = this.code;
    val.model = this.model;
    if (this.parent)
      val.parent = this.parent;
    if (this.federationGuid)
      val.federationGuid = this.federationGuid;
    if (this.userLabel)
      val.userLabel = this.userLabel;
    return val;
  }
}

/** A DisplayStyle defines the parameters for 'styling' the contents of a View */
export abstract class DisplayStyleState extends ElementState {
  private _viewFlags: ViewFlags;
  private _background: ColorDef;

  constructor(props: ElementProps, iModel: IModel) {
    super(props, iModel);
    this.viewFlags = ViewFlags.fromJSON(this.getStyle("viewflags"));
    this._background = ColorDef.fromJSON(this.getStyle("backgroundColor"));
  }

  public get viewFlags(): ViewFlags { return this._viewFlags; }
  public set viewFlags(flags: ViewFlags) { this._viewFlags = flags; this.setStyle("viewflags", flags); }

  public getStyles(): any { const p = this.jsonProperties as any; if (!p.styles) p.styles = new Object(); return p.styles; }
  public getStyle(name: string): any {
    const style: object = this.getStyles()[name];
    return style ? style : {};
  }
  /** change the value of a style on this DisplayStyle */
  public setStyle(name: string, value: any): void { this.getStyles()[name] = value; }

  /** Remove a Style from this DisplayStyle. */
  public removeStyle(name: string) { delete this.getStyles()[name]; }

  /** Get the background color for this DisplayStyle */
  public get backgroundColor(): ColorDef { return this._background; }
  public set backgroundColor(val: ColorDef) { this._background = val; this.setStyle("backgroundColor", val); }

  public getMonochromeColor(): ColorDef { return ColorDef.fromJSON(this.getStyle("monochromeColor")); }
  public setMonochromeColor(val: ColorDef): void { this.setStyle("monochromeColor", val); }
}

/** A DisplayStyle for 2d views */
export class DisplayStyle2dState extends DisplayStyleState {
  constructor(props: ElementProps, iModel: IModel) { super(props, iModel); }
}

/** A circle drawn at a Z elevation, whose diameter is the the XY diagonal of the project extents */
export class GroundPlane {
  public display: boolean = false;
  public elevation: number = 0.0;  // the Z height to draw the ground plane
  public aboveColor: ColorDef;     // the color to draw the ground plane if the view shows the ground from above
  public belowColor: ColorDef;     // the color to draw the ground plane if the view shows the ground from below

  public constructor(ground: any) {
    ground = ground ? ground : {};
    this.display = JsonUtils.asBool(ground.display, false);
    this.elevation = JsonUtils.asDouble(ground.elevation, -.01);
    this.aboveColor = ground.aboveColor ? ColorDef.fromJSON(ground.aboveColor) : new ColorDef(ColorRgb.darkGreen);
    this.belowColor = ground.belowColor ? ColorDef.fromJSON(ground.belowColor) : new ColorDef(ColorRgb.darkBrown);
  }
}

/** the SkyBox is a draws in the background of spatial views to provide context. */
export class SkyBox {
  public display: boolean = false;
  public twoColor: boolean = false;
  public jpegFile: string;              // the name of a jpeg file with a spherical skybox
  public zenithColor: ColorDef;         // if no jpeg file, the color of the zenith part of the sky gradient (shown when looking straight up.)
  public nadirColor: ColorDef;          // if no jpeg file, the color of the nadir part of the ground gradient (shown when looking straight down.)
  public groundColor: ColorDef;         // if no jpeg file, the color of the ground part of the ground gradient
  public skyColor: ColorDef;            // if no jpeg file, the color of the sky part of the sky gradient
  public groundExponent: number = 4.0;  // if no jpeg file, the cutoff between ground and nadir
  public skyExponent: number = 4.0;     // if no jpeg file, the cutoff between sky and zenith

  public constructor(sky: any) {
    sky = sky ? sky : {};
    this.display = JsonUtils.asBool(sky.display, false);
    this.twoColor = JsonUtils.asBool(sky.twoColor, false);
    this.jpegFile = JsonUtils.asString(sky.file);
    this.groundExponent = JsonUtils.asDouble(sky.groundExponent, 4.0);
    this.skyExponent = JsonUtils.asDouble(sky.skyExponent, 4.0);
    this.groundColor = sky.groundColor ? ColorDef.fromJSON(sky.groundColor) : ColorDef.from(120, 143, 125);
    this.zenithColor = sky.zenithColor ? ColorDef.fromJSON(sky.zenithColor) : ColorDef.from(54, 117, 255);
    this.nadirColor = sky.nadirColor ? ColorDef.fromJSON(sky.nadirColor) : ColorDef.from(40, 15, 0);
    this.skyColor = sky.skyColor ? ColorDef.fromJSON(sky.skyColor) : ColorDef.from(143, 205, 255);
  }

  public toJSON(): any {
    const val: any = {};
    if (this.display)
      val.display = true;
    if (this.twoColor)
      val.twoColor = true;
    if (this.jpegFile !== "")
      val.jpegFile = this.jpegFile;
    if (this.groundExponent !== 4.0)
      val.groundExponent = this.groundExponent;
    if (this.skyExponent !== 4.0)
      val.skyExponent = this.groundExponent;

    val.groundColor = this.groundColor;
    val.zenithColor = this.zenithColor;
    val.nadirColor = this.nadirColor;
    val.skyColor = this.skyColor;
    return val;
  }
}

/** the skyBox, groundPlane, etc. for a 3d view  */
export class Environment {
  public readonly sky: SkyBox;
  public readonly ground: GroundPlane;
  public constructor(json: any) {
    this.sky = new SkyBox(json.sky);
    this.ground = new GroundPlane(json.ground);
  }
}

/** A DisplayStyle for 3d views */
export class DisplayStyle3dState extends DisplayStyleState {
  public constructor(props: ElementProps, iModel: IModel) { super(props, iModel); }
  public getHiddenLineParams(): HiddenLine.Params { return new HiddenLine.Params(this.getStyle("hline")); }
  public setHiddenLineParams(params: HiddenLine.Params) { this.setStyle("hline", params); }

  /** change one of the scene light specifications (Ambient, Flash, or Portrait) for this display style */
  public setSceneLight(light: Light) {
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
    this.setStyle("sceneLights", sceneLights);
  }

  /** change the light specification and direction of the solar light for this display style */
  public setSolarLight(light: Light, direction: Vector3d) {
    const sceneLights = this.getStyle("sceneLights");
    if (light.lightType !== LightType.Solar || !light.isValid()) {
      delete sceneLights.sunDir;
    } else {
      sceneLights.sun = light;
      sceneLights.sunDir = direction;
    }
    this.setStyle("sceneLights", sceneLights);
  }

  public getEnvironment() { return new Environment(this.getStyle("environment")); }
  public setEnvironment(env: Environment) { this.setStyle("environment", env); }

  public setSceneBrightness(fstop: number): void { fstop = Math.max(-3.0, Math.min(fstop, 3.0)); this.getStyle("sceneLights").fstop = fstop; }
  public getSceneBrightness(): number { return JsonUtils.asDouble(this.getStyle("sceneLights").fstop, 0.0); }
}

/** properties that define a ModelSelector */
export interface ModelSelectorProps extends ElementProps {
  models: string[];
}

/** A list of GeometricModels for a SpatialViewDefinition. */
export class ModelSelectorState extends ElementState {
  public readonly models: Set<string> = new Set<string>();
  constructor(props: ModelSelectorProps, iModel: IModel) {
    super(props, iModel);
    if (props.models)
      props.models.forEach((model) => this.models.add(model));
  }

  /** Get the name of this ModelSelector */
  public getName(): string { return this.code.getValue(); }

  public toJSON(): ModelSelectorProps {
    const val: any = super.toJSON();
    val.models = [];
    this.models.forEach((model) => val.models.push(model));
    return val;
  }

  public addModel(id: Id64) { this.models.add(id.value); }
  public dropModel(id: Id64): boolean { return this.models.delete(id.value); }
  public containsModel(modelId: Id64): boolean { return this.models.has(modelId.value); }
}

/** properties that define a CategorySelector */
export interface CategorySelectorProps extends ElementProps {
  categories: string[];
}

/** A list of Categories to be displayed in a view. */
export class CategorySelectorState extends ElementState {
  public categories: Set<string> = new Set<string>();
  constructor(props: CategorySelectorProps, iModel: IModel) {
    super(props, iModel);
    if (props.categories)
      props.categories.forEach((cat) => this.categories.add(cat));
  }

  public toJSON(): CategorySelectorProps {
    const val = super.toJSON() as CategorySelectorProps;
    val.categories = [];
    this.categories.forEach((cat) => val.categories.push(cat));
    return val;
  }

  /** Get the name of this CategorySelector */
  public getName(): string { return this.code.getValue(); }

  /** Determine whether this CategorySelector includes the specified category */
  public isCategoryViewed(categoryId: Id64): boolean { return this.categories.has(categoryId.value); }

  /**  Add a category to this CategorySelector */
  public addCategory(id: Id64): void { this.categories.add(id.value); }

  /** Drop a category from this CategorySelector */
  public dropCategory(id: Id64): boolean { return this.categories.delete(id.value); }

  /** Add or Drop a category to this CategorySelector */
  public changeCategoryDisplay(categoryId: Id64, add: boolean): void { if (add) this.addCategory(categoryId); else this.dropCategory(categoryId); }
}

/** Parameters used to construct a ViewDefinition */
export interface ViewDefinitionProps extends ElementProps {
  categorySelectorId: Id64 | string;
  displayStyleId: Id64 | string;
}

export const enum ViewStatus {
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

/**
 * Margins for white space to be left around view volumes for ViewDefinition.lookAtVolume.
 * Values mean "percent of view" and must be between 0 and .25.
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
 * The state of a ViewDefinition element. ViewDefinitions specify the area/volume that is viewed, and points to a DisplayStyle and a CategorySelector.
 * Subclasses of ViewDefinition determine which model(s) are viewed.
 */
export abstract class ViewState extends ElementState {
  protected constructor(props: ViewDefinitionProps, iModel: IModel, public categorySelector: CategorySelectorState, public displayStyle: DisplayStyleState) {
    super(props, iModel);
    if (categorySelector instanceof ViewState) { // from clone, 3rd argument is source ViewState
      this.categorySelector = categorySelector.categorySelector;
      this.displayStyle = categorySelector.displayStyle;
    }
  }

  public toJSON(): ViewDefinitionProps {
    const json = super.toJSON() as ViewDefinitionProps;
    json.categorySelectorId = this.categorySelector.id;
    json.displayStyleId = this.displayStyle.id;
    return json;
  }

  public is3d(): this is ViewState3d { return this instanceof ViewState3d; }
  public isSpatialView(): this is SpatialViewState { return this instanceof SpatialViewState; }
  public abstract allow3dManipulations(): boolean;

  public abstract getViewedExtents(): AxisAlignedBox3d;

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
  public getTargetPoint(result?: Point3d): Point3d { return this.getCenter(result); }

  /**  Get the point at the geometric center of the view. */
  public getCenter(result?: Point3d): Point3d {
    const delta = this.getRotation().transpose().multiplyVector(this.getExtents());
    return this.getOrigin().plusScaled(delta, 0.5, result);
  }

  /**
   * Initialize the origin, extents, and rotation of this ViewDefinition from an existing Frustum
   * @param frustum the input Frustum.
   */
  public setupFromFrustum(frustum: Frustum): ViewStatus {
    frustum.fixPointOrder();
    const frustPts = frustum.points;
    const viewOrg = frustPts[Npc.LeftBottomRear];

    // frustumX, frustumY, frustumZ are vectors along edges of the frustum. They are NOT unit vectors.
    // X and Y should be perpendicular, and Z should be right handed.
    const frustumX = Vector3d.createFrom(frustPts[Npc.RightBottomRear].minus(viewOrg));
    const frustumY = Vector3d.createFrom(frustPts[Npc.LeftTopRear].minus(viewOrg));
    const frustumZ = Vector3d.createFrom(frustPts[Npc.LeftBottomFront].minus(viewOrg));

    const frustMatrix = RotMatrix.createPerpendicularUnitColumns(frustumX, frustumY, AxisOrder.XYZ);
    if (!frustMatrix)
      return ViewStatus.InvalidWindow;

    findNearbyStandardViewMatrix(frustMatrix);

    const xDir = frustMatrix.getColumn(0);
    const yDir = frustMatrix.getColumn(1);
    const zDir = frustMatrix.getColumn(2);

    // set up view Rotation matrix as rows of frustum matrix.
    const viewRot = frustMatrix.inverse();
    if (!viewRot)
      return ViewStatus.InvalidWindow;

    // Left handed frustum?
    const zSize = zDir.dotProduct(frustumZ);
    if (zSize < 0.0)
      return ViewStatus.InvalidWindow;

    const viewDiagRoot = new Vector3d();
    viewDiagRoot.plus2Scaled(xDir, xDir.dotProduct(frustumX), yDir, yDir.dotProduct(frustumY), viewDiagRoot);  // vectors on the back plane
    viewDiagRoot.plusScaled(zDir, zSize, viewDiagRoot);       // add in z vector perpendicular to x,y

    // use center of frustum and view diagonal for origin. Original frustum may not have been orthogonal
    frustum.getCenter().plusScaled(viewDiagRoot, -0.5, viewOrg);

    // delta is in view coordinates
    const viewDelta = viewRot.multiplyVector(viewDiagRoot);
    const validSize = this.validateViewDelta(viewDelta, false);
    if (validSize !== ViewStatus.Success)
      return validSize;

    this.setOrigin(viewOrg);
    this.setExtents(viewDelta);
    this.setRotation(viewRot);
    return ViewStatus.Success;
  }

  public getExtentLimits() { return { minExtent: Constant.oneMillimeter, maxExtent: 2.0 * Constant.diameterOfEarth }; }
  public setDisplayStyle(style: DisplayStyleState) { this.displayStyle = style; }
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

    origin = trans.inverse()!.multiplyPoint(newOrigin);
    this.setOrigin(origin);
    this.setExtents(extents);
  }

  public validateViewDelta(delta: Vector3d, messageNeeded?: boolean): ViewStatus {
    const limit = this.getExtentLimits();
    let error = ViewStatus.Success;

    const limitWindowSize = (v: number) => {
      if (v < limit.minExtent) {
        v = limit.minExtent;
        error = ViewStatus.MinWindow;
      } else if (v > limit.maxExtent) {
        v = limit.maxExtent;
        error = ViewStatus.MaxWindow;
      }
      return v;
    };

    delta.x = limitWindowSize(delta.x);
    delta.y = limitWindowSize(delta.y);
    delta.z = limitWindowSize(delta.z);

    if (messageNeeded && error !== ViewStatus.Success) {
      //      Viewport::OutputFrustumErrorMessage(error);
    }

    return error;
  }

  /** Get the name of this ViewDefinition */
  public get name(): string { return this.code.getValue(); }

  /** Get the current value of a view detail */
  public getDetail(name: string): any { const v = this.getDetails()[name]; return v ? v : {}; }

  /** Change the value of a view detail */
  public setDetail(name: string, value: any) { this.getDetails()[name] = value; }

  /** Remove a view detail */
  public removeDetail(name: string) { delete this.getDetails()[name]; }

  /** Set the CategorySelector for this view. */
  public setCategorySelector(categories: CategorySelectorState) { this.categorySelector = categories; }

  /** Get the AuxiliaryCoordinateSystem for this ViewDefinition */
  public getAuxiliaryCoordinateSystemId(): Id64 { return Id64.fromJSON(this.getDetail("acs")); }

  /** Set the AuxiliaryCoordinateSystem for this view. */
  public setAuxiliaryCoordinateSystemId(acsId: Id64) {
    if (acsId.isValid())
      this.setDetail("acs", acsId.value);
    else
      this.removeDetail("acs");
  }

  /** Query if the specified Category is displayed in this view */
  public viewsCategory(id: Id64): boolean { return this.categorySelector.isCategoryViewed(id); }

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
  public getXVector(result?: Vector3d): Vector3d { return this.getRotation().getRow(0, result); }

  /** Get the unit vector that points in the view Y (bottom-to-top) direction. */
  public getYVector(result?: Vector3d): Vector3d { return this.getRotation().getRow(1, result); }

  /** Get the unit vector that points in the view Z (front-to-back) direction. */
  public getZVector(result?: Vector3d): Vector3d { return this.getRotation().getRow(2, result); }

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
        if (!this.is3d())
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
   * @param aspect The X/Y aspect ratio of the view into which the result will be displayed. If the aspect ratio of the volume does not
   * match aspect, the shorter axis is lengthened and the volume is centered. If aspect is undefined, no adjustment is made.
   * @param margin The amount of "white space" to leave around the view volume (which essentially increases the volume
   * of space shown in the view.) If undefined, no additional white space is added.
   * @note, for 2d views, only the X and Y values of volume are used.
   */
  public lookAtVolume(volume: Range3d, aspect?: number, margin?: MarginPercent) {
    const rangeBox = volume.corners();
    this.getRotation().multiplyVectorArrayInPlace(rangeBox);
    return this.lookAtViewAlignedVolume(Range3d.createArray(rangeBox), aspect, margin);
  }

  /**
   * look at a volume of space defined by a range in view local coordinates, keeping its current rotation.
   * @param volume The new volume, in view-coordinates, for the view. The resulting view will show all of volume.
   * @param aspect The X/Y aspect ratio of the view into which the result will be displayed. If the aspect ratio of the volume does not
   * match aspect, the shorter axis is lengthened and the volume is centered. If aspect is undefined, no adjustment is made.
   * @param margin The amount of "white space" to leave around the view volume (which essentially increases the volume
   * of space shown in the view.) If undefined, no additional white space is added.
   * @see lookAtVolume
   */
  public lookAtViewAlignedVolume(volume: Range3d, aspect?: number, margin?: MarginPercent) {
    if (volume.isNull()) // make sure volume is valid
      return;

    const viewRot = this.getRotation();
    const newOrigin = volume.low.clone();
    let newDelta = Vector3d.createStartEnd(volume.high, volume.low);

    const minimumDepth = Constant.oneMillimeter;
    if (newDelta.z < minimumDepth) {
      newOrigin.z -= (minimumDepth - newDelta.z) / 2.0;
      newDelta.z = minimumDepth;
    }

    let origNewDelta = newDelta.clone();

    const isCameraOn: boolean = this.is3d() && this.isCameraOn();
    if (isCameraOn) {
      // If the camera is on, the only way to guarantee we can see the entire volume is to set delta at the front plane, not focus plane.
      // That generally causes the view to be too large (objects in it are too small), since we can't tell whether the objects are at
      // the front or back of the view. For this reason, don't attempt to add any "margin" to camera views.
    } else if (margin) {
      // compute how much space we'll need for both of X and Y margins in root coordinates
      const wPercent = margin.left + margin.right;
      const hPercent = margin.top + margin.bottom;

      const marginHorizontal = wPercent / (1 - wPercent) * newDelta.x;
      const marginVert = hPercent / (1 - hPercent) * newDelta.y;

      // compute left and bottom margins in root coordinates
      const marginLeft = margin.left / (1 - wPercent) * newDelta.x;
      const marginBottom = margin.bottom / (1 - hPercent) * newDelta.y;

      // add the margins to the range
      newOrigin.x -= marginLeft;
      newOrigin.y -= marginBottom;
      newDelta.x += marginHorizontal;
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

    viewRot.multiplyTranspose3dInPlace(newOrigin);
    this.setOrigin(newOrigin);

    if (!this.is3d())
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

/*
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

/**
 * The current position (eyepoint), lens angle, and focus distance of a camera.
 */
export class Camera {
  public readonly lens: Angle;
  public focusDistance: number;
  public readonly eye: Point3d;

  public static isValidLensAngle(val: Angle) { return val.radians > (Math.PI / 8.0) && val.radians < Math.PI; }
  public invalidateFocus() { this.focusDistance = 0.0; }
  public isFocusValid() { return this.focusDistance > 0.0 && this.focusDistance < 1.0e14; }
  public getFocusDistance() { return this.focusDistance; }
  public setFocusDistance(dist: number) { this.focusDistance = dist; }
  public isLensValid() { return Camera.isValidLensAngle(this.lens); }
  public validateLens() { if (!this.isLensValid()) this.lens.setFrom(Angle.createRadians(Math.PI / 2.0)); }
  public getLensAngle() { return this.lens; }
  public setLensAngle(angle: Angle) { this.lens.setFrom(angle); }
  public getEyePoint() { return this.eye; }
  public setEyePoint(pt: Point3d) { this.eye.setFrom(pt); }
  public isValid() { return this.isLensValid() && this.isFocusValid(); }
  public equals(other: Camera) { return this.lens === other.lens && this.focusDistance === other.focusDistance && this.eye.isExactEqual(other.eye); }
  public clone() { return new Camera(this); }
  public copyFrom(rhs: Camera) {
    this.lens.setFrom(rhs.lens);
    this.focusDistance = rhs.focusDistance;
    this.eye.setFrom(rhs.eye);
  }
  public constructor(json: any) {
    this.lens = Angle.fromJSON(json.lens);
    this.focusDistance = JsonUtils.asDouble(json.focusDistance);
    this.eye = Point3d.fromJSON(json.eye);
  }
}

/** Parameters to construct a ViewDefinition3d */
export interface ViewDefinition3dProps extends ViewDefinitionProps {
  cameraOn: any;  // if true, m_camera is valid.
  origin: any;    // The lower left back corner of the view frustum.
  extents: any;   // The extent of the view frustum.
  angles: any;    // Rotation of the view frustum.
  camera: any;    // The camera used for this view.
}

/** Defines the state of a view of 3d models. */
export abstract class ViewState3d extends ViewState {
  protected cameraOn: boolean;  // if true, m_camera is valid.
  public readonly origin: Point3d;        // The lower left back corner of the view frustum.
  public readonly extents: Vector3d;      // The extent of the view frustum.
  public readonly rotation: RotMatrix;    // Rotation of the view frustum.
  public readonly camera: Camera;         // The camera used for this view.

  public allow3dManipulations(): boolean { return true; }
  public forceMinFrontDist() { return 0.0; } // minimum distance for front plane
  public constructor(props: ViewDefinition3dProps, iModel: IModel, categories: CategorySelectorState, displayStyle: DisplayStyle3dState) {
    super(props, iModel, categories, displayStyle);
    this.cameraOn = JsonUtils.asBool(props.cameraOn);
    this.origin = Point3d.fromJSON(props.origin);
    this.extents = Vector3d.fromJSON(props.extents);
    this.rotation = YawPitchRollAngles.fromJSON(props.angles).toRotMatrix();
    this.camera = new Camera(props.camera);
  }

  public toJSON(): ViewDefinition3dProps {
    const val = super.toJSON() as ViewDefinition3dProps;
    val.cameraOn = this.cameraOn;
    val.origin = this.origin;
    val.extents = this.extents;
    val.angles = YawPitchRollAngles.createFromRotMatrix(this.rotation);
    val.camera = this.camera;
    return val;
  }

  public isCameraOn(): boolean { return this.cameraOn; }
  public setupFromFrustum(frustum: Frustum): ViewStatus {
    const stat = super.setupFromFrustum(frustum);
    if (ViewStatus.Success !== stat)
      return stat;

    this.turnCameraOff();
    const frustPts = frustum.points;

    // use comparison of back, front plane X sizes to indicate camera or flat view ...
    const xBack = frustPts[Npc.LeftBottomRear].distance(frustPts[Npc.RightBottomRear]);
    const xFront = frustPts[Npc.LeftBottomFront].distance(frustPts[Npc.RightBottomFront]);

    const flatViewFractionTolerance = 1.0e-6;
    if (xFront > xBack * (1.0 + flatViewFractionTolerance))
      return ViewStatus.InvalidWindow;

    // see if the frustum is tapered, and if so, set up camera eyepoint and adjust viewOrg and delta.
    const compression = xFront / xBack;
    if (compression >= (1.0 - flatViewFractionTolerance))
      return ViewStatus.Success;

    // the frustum has perspective, turn camera on
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
    return ViewStatus.Success;
  }

  protected static calculateMaxDepth(delta: Vector3d, zVec: Vector3d): number {
    const depthRatioLimit = 1.0E8;          // Limit for depth Ratio.
    const maxTransformRowRatio = 1.0E5;
    const minXYComponent = Math.min(Math.abs(zVec.x), Math.abs(zVec.y));
    const maxDepthRatio = (0.0 === minXYComponent) ? depthRatioLimit : Math.min((maxTransformRowRatio / minXYComponent), depthRatioLimit);
    return Math.max(delta.x, delta.y) * maxDepthRatio;
  }

  public getOrigin(): Point3d { return this.origin; }
  public getExtents(): Vector3d { return this.extents; }
  public getRotation(): RotMatrix { return this.rotation; }
  public setOrigin(origin: Point3d) { this.origin.setFrom(origin); }
  public setExtents(extents: Vector3d) { this.extents.setFrom(extents); }
  public setRotation(rot: RotMatrix) { this.rotation.setFrom(rot); }
  protected enableCamera(): void { this.cameraOn = true; }
  public supportsCamera(): boolean { return true; }
  public minimumFrontDistance() { return Math.max(15.2 * Constant.oneCentimeter, this.forceMinFrontDist()); }
  public isEyePointAbove(elevation: number): boolean { return !this.cameraOn ? (this.getZVector().z > 0) : (this.getEyePoint().z > elevation); }

  public getDisplayStyle3d() { return this.displayStyle as DisplayStyle3dState; }

  /**
   * Turn the camera off for this view. After this call, the camera parameters in this view definition are ignored and views that use it will
   * display with an orthographic (infinite focal length) projection of the view volume from the view direction.
   * @note To turn the camera back on, call #lookAt
   */
  public turnCameraOff() { this.cameraOn = false; }

  /** Determine whether the camera is valid for this view */
  public isCameraValid() { return this.camera.isValid(); }

  /** Calculate the lens angle formed by the current delta and focus distance */
  public calcLensAngle(): Angle {
    const maxDelta = Math.max(this.extents.x, this.extents.y);
    return Angle.createRadians(2.0 * Math.atan2(maxDelta * 0.5, this.camera.getFocusDistance()));
  }

  /** Get the target point of the view. If there is no camera, view center is returned. */
  public getTargetPoint(result?: Point3d): Point3d {
    if (!this.cameraOn)
      return super.getTargetPoint(result);

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
   */
  public lookAt(eyePoint: Point3d, targetPoint: Point3d, upVector: Vector3d, newExtents?: Vector2d, frontDistance?: number, backDistance?: number): ViewStatus {
    const yVec = upVector.normalize();
    if (!yVec) // up vector zero length?
      return ViewStatus.InvalidUpVector;

    const zVec = this.getEyePoint().vectorTo(targetPoint); // z defined by direction from eye to target
    const focusDist = zVec.normalizeWithLength(zVec).mag; // set focus at target point
    const minFrontDist = this.minimumFrontDistance();

    if (focusDist <= minFrontDist) // eye and target are too close together
      return ViewStatus.InvalidTargetPoint;

    const xVec = new Vector3d();
    if (yVec.crossProduct(zVec).normalizeWithLength(xVec).mag < Geometry.smallMetricDistance)
      return ViewStatus.InvalidUpVector;    // up is parallel to z

    if (zVec.crossProduct(xVec).normalizeWithLength(yVec).mag < Geometry.smallMetricDistance)
      return ViewStatus.InvalidUpVector;

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
      frontDistance = focusDist - minFrontDist;

    if (frontDistance < minFrontDist)
      frontDistance = minFrontDist;

    // BeAssert(backDistance > frontDistance);
    delta.z = (backDistance! - frontDistance);

    const frontDelta = delta.scale(frontDistance / focusDist);
    const stat = this.validateViewDelta(frontDelta, false); // validate window size on front (smallest) plane
    if (ViewStatus.Success !== stat)
      return stat;

    if (delta.z > ViewState3d.calculateMaxDepth(delta, zVec)) // make sure we're not zoomed out too far
      return ViewStatus.MaxDisplayDepth;

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
    return ViewStatus.Success;
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
  public lookAtUsingLensAngle(eyePoint: Point3d, targetPoint: Point3d, upVector: Vector3d, fov: Angle, frontDistance?: number, backDistance?: number): ViewStatus {
    const focusDist = eyePoint.distance(targetPoint);
    if (focusDist <= Constant.oneMillimeter)       // eye and target are too close together
      return ViewStatus.InvalidTargetPoint;

    if (fov.radians < .0001 || fov.radians > Math.PI)
      return ViewStatus.InvalidLens;

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
  public moveCameraLocal(distance: Vector3d): ViewStatus {
    const distWorld = this.getRotation().multiplyTransposeVector(distance);
    return this.moveCameraWorld(distWorld);
  }

  /**
   * Move the camera relative to its current location by a distance in world coordinates.
   * @param distance in world units.
   * @returns Status indicating whether the camera was successfully positioned. See values at [[ViewportStatus]] for possible errors.
   */
  public moveCameraWorld(distance: Vector3d): ViewStatus {
    if (!this.cameraOn) {
      this.origin.plus(distance, this.origin);
      return ViewStatus.Success;
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
  public rotateCameraLocal(angle: Angle, axis: Vector3d, aboutPt?: Point3d): ViewStatus {
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
  public rotateCameraWorld(angle: Angle, axis: Vector3d, aboutPt?: Point3d): ViewStatus {
    const about = aboutPt ? aboutPt : this.getEyePoint();
    const rotation = RotMatrix.createRotationAroundVector(axis, angle);
    const trans = Transform.createFixedPointAndMatrix(about, rotation!);
    const newTarget = trans.multiplyPoint(this.getTargetPoint());
    const upVec = rotation!.multiplyVector(this.getYVector());
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

  /** Ensure the focus plane lies between the front and back planes. If not, center it. */
  public verifyFocusPlane(): void {
    if (!this.cameraOn)
      return;

    let backDist = this.getBackDistance();
    const frontDist = backDist - this.extents.z;
    const camera = this.camera;
    const extents = this.extents;
    const rot = this.rotation;

    if (backDist <= 0.0 || frontDist <= 0.0) {
      // the camera location is invalid. Set it based on the view range.
      const tanAngle = Math.tan(camera.lens.radians / 2.0);
      backDist = extents.z / tanAngle;
      camera.setFocusDistance(backDist / 2);
      this.centerEyePoint(backDist);
      return;
    }

    const focusDist = camera.focusDistance;
    if (focusDist > frontDist && focusDist < backDist)
      return;

    // put it halfway between front and back planes
    camera.setFocusDistance((extents.z / 2.0) + frontDist);

    // moving the focus plane means we have to adjust the origin and delta too (they're on the focus plane, see diagram above)
    const ratio = camera.focusDistance / focusDist;
    extents.x *= ratio;
    extents.y *= ratio;
    camera.eye.plus3Scaled(rot.rowZ(), -backDist, rot.rowX(), -0.5 * extents.x, rot.rowY(), -0.5 * extents.y, this.origin); // this centers the camera too
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
  public setLensAngle(angle: Angle): void { this.camera.setLensAngle(angle); }

  /** Change the location of the eyePoint for the camera in this view.
   * @param pt The new eyepoint.
   * @note This method is generally for internal use only. Moving the eyePoint arbitrarily can result in skewed or illegal perspectives.
   * The most common method for user-level camera positioning is #lookAt.
   */
  public setEyePoint(pt: Point3d): void { this.camera.setEyePoint(pt); }

  /** Set the focus distance for this view.
   *  @note Changing the focus distance changes the plane on which the delta.x and delta.y values lie. So, changing focus distance
   *  without making corresponding changes to delta.x and delta.y essentially changes the lens angle, causing a "zoom" effect
   */
  public setFocusDistance(dist: number): void { this.camera.setFocusDistance(dist); }

  /**  Get the distance from the eyePoint to the focus plane for this view. */
  public getFocusDistance(): number { return this.camera.focusDistance; }
}

/** Parameters to construct a SpatialViewDefinition */
export interface SpatialViewDefinitionProps extends ViewDefinition3dProps {
  modelSelectorId: Id64 | string;
}

/** Defines a view of one or more SpatialModels.
 * The list of viewed models is stored by the ModelSelector.
 */
export class SpatialViewState extends ViewState3d {
  constructor(props: SpatialViewDefinitionProps, iModel: IModel, arg3: CategorySelectorState, displayStyle: DisplayStyle3dState, public modelSelector: ModelSelectorState) {
    super(props, iModel, arg3, displayStyle);
    if (arg3 instanceof SpatialViewState) { // from clone
      this.modelSelector = arg3.modelSelector;
    }
  }
  public getViewedExtents(): AxisAlignedBox3d { return this.iModel.projectExtents; }

  public toJSON(): SpatialViewDefinitionProps {
    const val = super.toJSON() as SpatialViewDefinitionProps;
    val.modelSelectorId = this.modelSelector.id;
    return val;
  }

  public viewsModel(modelId: Id64): boolean { return this.modelSelector.containsModel(modelId); }
}

/** Defines a spatial view that displays geometry on the image plane using a parallel orthographic projection. */
export class OrthographicViewState extends SpatialViewState {
  constructor(props: SpatialViewDefinitionProps, iModel: IModel, categories: CategorySelectorState, displayStyle: DisplayStyle3dState, modelSelector: ModelSelectorState) { super(props, iModel, categories, displayStyle, modelSelector); }

  // tslint:disable-next-line:no-empty
  public enableCamera(): void { }
  public supportsCamera(): boolean { return false; }
}

/** Parameters used to construct a ViewDefinition2d */
export interface ViewDefinition2dProps extends ViewDefinitionProps {
  baseModelId: Id64 | string;
  origin: any;
  delta: any;
  angle: any;
}

/** Defines the state of a view of a single 2d model. */
export class ViewState2d extends ViewState {
  public readonly origin: Point2d;
  public readonly delta: Point2d;
  public readonly angle: Angle;

  public constructor(props: ViewDefinition2dProps, iModel: IModel, categories: CategorySelectorState, displayStyle: DisplayStyle2dState, public readonly baseModel: Model2dState) {
    super(props, iModel, categories, displayStyle);
    this.origin = Point2d.fromJSON(props.origin);
    this.delta = Point2d.fromJSON(props.delta);
    this.angle = Angle.fromJSON(props.angle);
    if (categories instanceof ViewState2d)
      this.baseModel = categories.baseModel;
  }

  public toJSON(): ViewDefinition2dProps {
    const val = super.toJSON() as ViewDefinition2dProps;
    val.origin = this.origin;
    val.delta = this.delta;
    val.angle = this.angle;
    val.baseModelId = this.baseModel.id;
    return val;
  }

  public allow3dManipulations(): boolean { return false; }
  public getViewedExtents() { return AxisAlignedBox3d.fromRange2d(this.baseModel.extents); }
  public getOrigin() { return new Point3d(this.origin.x, this.origin.y); }
  public getExtents() { return new Vector3d(this.delta.x, this.delta.y); }
  public getRotation() { return RotMatrix.createRotationAroundVector(Vector3d.unitZ(), this.angle)!; }
  public setExtents(delta: Vector3d) { this.delta.set(delta.x, delta.y); }
  public setOrigin(origin: Point3d) { this.origin.set(origin.x, origin.y); }
  public setRotation(rot: RotMatrix) { const xColumn = rot.getColumn(0); this.angle.setRadians(Math.atan2(xColumn.y, xColumn.x)); }
  public viewsModel(modelId: Id64) { return this.baseModel.id.equals(modelId); }
}

/** a view of a DrawingModel */
export class DrawingViewState extends ViewState2d {
}

/** a view of a SheetModel */
export class SheetViewState extends ViewState2d {
}
