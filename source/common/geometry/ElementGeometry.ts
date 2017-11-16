/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { Angle } from "@bentley/geometry-core/lib/Geometry";
import { Constant } from "@bentley/geometry-core/lib/Constant";
import { Point2d, Point3d, Vector3d, Transform, Range2d, Range3d, RotMatrix, YawPitchRollAngles } from "@bentley/geometry-core/lib/PointVector";
import { CurveCollection } from "@bentley/geometry-core/lib/curve/CurveChain";
import { BSplineSurface3d } from "@bentley/geometry-core/lib/bspline/BSplineSurface";
import { GeometryQuery, CurvePrimitive } from "@bentley/geometry-core/lib/curve/CurvePrimitive";
import { SolidPrimitive } from "@bentley/geometry-core/lib/solid/SolidPrimitive";
import { IndexedPolyface } from "@bentley/geometry-core/lib/polyface/Polyface";
import { AxisOrder } from "@bentley/geometry-core/lib/Geometry";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
// import { IModel } from "../IModel";
import { GeometryParams } from "./GeometryProps";
import { OpCode, GSWriter } from "./GeometryStream";
import { DgnFB } from "./ElementGraphicsSchema";

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

export enum CoordSystem {
  Local = 0,  // <-- GeometricPrimitive being supplied in local coordinates. @note Builder must be created with a known placement for local coordinates to be meaningful.
  World = 1,  // <-- GeometricPrimitive being supplied in world coordinates. @note Builder requires world coordinate geometry when placement isn't specified up front.
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

  /** Determine whether this Placement3d is valid. */
  public isValid(): boolean { return this.bbox.isValid() && this.origin.maxAbs() < Constant.circumferenceOfEarth; }
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
  public get asCurvePrimitive() { return this._data as CurvePrimitive; }
  public get asCurveCollection() { return this._data as CurveCollection; }
  public get asSolidPrimitive() { return this._data as SolidPrimitive; }
  public get asBsplineSurface() { return this._data as BSplineSurface3d; }
  public get asIndexedPolyface() { return this._data as IndexedPolyface; }
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

  /** Return true if the geometry is or would be represented by a solid body. Accepted geometry includes BRep solids, capped SolidPrimitives, and closed Polyfaces */
  public isSolid(): boolean {
    switch (this._type) {
      case GeometryType.SolidPrimitive:
        return this.asSolidPrimitive.getCapped();
      case GeometryType.IndexedPolyface:
        return this.asIndexedPolyface.isClosedByEdgePairing();
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
        return this.asCurveCollection.isAnyRegionType();
      case GeometryType.BsplineSurface:
        return true;
      case GeometryType.SolidPrimitive:
        return !this.asSolidPrimitive.getCapped();
      case GeometryType.IndexedPolyface:
        return !this.asIndexedPolyface.isClosedByEdgePairing();
      // case GeometryType.BRepEntity:
      //  return ...
      default:
        return false;
    }
  }

  /** Return true if the geometry is or would be represented by a wire body. Accepted geometry includes BRep wires and CurveVectors */
  public isWire(): boolean {
    switch (this._type) {
      // case GeometryType.CurvePrimitive:
      //  return !(this._data instanceof PointString);
      case GeometryType.CurveCollection:
        return this.asCurveCollection.isOpenPath();
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
        if (!curve.fractionToFrenetFrame(0.0, localToWorld)) {
          const point = curve.startPoint();
          Transform.createTranslation(point, localToWorld);
          return true;
        }
        break;
      }
      // case GeometryType.CurveVector:
      case GeometryType.SolidPrimitive:
      {
        const solidPrim = this.asSolidPrimitive;
        const tMap = solidPrim.getConstructiveFrame();
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
        if (surface.fractionToRigidFrame(0, 0, localToWorld)) {
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
    const clonedObj = this._data.clone();
    if (!clonedObj)
      return new GeometricPrimitive(GeometryType.Undefined, undefined);
    if (this._data instanceof GeometryQuery) {
      return new GeometricPrimitive(this._type, this._data.clone());
    }

    // Handle other cases....
    return GeometricPrimitive.create(undefined, true);
  }
}

// =======================================================================================
// ! GeometryBuilder provides methods for setting up an element's GeometryStream and Placement2d or Placement3d.
// ! The GeometryStream stores one or more GeometricPrimitive and optional GeometryParam for a GeometricElement.
// ! An element's geometry should always be stored relative to its placement. As the placement defines the
// ! element to world transform, an element can be moved/rotated by just updating it's placement.
// !
// ! GeometryBuilder supports several approaches to facilliate creating a placement relative GeometryStream.
// ! Consider a 10m line from 5,5,0 to 15,5,0 where we want the placement origin to be the line's start point.
// !
// ! Approach 1: Construct a builder with the desired placement and then add the geometry in local coordinates.
// ! \code
// ! GeometryBuilderPtr builder = GeometryBuilder::Create(model, category, DPoint3d::From(5.0, 5.0, 0.0));
// ! builder->Append(*ICurvePrimitive::CreateLine(DSegment3d::From(DPoint3d::FromZero(), DPoint3d::From(10.0, 0.0, 0.0))));
// ! builder->Finish(source);
// ! \endcode
// !
// ! Approach 2: Construct a builder with the desired placement and then add the geometry in world coordinates.
// ! \code
// ! GeometryBuilderPtr builder = GeometryBuilder::Create(model, category, DPoint3d::From(5.0, 5.0, 0.0));
// ! builder->Append(*ICurvePrimitive::CreateLine(DSegment3d::From(DPoint3d::From(5.0, 5.0, 0.0), DPoint3d::From(15.0, 5.0, 0.0))), GeometryBuilder::CoordSystem::World);
// ! builder->Finish(source);
// ! \endcode
// !
// ! Approach 3: Construct a builder with identity placement, add the geometry in local coordinates, then update the element's placement.
// ! \code
// ! GeometryBuilderPtr builder = GeometryBuilder::Create(model, category, DPoint3d::FromZero());
// ! builder->Append(*ICurvePrimitive::CreateLine(DSegment3d::From(DPoint3d::FromZero(), DPoint3d::From(10.0, 0.0, 0.0))));
// ! builder->Finish(source);
// ! Placement3d placement = source.ToGeometrySource3d()->GetPlacement(); // Finish updated placement's ElementAlignedBox3d
// ! placement.GetOriginR() = DPoint3d::From(5.0, 5.0, 0.0);
// ! source.ToGeometrySource3dP()->SetPlacement(placement);
// ! \endcode
// !
// ! Approach 4: Construct a builder without specifying any placement, add the geometry in world coordinates, and let the builder choose a placement.
// ! \code
// ! GeometryBuilderPtr builder = GeometryBuilder::CreateWithAutoPlacement(model, category, DPoint3d::From(5.0, 5.0, 0.0));
// ! builder->Append(*ICurvePrimitive::CreateLine(DSegment3d::From(DPoint3d::From(5.0, 5.0, 0.0), DPoint3d::From(15.0, 5.0, 0.0))), GeometryBuilder::CoordSystem::World);
// ! builder->Finish(source);
// ! \endcode
// !
// ! @note It is NEVER correct to construct a builder with an identity placement and then proceed to add geometry in world coordinates.
// !       The resulting element won't have a meaningful placement.
// !       To keep the example code snippets more compact it was assumed that all operations are successful. Be aware however
// !       that trying to create a builder with invalid input (ex. 2d model and 3d placement) will return nullptr.
// !       An append call may also return false for un-supported geometry (ex. trying to append a cone to 2d builder).
// !
// ! GeometryBuilder also provides a mechanism for sharing repeated geometry, both within a single element, as well as between elements.
// ! GeometryBuilder can be used to define a DgnGeometryPart, and then instead of appending one or more GeometricPrimitive to a builder for a GeometricElement,
// ! you can instead append the DgnGeometryPartId to reference the shared geometry and position it relative to the GeometricElement's placement.
// !
// ! A DgnGeometryPart is always defined in it's un-rotated orientation and positioned relative to 0,0,0. The GeometryStream for a DgnGeometryPart can
// ! not include sub-category changes. A part may include specific symbology, otherwise it inherits the symbology established by the referencing GeometryStream.
// ! As an example, let's instead create our 10m line from above as a DgnGeometryPart. We will then use this part to create a "+" symbol by appending 4 instances.
// !
// ! Construct a builder to create a new DgnGeometryPart having already checked that it doesn't already exist.
// ! \code
// ! GeometryBuilderPtr partBuilder = GeometryBuilder::CreateGeometryPart(imodel, is3d);
// ! partBuilder->Append(*ICurvePrimitive::CreateLine(DSegment3d::From(DPoint3d::FromZero(), DPoint3d::From(10.0, 0.0, 0.0))));
// ! DgnGeometryPartPtr geomPart = DgnGeometryPart::Create(imodel, partCode); // The DgnCode for the part is important for finding an existing part
// ! if (SUCCESS == partBuilder->Finish(*geomPart)) imodel.Elements().Insert<DgnGeometryPart>(*geomPart); // Finish and Insert part
// ! \endcode
// !
// ! Construct a builder to create a new GeometricElement using an existing DgnGeometryPart.
// ! \code
// ! GeometryBuilderPtr builder = GeometryBuilder::Create(model, category, DPoint3d::From(5.0, 5.0, 0.0));
// ! DgnGeometryPartId partId = DgnGeometryPart::QueryGeometryPartId(partCode, imodel); // Find existing part by code, check partId.IsValid()
// ! builder->Append(partId, DPoint3d::FromZero());
// ! builder->Append(partId, DPoint3d::FromZero(), YawPitchRollAngles::FromDegrees(90.0, 0.0, 0.0));
// ! builder->Append(partId, DPoint3d::FromZero(), YawPitchRollAngles::FromDegrees(180.0, 0.0, 0.0));
// ! builder->Append(partId, DPoint3d::FromZero(), YawPitchRollAngles::FromDegrees(270.0, 0.0, 0.0));
// ! builder->Finish(source);
// ! \endcode
// !
// ! @note If performance/memory is the only consideration, it's not worth creating a DgnGeometryPart for very simple geometry such as a single line or cone.
// !
// ! @ingroup GROUP_Geometry
// =======================================================================================
export class GeometryBuilder {
  private appearanceChanged: boolean = false;
  private appearanceModified: boolean = false;
  private havePlacement: boolean = false;
  private isPartCreate: boolean = false;
  private is3d: boolean = false;
  private appendAsSubGraphics: boolean = false;
  private placement3d: Placement3d;
  private placement2d: Placement2d;
  // private imodel: IModel;
  private elParams: GeometryParams;
  private elParamsModified: GeometryParams;
  private writer: GSWriter;

  private constructor(/* imodel: IModel, */ categoryId: Id64, is3d: boolean) {
    // this.imodel = imodel;
    this.isPartCreate = !categoryId.isValid();
    this.is3d = is3d;
    this.writer = new GSWriter(/*imodel*/);
    this.elParams.setCategoryId(categoryId);
  }

  public static createPlacement2d(/*imodel: IModel,*/ categoryId: Id64, placement: Placement2d): GeometryBuilder {
    const retVal = new GeometryBuilder(/*imodel,*/ categoryId, false);
    retVal.placement2d = placement;
    retVal.placement2d.bbox.setNull();  // Throw away pre-existing bounding box
    retVal.havePlacement = true;
    return retVal;
  }

  public static createPlacement3d(/*imodel: IModel,*/ categoryId: Id64, placement: Placement3d): GeometryBuilder {
    const retVal = new GeometryBuilder(/*imodel,*/ categoryId, true);
    retVal.placement3d = placement;
    retVal.placement3d.bbox.setNull();  // Throw away pre-existing bounding box
    retVal.havePlacement = true;
    return retVal;
  }

  public static createWithoutPlacement(/*imodel: IModel,*/ categoryId: any, is3d: boolean): GeometryBuilder {
    return new GeometryBuilder(/*imodel,*/ categoryId, is3d);
  }

  private convertToLocal(geom: GeometricPrimitive): boolean {
    if (this.isPartCreate)
      return false;   // Part geometry must be supplied in local coordinates...

    let localToWorld = Transform.createIdentity();
    const transformParams = !this.havePlacement;

    if (transformParams) {
      if (!geom.getLocalCoordinateFrame(localToWorld))
        return false;

      const origin = localToWorld.translation();
      const rMatrix = localToWorld.matrixRef();
      const angles = YawPitchRollAngles.createFromRotMatrix(rMatrix);
      if (!angles)
        return false;

      if (this.is3d) {
        this.placement3d.origin = origin;
        this.placement3d.angles = angles;
      } else {
        if (origin.z !== 0.0)
          return false;
        if (0.0 !== angles.pitch.degrees || 0.0 !== angles.roll.degrees) {
          const tmpAngles = YawPitchRollAngles.createDegrees(0.0, angles.pitch.degrees, angles.roll.degrees);
          localToWorld.multiplyTransformTransform(Transform.createOriginAndMatrix(Point3d.create(), tmpAngles.toRotMatrix()), localToWorld);
        }
        this.placement2d.origin = Point2d.create();
        this.placement3d.angles = angles;
      }

      this.havePlacement = true;
    } else if (this.is3d) {
      localToWorld = this.placement3d.getTransform();
    } else {
      localToWorld = this.placement2d.getTransform();
    }

    if (localToWorld.isIdentity())
      return true;

    const worldToLocal = localToWorld.inverse();
    if (!worldToLocal)
      return false;
    // Note: Apply world-to-local to GeometryParams for auto-placement data supplied in world coords...
    if (transformParams && this.elParams.isTransformable())
      this.elParams.applyTransform(worldToLocal);

    return geom.tryTransformInPlace(worldToLocal);
  }

  private appendLocal(geom: GeometricPrimitive): boolean {
    if (!this.havePlacement) {
      return false;   // Placement must already be defined...
    }

    const localRange = geom.getRange();
    if (!localRange)
      return false;

    let opCode: OpCode;

    switch (geom.type) {
      case GeometryType.CurvePrimitive:
        opCode = OpCode.CurvePrimitive;
        break;
      case GeometryType.CurveCollection:
        opCode = geom.asCurveCollection.isAnyRegionType() ? OpCode.CurveCollection : OpCode.CurvePrimitive;
        break;
      case GeometryType.SolidPrimitive:
        opCode = OpCode.SolidPrimitive;
        break;
      case GeometryType.BsplineSurface:
        opCode = OpCode.BsplineSurface;
        break;
      case GeometryType.IndexedPolyface:
        opCode = OpCode.Polyface;
        break;
      // case BRepEntity
      // case TextString
      // case Image
      default:
        opCode = OpCode.Invalid;
        break;
    }

    this.onNewGeom(localRange, this.appendAsSubGraphics, opCode);
    return this.writer.dgnAppendGeometricPrimitive(geom, this.is3d);
  }
  private onNewGeom(localRange: Range3d, isSubGraphic: boolean, opCode: OpCode) {
    // NOTE: range to include line style width. Maybe this should be removed when/if we start doing locate from mesh tiles...
    if (this.elParams.categoryId.isValid()) {
      // this.elParams.resolve();

      const lsInfo = this.elParams.lineStyle;

      if (lsInfo !== undefined) {
        const maxWidth = lsInfo.lStyleSymb.styleWidth;

        localRange.low.x -= maxWidth;
        localRange.low.y -= maxWidth;
        localRange.high.x += maxWidth;
        localRange.high.y += maxWidth;

        if (this.is3d) {
          localRange.low.z -= maxWidth;
          localRange.high.z += maxWidth;
        }
      }
    }

    if (this.is3d) {
      this.placement3d.bbox.extendRange(localRange);
    } else {
      this.placement2d.bbox.extendPoint(Point2d.create(localRange.low.x, localRange.low.y));
      this.placement2d.bbox.extendPoint(Point2d.create(localRange.high.x, localRange.high.y));
    }

    let allowPatGradnt = false;
    let allowSolidFill = false;
    let allowLineStyle = false;
    let allowMaterial = false;

    switch (opCode) {
      case OpCode.GeometryPartInstance:
        allowSolidFill = allowPatGradnt = allowLineStyle = allowMaterial = true;    // Don't reject anything
        break;
      case OpCode.CurvePrimitive:
        allowLineStyle = true;
        break;
      case OpCode.CurveCollection:
        allowSolidFill = allowPatGradnt = allowLineStyle = allowMaterial = true;
        break;
      case OpCode.Polyface:
        allowSolidFill = allowMaterial = true;
        break;
      case OpCode.SolidPrimitive:
      case OpCode.BsplineSurface:
      // case Parasolid:
        allowMaterial = true;
        break;
      // case Image:
    }

    let hasInvalidPatGradnt = false;
    let hasInvalidSolidFill = false;
    let hasInvalidLineStyle = false;
    let hasInvalidMaterial = false;

    if (!allowPatGradnt || !allowSolidFill || !allowLineStyle || !allowMaterial) {
      if (DgnFB.FillDisplay.None !== this.elParams.fillDisplay) {
        if (this.elParams.gradient !== undefined) {
          if (!allowPatGradnt)
            hasInvalidPatGradnt = true;
        } else {
          if (!allowSolidFill)
            hasInvalidSolidFill = true;
        }
      }

      if (!allowPatGradnt && this.elParams.patternParams !== undefined)
        hasInvalidPatGradnt = true;
      if (!allowLineStyle && !this.elParams.isLineStyleFromSubCategoryAppearance() && this.elParams.hasStrokedLineStyle())
        hasInvalidLineStyle = true;
      if (!allowMaterial && !this.elParams.isMaterialFromSubCategoryAppearance() && this.elParams.materialId && this.elParams.materialId.isValid())
        hasInvalidMaterial = true;
    }

    if (hasInvalidPatGradnt || hasInvalidSolidFill || hasInvalidLineStyle || hasInvalidMaterial) {
      // NOTE: We won't change m_elParams in case some caller is doing something like appending a single symbology
      //       that includes fill, and then adding a series of open and closed elements expecting the open elements
      //       to ignore the fill.
      const localParams = this.elParams.clone();

      if (hasInvalidPatGradnt) {
        localParams.setGradient(undefined);
        localParams.setPatternParams(undefined);
      }
      if (hasInvalidSolidFill || hasInvalidPatGradnt)
        localParams.setFillDisplay(DgnFB.FillDisplay.None);
      if (hasInvalidLineStyle)
        localParams.setLineStyle(undefined);
      if (hasInvalidMaterial)
        localParams.setMaterialId(new Id64());
      if (!this.appearanceModified || !this.elParamsModified.isEqualTo(localParams)) {
        this.elParamsModified = localParams;
        this.writer.dgnAppendGeometryParams(this.elParamsModified, this.isPartCreate, this.is3d);
        this.appearanceChanged = this.appearanceModified = true;
      }
    } else if (this.appearanceChanged) {
      this.writer.dgnAppendGeometryParams(this.elParams, this.isPartCreate, this.is3d);
      this.appearanceChanged = this.appearanceModified = false;
    }

    if (isSubGraphic && !this.isPartCreate)
      this.writer.dgnAppendRange3d(localRange);
  }

  /** PUBLIC ONLY TEMPORARILY... TO AVOID TSLINT ERRORS DURING PUSH */
  public appendWorld(geom: GeometricPrimitive): boolean {
    if (!this.convertToLocal(geom))
      return false;
    return this.appendLocal(geom);
  }
}
