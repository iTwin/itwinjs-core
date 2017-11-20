/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { Point2d, Point3d, Vector3d, Range2d, Transform, Range3d, RotMatrix, YawPitchRollAngles } from "@bentley/geometry-core/lib/PointVector";
import { CurveCollection } from "@bentley/geometry-core/lib/curve/CurveChain";
import { BSplineSurface3d } from "@bentley/geometry-core/lib/bspline/BSplineSurface";
import { GeometryQuery, CurvePrimitive } from "@bentley/geometry-core/lib/curve/CurvePrimitive";
import { SolidPrimitive } from "@bentley/geometry-core/lib/solid/SolidPrimitive";
import { IndexedPolyface } from "@bentley/geometry-core/lib/polyface/Polyface";
import { AxisOrder, Angle } from "@bentley/geometry-core/lib/Geometry";
import { Constant } from "@bentley/geometry-core/lib/Constant";

// import { IModel } from "../IModel";

export enum GeometryType {
  Undefined = 0,
  CurvePrimitive = 1,
  CurveCollection = 2,
  SolidPrimitive = 3,
  BsplineSurface = 4,
  IndexedPolyface = 5,
  BRepEntity = 6,
  TextString = 7,
  Image = 8,
}

/**
 * A Range3d that is aligned with the axes of a coordinate space.
 */
export class AxisAlignedBox3d extends Range3d {
  constructor(low?: Point3d, high?: Point3d) {
    if (low === undefined || high === undefined)
      super(); // defines an empty box
    else
      super(low.x, low.y, low.z, high.x, high.y, high.z);
  }
  public static fromRange2d(r: Range2d) {const v = new AxisAlignedBox3d(); v.low.x = r.low.x; v.low.y = r.low.y; v.high.x = r.high.x; v.high.y = r.high.y; return v; }

  public getCenter(): Point3d { return this.low.interpolate(.5, this.high); }

  public fixRange() {
    if (this.low.x === this.high.x) {
      this.low.x -= .0005;
      this.high.x += .0005;
    }
    if (this.low.y === this.high.y) {
      this.low.y -= .0005;
      this.high.y += .0005;
    }
    if (this.low.z === this.high.z) {
      this.low.z -= .0005;
      this.high.z += .0005;
    }
  }
}

/** A bounding box aligned to the orientation of a 3d Element */
export class ElementAlignedBox3d extends Range3d {
  public constructor(low?: Point3d, high?: Point3d) {
    if (low === undefined || high === undefined)
      super(); // defines an empty box
    else
      super(low.x, low.y, low.z, high.x, high.y, high.z);
  }

  public get left(): number { return this.low.x; }
  public get bottom(): number { return this.low.y; }
  public get front(): number { return this.low.z; }
  public get right(): number { return this.high.x; }
  public get top(): number { return this.high.y; }
  public get back(): number { return this.high.z; }
  public get width(): number { return this.xLength(); }
  public get depth(): number { return this.yLength(); }
  public get height(): number { return this.zLength(); }
  public isValid(): boolean {
    const max = Constant.circumferenceOfEarth; const lo = this.low; const hi = this.high;
    return !this.isNull() && lo.x > -max && lo.y > -max && lo.z > -max && hi.x < max && hi.y < max && hi.z < max;
  }

  public static fromJSON(json?: any): ElementAlignedBox3d {
    if (!json)
      return new ElementAlignedBox3d();
    return new ElementAlignedBox3d(Point3d.fromJSON(json.low), Point3d.fromJSON(json.high));
  }
}

/** A bounding box aligned to the orientation of a 2d Element */
export class ElementAlignedBox2d extends Range2d {
  public constructor(low?: Point2d, high?: Point2d) {
    if (!low || !high)
      super(); // defines an empty box
    else
      super(low.x, low.y, high.x, high.y);
  }
  public get left(): number { return this.low.x; }
  public get bottom(): number { return this.low.y; }
  public get right(): number { return this.high.x; }
  public get top(): number { return this.high.y; }
  public get width(): number { return this.xLength(); }
  public get height(): number { return this.yLength(); }
  public static fromJSON(json?: any): ElementAlignedBox2d {
    if (!json)
      return new ElementAlignedBox2d();
    return new ElementAlignedBox2d(Point2d.fromJSON(json.low), Point2d.fromJSON(json.high));
  }
  public isValid(): boolean {
    const max = Constant.circumferenceOfEarth; const lo = this.low; const hi = this.high;
    return !this.isNull() && lo.x > -max && lo.y > -max && hi.x < max && hi.y < max;
  }
}

/**
 * The placement of a GeometricElement3d. This includes the origin, orientation, and size (bounding box) of the element.
 * All geometry of a GeometricElement are relative to its placement.
 */
export class Placement3d {
  public constructor(public origin: Point3d, public angles: YawPitchRollAngles, public bbox: ElementAlignedBox3d) { }
  public getTransform() { return Transform.createOriginAndMatrix(this.origin, this.angles.toRotMatrix()); }
  public static fromJSON(json?: any): Placement3d {
    json = json ? json : {};
    return new Placement3d(Point3d.fromJSON(json.origin), YawPitchRollAngles.fromJSON(json.angles), ElementAlignedBox3d.fromJSON(json.bbox));
  }

  public setFrom(other: Placement3d) {
    this.origin.setFrom(other.origin);
    this.angles.setFrom(other.angles);
    this.bbox.setFrom(other.bbox);
  }

  /** Determine whether this Placement3d is valid. */
  public isValid(): boolean { return this.bbox.isValid() && this.origin.maxAbs() < Constant.circumferenceOfEarth; }

  public calculateRange(): AxisAlignedBox3d {
    const range = new AxisAlignedBox3d();

    if (!this.isValid())
      return range;

    this.getTransform().multiplyRange(this.bbox, range);

    // low and high are not allowed to be equal
    range.fixRange();
    return range;
  }
}

/** The placement of a GeometricElement2d. This includes the origin, rotation, and size (bounding box) of the element. */
export class Placement2d {
  public constructor(public origin: Point2d, public angle: Angle, public bbox: ElementAlignedBox2d) { }
  public getTransform() { return Transform.createOriginAndMatrix(Point3d.createFrom(this.origin), RotMatrix.createRotationAroundVector(Vector3d.unitZ(), this.angle)!); }
  public static fromJSON(json?: any): Placement2d {
    json = json ? json : {};
    return new Placement2d(Point2d.fromJSON(json.origin), Angle.fromJSON(json.angle), ElementAlignedBox2d.fromJSON(json.bbox));
  }

  /** Determine whether this Placement2d is valid. */
  public isValid(): boolean { return this.bbox.isValid() && this.origin.maxAbs() < Constant.circumferenceOfEarth; }

  public setFrom(other: Placement2d) {
    this.origin.setFrom(other.origin);
    this.angle.setFrom(other.angle);
    this.bbox.setFrom(other.bbox);
  }

  public calculateRange(): AxisAlignedBox3d {
    const range = new AxisAlignedBox3d();

    if (!this.isValid())
      return range;

    this.getTransform().multiplyRange( Range3d.createRange2d(this.bbox, 0), range);

    // low and high are not allowed to be equal
    range.fixRange();

    range.low.z = - 1.0;  // is the 2dFrustumDepth, which === 1 meter
    range.high.z = 1.0;

    return range;
  }
}

 /** Class for small single tile raster image that may be included in a GeometryStream. */
/*
export class ImageGraphic {
  private _image: any;   // TODO: use specific Image type
  private _corners: any;   // TODO: use specific IGraphicBuilder type
  private _drawBorder: boolean;
  private _useFillTint: boolean;
  private _texture: any;   // TODO: use specific Texture type

  public get image() { return this._image; }
  public get corners() { return this._corners; }
  public get drawBorder() { return this._drawBorder; }
  public get useFillTint() { return this._useFillTint; }
  public get texture() { return this._texture; }

  protected constructor(image: any, corners: any, drawBorder: boolean, useFillTint: boolean) {
    this._image = image;
    this._corners = corners;
    this._drawBorder = drawBorder;
    this._useFillTint = useFillTint;
  }

  public static create(image: any, corners: any, drawBorder: boolean = false, useFillTint: boolean = false): ImageGraphic {
    return new ImageGraphic(image, corners, drawBorder, useFillTint);
  }

  public clone(): ImageGraphic { return new ImageGraphic(this._image, this._corners, this._drawBorder, this._useFillTint); }

  public applyTransform(transform: Transform) { transform.multiplyPoint3dArray(this._corners.pts); }

  public getRange(): Range3d { return Range3d.createArray(this._corners.pts); }

  public createTexture(context: any) {
    const vp: any = context.getViewport();  // May need work: For mesh tiles, ask context for render target...
    this._texture = (vp !== undefined) ? vp.getRenderTarget().createTexture(this._image) : undefined;
  }

  public addToGraphic(graphic: any) {
    if (this._texture !== undefined)
      graphic.addTile(this._texture, this._corners);

    if (!this._drawBorder && this._texture !== undefined)   // Always show border when texture isn't available
      return;

    const pts: Point3d[] = [this._corners.pts[0], this._corners.pts[1], this._corners.pts[3], this._corners.pts[2]];
    pts[4] = pts[0];

    if (this._texture !== undefined)
      graphic.addLineString(pts);
    else
      graphic.addShape(pts, true);   // Draw filled shape for pick...
  }

  public addToGraphic2d(graphic: any, displayPriority: number) {
    const tileCorners = this._corners;  // Could possibly have to make deep copy instead...
    tileCorners.pts[0].z = tileCorners.pts[1].z = tileCorners.pts[2].z = tileCorners.pts[3].z = displayPriority;

    if (this._texture !== undefined)
      graphic.addTile(this._texture, tileCorners);

    if (!this._drawBorder && this._texture !== undefined)   // Always show border when texture isn't available
      return;

    const pts: Point2d[] = [Point2d.create(tileCorners.pts[0].x, tileCorners.pts[0].y),
                            Point2d.create(tileCorners.pts[1].x, tileCorners.pts[1].y),
                            Point2d.create(tileCorners.pts[3].x, tileCorners.pts[3].y),
                            Point2d.create(tileCorners.pts[2].x, tileCorners.pts[2].y)];
    pts[4] = pts[0];

    if (this._texture !== undefined)
      graphic.addLineString2d(pts, displayPriority);
    else
      graphic.addShape2d(pts, true, displayPriority); // Draw filled shape for pick...
  }
}
*/

/** Class for multiple RefCounted geometry types: CurvePrimitive, CurveVector, SolidPrimitive, BsplineSurface, PolyfaceHeader, BRepEntity */
export class GeometricPrimitive {
  protected _type: GeometryType;
  protected _data: any;

  public get type() { return this._type; }
  public get data() { return this._data; }
  public get asCurvePrimitive(): CurvePrimitive | undefined { return (this._type === GeometryType.CurvePrimitive) ? this._data as CurvePrimitive : undefined; }
  public get asCurveCollection(): CurveCollection | undefined { return (this._type === GeometryType.CurveCollection) ? this._data as CurveCollection : undefined; }
  public get asSolidPrimitive(): SolidPrimitive | undefined { return (this._type === GeometryType.SolidPrimitive) ? this._data as SolidPrimitive : undefined; }
  public get asBsplineSurface(): BSplineSurface3d | undefined { return (this._type === GeometryType.BsplineSurface) ? this._data as BSplineSurface3d : undefined; }
  public get asIndexedPolyface(): IndexedPolyface | undefined { return (this._type === GeometryType.IndexedPolyface) ? this._data as IndexedPolyface : undefined; }
  // public get asIBRepEntity() { return this._data as ; }
  // public get asTextString() { return this._data as ; }
  // public get asImage() { return this._data as ; }

  protected constructor(type: GeometryType, source: any) {
    this._type = type;
    this._data = source;
  }

  public static createCurvePrimitiveRef(source: CurvePrimitive): GeometricPrimitive { return new GeometricPrimitive(GeometryType.CurvePrimitive, source); }
  public static createCurveCollectionRef(source: CurveCollection): GeometricPrimitive { return new GeometricPrimitive(GeometryType.CurveCollection, source); }
  public static createSolidPrimitiveRef(source: SolidPrimitive): GeometricPrimitive { return new GeometricPrimitive(GeometryType.SolidPrimitive, source); }
  public static createBsplineSurfaceRef(source: BSplineSurface3d): GeometricPrimitive { return new GeometricPrimitive(GeometryType.BsplineSurface, source); }
  public static createIndexedPolyfaceRef(source: IndexedPolyface): GeometricPrimitive { return new GeometricPrimitive(GeometryType.IndexedPolyface, source); }
  // public static createIBRepEntityRef();
  // public static createTextStringRef();
  // public static createImageGraphicRef();

  public static createCurvePrimitiveClone(source: CurvePrimitive): GeometricPrimitive { return new GeometricPrimitive(GeometryType.CurvePrimitive, source.clone()); }
  public static createCurveCollectionClone(source: CurveCollection): GeometricPrimitive { return new GeometricPrimitive(GeometryType.CurveCollection, source.clone()); }
  public static createSolidPrimitiveClone(source: SolidPrimitive): GeometricPrimitive { return new GeometricPrimitive(GeometryType.SolidPrimitive, source.clone()); }
  public static createBsplineSurfaceClone(source: BSplineSurface3d): GeometricPrimitive { return new GeometricPrimitive(GeometryType.BsplineSurface, source.clone()); }
  public static createIndexedPolyfaceClone(source: IndexedPolyface): GeometricPrimitive { return new GeometricPrimitive(GeometryType.IndexedPolyface, source.clone()); }
  // public static createIBRepEntityRef();
  // public static createTextStringRef();
  // public static createImageGraphicRef();

  /** Create, checking for proper instance, using either a reference or a clone. */
  public static create(source: any, useRef: boolean): any {
    if (source instanceof CurvePrimitive)
      if (useRef)
        return GeometricPrimitive.createCurvePrimitiveRef(source);
      else
        return GeometricPrimitive.createCurvePrimitiveClone(source);
    else if (source instanceof CurveCollection)
      if (useRef)
        return GeometricPrimitive.createCurveCollectionRef(source);
      else
        return GeometricPrimitive.createCurveCollectionClone(source);
    else if (source instanceof SolidPrimitive)
      if (useRef)
        return GeometricPrimitive.createSolidPrimitiveRef(source);
      else
        return GeometricPrimitive.createSolidPrimitiveClone(source);
    else if (source instanceof BSplineSurface3d)
      if (useRef)
        return GeometricPrimitive.createBsplineSurfaceRef(source);
      else
        return GeometricPrimitive.createBsplineSurfaceClone(source);
    else if (source instanceof IndexedPolyface)
      if (useRef)
        return GeometricPrimitive.createIndexedPolyfaceRef(source);
      else
        return GeometricPrimitive.createIndexedPolyfaceClone(source);
    // elseif instanceof BRepEntity
    // elseif instanceof TextString
    // elseif instanceof ImageGraphic
    else
      return undefined;
  }

  public is3dGeometryType(): boolean {
    switch (this._type) {
      case GeometryType.SolidPrimitive:
      case GeometryType.BsplineSurface:
      case GeometryType.IndexedPolyface:
      case GeometryType.BRepEntity:
        return true;
      default:
        return false;
    }
  }

  /** Return true if the geometry is or would be represented by a solid body. Accepted geometry includes BRep solids, capped SolidPrimitives, and closed Polyfaces */
  public isSolid(): boolean {
    switch (this._type) {
      case GeometryType.SolidPrimitive:
        return this.asSolidPrimitive!.getCapped();
      case GeometryType.IndexedPolyface:
        return this.asIndexedPolyface!.isClosedByEdgePairing();
      // case GeometryType.BRepEntity:
      //  return ...
      default:
        return false;
    }
  }

  /** Return true if the geometry is or would be represented by a sheet body. Examples include BRep sheets, un-capped SolidPrimitives, region CurveVectors, Bspline Surfaces, and unclosed Polyfaces */
  public isSheet(): boolean {
    switch (this._type) {
      case GeometryType.CurveCollection:
        return this.asCurveCollection!.isAnyRegionType();
      case GeometryType.BsplineSurface:
        return true;
      case GeometryType.SolidPrimitive:
        return !this.asSolidPrimitive!.getCapped();
      case GeometryType.IndexedPolyface:
        return !this.asIndexedPolyface!.isClosedByEdgePairing();
      // case GeometryType.BRepEntity:
      //  return ...
      default:
        return false;
    }
  }

  /** Return true if the geometry is or would be represented by a wire body. Accepted geometry includes BRep wires and CurveVectors */
  public isWire(): boolean {
    switch (this._type) {
      case GeometryType.CurvePrimitive:
        return true;
      //  return !(this._data instanceof PointString);
      case GeometryType.CurveCollection:
        return this.asCurveCollection!.isOpenPath();
      // case GeometryType.BRepEntity:
      //  return ...
      default:
        return false;
    }
  }

  /** Return the type of solid kernel entity that would be used to represent this geometry */
  // public getBRepEntityType(): EntityType;

  /** Convenience method - treats as 3d geometry */
  // public addToGraphic();

  // TODO: Implement Geometry-Core functions that this method requires for specific cases
  public getLocalCoordinateFrame(localToWorld: Transform): boolean {
    switch (this._type) {
      case GeometryType.CurvePrimitive:
      {
        const curve = this.asCurvePrimitive;
        if (!curve!.fractionToFrenetFrame(0.0, localToWorld)) {
          const point = curve!.startPoint();
          Transform.createTranslation(point, localToWorld);
          return true;
        }
        break;
      }
      // case GeometryType.CurveVector:
      case GeometryType.SolidPrimitive:
      {
        const solidPrim = this.asSolidPrimitive;
        const tMap = solidPrim!.getConstructiveFrame();
        if (!tMap) {
          localToWorld.setIdentity();
          return false;
        }
        const worldToLocal = tMap.transform1Ref();
        localToWorld.setFrom(tMap.transform0Ref());
        if (!worldToLocal) {
          localToWorld.setIdentity();
          return false;
        }
        break;
      }
      case GeometryType.IndexedPolyface:
      {
        /*
        const polyface = this.asIndexedPolyface;
        let area = 0;
        const centroid = Point3d.create();
        const axes = RotMatrix.createIdentity();
        const momentXYZ = Vector3d.create();
        */
        if (/*!polyface.computePrincipalAreaMoments(area, centroid, axes, momentXYZ)*/ true) {
          localToWorld.setIdentity();
          return false;
        }
        // Transform.createRefs(centroid, axes);
        // break;
      }
      case GeometryType.BsplineSurface:
      {
        const surface = this.asBsplineSurface;
        /*
        let area = 0;
        const centroid = Vector3d.create();
        const axes = RotMatrix.createIdentity();
        const momentXYZ = Vector3d.create();
        if (surface.computePrincipleAreaMoments(area, centroid, axes, momentXYZ)) {
          Transform.createRefs(centroid, axes);
          break;
        } else if ... */
        if (surface!.fractionToRigidFrame(0, 0, localToWorld)) {
          break;
        }
        localToWorld.setIdentity();
        return false;
      }
      // case GeometryType.BRepEntity:
      // case GeometryType.TextString:
      // case GeometryType.Image:
      default:
      {
        localToWorld.setIdentity();
        return false;
      }
    }

    // NOTE: Ensure rotation is squared up and normalized (ComputePrincipalAreaMoments/GetEntityTransform is scaled)...
    const rMatrix = localToWorld.matrixRef();
    RotMatrix.createPerpendicularUnitColumns(rMatrix.columnX(), rMatrix.columnY(), AxisOrder.XYZ, rMatrix);

    return true;
  }

  // Expensive... copies geometry
  public getLocalRange(localToWorld: Transform, result?: Range3d): Range3d | undefined {
    if (result) result.setNull;
    const localRange = result ? result : Range3d.createNull();
    if (!this.getLocalCoordinateFrame(localToWorld))
      return undefined;
    if (localToWorld.isIdentity())
      return this.getRange(undefined, localRange);
    /*
    #if defined (BENTLEYCONFIG_PARASOLID)
    GeometricPrimitivePtr clone;

    // NOTE: Avoid un-necessary copy of BRep. We just need to change entity transform...
    if (GeometryType::BRepEntity == GetGeometryType())
        clone = new GeometricPrimitive(PSolidUtil::InstanceEntity(*GetAsIBRepEntity()));
    else
        clone = Clone();
    #else
    GeometricPrimitivePtr clone = Clone();
    */
    const clone = this.clone();
    const worldToLocal = localToWorld.inverse();
    if (!worldToLocal)
      return undefined;
    clone.tryTransformInPlace(worldToLocal);
    return clone.getRange(undefined, localRange);
  }

  /** Makes a call to the GeometryQuery range function, which begins with a null range and */
  public getRange(transform?: Transform, result?: Range3d): Range3d | undefined {
    const range = result ? result : Range3d.createNull();
    if (this._data instanceof GeometryQuery) {
      this._data.range(transform, range);
      if (range.isNull())
        return undefined;
      return range;
    }

    // Handle other cases....
    return undefined;
  }

  public tryTransformInPlace(transform: Transform): boolean {
    if (this._data instanceof GeometryQuery)
      return this._data.tryTransformInPlace(transform);

    // Handle other cases....
    return false;
  }

  public isSameStructureAndGeometry(primitive: GeometricPrimitive /*, tolerance: number*/): boolean {
    if (this._type !== primitive._type)
      return false;

    if (this._data instanceof GeometryQuery)
      return this._data.isAlmostEqual(primitive._data);

    // Handle other cases....
    return false;
  }

  // Expensive... clones all geometry
  public clone(): GeometricPrimitive {
    if (this._data instanceof GeometryQuery) {
      const clonedObj = this._data.clone();
      if (!clonedObj)
        return new GeometricPrimitive(GeometryType.Undefined, undefined);
      return new GeometricPrimitive(this._type, clonedObj);
    }

    // Handle other cases....
    return new GeometricPrimitive(GeometryType.Undefined, undefined);
  }
}
