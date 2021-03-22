/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Geometry
 */
import { flatbuffers } from "flatbuffers";
import { Id64, Id64String } from "@bentley/bentleyjs-core";
import { Angle, AngleSweep, Arc3d, BentleyGeometryFlatBuffer, FrameBuilder, GeometryQuery, LineString3d, Loop, Matrix3d, Plane3dByOriginAndUnitNormal, Point2d, Point3d, Point3dArray, PointString3d, Range3d, Transform, Vector3d, YawPitchRollAngles } from "@bentley/geometry-core";
import { EGFBAccessors } from "./ElementGeometryFB";
import { Base64EncodedString } from "../Base64EncodedString";
import { TextString, TextStringProps } from "./TextString";
import { ColorDef } from "../ColorDef";
import { BackgroundFill, FillDisplay, GeometryClass, GeometryParams } from "../GeometryParams";
import { Gradient } from "../Gradient";
import { ThematicGradientSettings, ThematicGradientSettingsProps } from "../ThematicDisplay";
import { AreaPattern } from "./AreaPattern";
import { BRepEntity } from "./GeometryStream";
import { ImageGraphic, ImageGraphicCorners, ImageGraphicProps } from "./ImageGraphic";
import { LineStyle } from "./LineStyle";
import { ElementAlignedBox3d, Placement3d } from "./Placement";

/** Values for [[ElementGeometryDataEntry.opcode]]
 * @alpha
 */
export enum ElementGeometryOpcode {
  /** Local range of next geometric primitive */
  SubGraphicRange = 2,
  /** Reference to a geometry part */
  PartReference = 3,
  /** Set symbology for subsequent geometry to override sub-category appearance */
  BasicSymbology = 4,
  /** Line, line string, shape, or point string (automatic simplification of a CurvePrimitive/CurveCollection) */
  PointPrimitive = 5,
  /** 2d line, line string, shape, or point string (automatic simplification of a CurvePrimitive/CurveCollection) */
  PointPrimitive2d = 6,
  /** Arc or ellipse (automatic simplification of a CurvePrimitive/CurveCollection) */
  ArcPrimitive = 7,
  /** [[CurveCollection]] */
  CurveCollection = 8,
  /** [[Polyface]] */
  Polyface = 9,
  /** [[CurvePrimitive]] */
  CurvePrimitive = 10,
  /** [[SolidPrimitive]] */
  SolidPrimitive = 11,
  /** [[BSplineSurface3d]] */
  BsplineSurface = 12,
  /** Opaque and gradient fills [[Gradient]] */
  Fill = 19,
  /** Hatch, cross-hatch, or area pattern [[AreaPattern]] */
  Pattern = 20,
  /** Render material */
  Material = 21,
  /** [[TextString]] */
  // eslint-disable-next-line @typescript-eslint/no-shadow
  TextString = 22,
  /** Specifies line style overrides [[LineStyle.Modifier]] */
  LineStyleModifiers = 23,
  /** Boundary represention solid, sheet, or wire body [[BRepEntity.DataProps]] */
  BRep = 25,
  /** Small single-tile raster image [[ImageGraphic]] */
  Image = 28,
}

/** Geometry stream entry data plus opcode to describe what the data represents.
 * @alpha
 */
export interface ElementGeometryDataEntry {
  /** The geometry stream entry type idenfiier [[ElementGeometryOpcode]] */
  opcode: number;
  /** Zero-based flatbuffers data */
  data: Uint8Array;
}

/** Information provided to [[ElementGeometryFunction]].
 * @alpha
 */
export interface ElementGeometryInfo {
  /** ID for the [Category]($imodeljs-backend), undefined for geometry parts */
  categoryId?: Id64String;
  /** A row-major storage 4x3 transform to world coordinate, undefined for geometry parts */
  sourceToWorld?: Float64Array;
  /** The element aligned bounding box for the geometry stream stored as 6 values for low/high */
  bbox?: Float64Array;
  /** If true, geometry displays oriented to face the camera */
  viewIndependent?: boolean;
  /** If true, geometry stream contained breps that were omitted or replaced as requested */
  brepsPresent?: boolean;
  /** The geometry stream data */
  entryArray: ElementGeometryDataEntry[];
}

/** A callback function that receives geometry stream data.
 * @see [IModelDb.elementGeometryRequest]($imodeljs-backend)
 * @alpha
 */
export type ElementGeometryFunction = (info: ElementGeometryInfo) => void;

/** Parameters for [IModelDb.elementGeometryRequest]($imodeljs-backend)
 * @alpha
 */
export interface ElementGeometryRequest {
  /** The source element for the geometry stream */
  elementId: Id64String;
  /** A function to call for the geometry stream data */
  onGeometry: ElementGeometryFunction;
  /** Whether to omit BRep data */
  skipBReps?: boolean;
  /** When not omitting BReps, whether to return a mesh or curve representation instead of the brep data */
  replaceBReps?: boolean;
  /** Option for replaceBReps, max distance from a face to the original geometry, see [StrokeOptions]($geometry-core) */
  chordTol?: number;
  /** Option for replaceBReps, max angle difference in radians for approximated face, see [StrokeOptions]($geometry-core) */
  angleTol?: number;
  /** Option for replaceBReps, max length of any edge in generated faces, see [StrokeOptions]($geometry-core) */
  maxEdgeLength?: number;
  /** Option for replaceBReps, ignore faces with bounding boxes smaller than this size when facetting */
  minBRepFeatureSize?: number;
}

/** Parameters for [IModelDb.elementGeometryUpdate]($imodeljs-backend)
 * @alpha
 */
export interface ElementGeometryUpdate {
  /** The source element for the geometry stream */
  elementId: Id64String;
  /** The geometry stream data */
  entryArray: ElementGeometryDataEntry[];
  /** Whether entries are supplied local to placement transform or in world coordinates */
  isWorld?: boolean;
  /** If true, create geometry part with 2d geometry */
  is2dPart?: boolean;
  /** If true, create geometry that displays oriented to face the camera */
  viewIndependent?: boolean;
}

/** Values for [[BRepGeometryCreate.operation]]
 * @alpha
 */
export enum BRepGeometryOperation {
  /** Unite target (first entry) with one or more tool entities. */
  Unite = 0,
  /** Subtract one or more tool entities from target entity (first entry) */
  Subtract = 1,
  /** Intersect target (first entry) with one or more tool entities */
  Intersect = 2,
  /** Sew the given set of surfaces together by joining those that share edges in common */
  Sew = 3,
  /** Create a cut in the target (first entry) using a planar region (second entry) and optional depth */
  Cut = 4,
  /** Create a pad or pocket in the target (first entry) using a planar region (second entry) */
  Emboss = 5,
  /** Create a solid from a surface by offsetting using the specified forward and backward distances */
  Thicken = 6,
  /** Create a shelled solid by offsetting all faces by the supplied distance */
  Hollow = 7,
  /** Create a solid or surface by sweeping a planar profile (first entry) along a path (second entry) */
  Sweep = 8,
  /** Create a solid or surface by lofting through a set of paths or regions */
  Loft = 9,
  /** Create a solid or sheet with all non-smooth/non-laminar edges rounded */
  Round = 10,
}

/** Parameters for [[BRepGeometryOperation.Cut]]
 * @alpha
 */
export interface BRepCutProps {
  /** Optional cut depth; through solid if not specified */
  distance?: number;
  /** Optional cut direction; in direction of profile normal if not specified */
  bothDirections?: boolean;
}

/** Parameters for [[BRepGeometryOperation.Thicken]]
 * @alpha
 */
export interface BRepThickenProps {
  /** Offset to apply in surface normal direction; at least one of frontDistance or backDistance must be specified */
  frontDistance?: number;
  /** Offset to apply in reverse surface normal direction */
  backDistance?: number;
}

/** Parameters for [[BRepGeometryOperation.Hollow]]
 * @alpha
 */
export interface BRepHollowProps {
  /** Offset to apply to all faces; positive value shells outwards, negative value shells inwards */
  distance: number;
}

/** Parameters for [[BRepGeometryOperation.Round]]
 * @alpha
 */
export interface BRepRoundProps {
  /** Radius to apply to all non-laminar/non-smooth edges */
  radius: number;
}

/** Parameters for [IModelDb.createBRepGeometry]($imodeljs-backend)
 * @alpha
 */
export interface BRepGeometryCreate {
  /** The operation to perform on the input geometry */
  operation: BRepGeometryOperation;
  /** The input target and tool geometry (curves, surfaces, and solids) to perform the given operation on */
  entryArray: ElementGeometryDataEntry[];
  /** A function to call for the result geometry */
  onResult: BRepGeometryFunction;
  /** Whether disjoint results should be returned as multiple entries or a single disjoint body */
  separateDisjoint?: boolean;
  /** Options and parameters for this operation */
  parameters?: BRepCutProps | BRepThickenProps | BRepHollowProps | BRepRoundProps;
}

/** Information provided to [[BRepGeometryFunction]].
 * @alpha
 */
export interface BRepGeometryInfo {
  /** The result geometry if the operation was successful */
  entryArray: ElementGeometryDataEntry[];
}

/** A callback function that receives brep operation result geometry.
 * @see [IModelDb.createBRepGeometry]($imodeljs-backend)
 * @alpha
 */
export type BRepGeometryFunction = (info: BRepGeometryInfo) => void;

/** Provides utility functions for working with [[ElementGeometryDataEntry]].
 * @alpha
 */
export namespace ElementGeometry {
  /** [[ElementGeometry.Builder]] is a helper class for populating a [[ElementGeometryDataEntry]] array needed to create a [[GeometricElement]] or [[GeometryPart]]. */
  export class Builder {
    private _localToWorld?: Transform;
    private _worldToLocal?: Transform;
    /** GeometryStream entries */
    public readonly entries: ElementGeometryDataEntry[] = [];

    /** Current placement transform, converts local coordinate (placement relative) input to world */
    public get localToWorld() { return this._localToWorld; }

    /** Current inverse placement transform, converts world coordinate input to local (placement relative) */
    public get worldToLocal() { return this._worldToLocal; }

    /** Supply optional local to world transform. Used to transform world coordinate input relative to element placement.
     * For a [[GeometricElement]]'s placement to be meaningful, world coordinate geometry should never be appended to an element with an identity placement.
     * Can be called with undefined or identity transform to start appending geometry supplied in local coordinates again.
     */
    public setLocalToWorld(localToWorld?: Transform) {
      this._localToWorld = (undefined === localToWorld || localToWorld.isIdentity ? undefined : localToWorld.clone());
      this._worldToLocal = (undefined === this._localToWorld ? undefined : this._localToWorld.inverse());
    }

    /** Supply local to world transform from a Point3d and optional YawPitchRollAngles.
     * @see [[Placement3d]]
     */
    public setLocalToWorld3d(origin: Point3d, angles: YawPitchRollAngles = YawPitchRollAngles.createDegrees(0.0, 0.0, 0.0)) {
      this.setLocalToWorld(Transform.createOriginAndMatrix(origin, angles.toMatrix3d()));
    }

    /** Supply local to world transform from a Point2d and optional Angle.
     * @see [[Placement2d]]
     */
    public setLocalToWorld2d(origin: Point2d, angle: Angle = Angle.createDegrees(0.0)) {
      this.setLocalToWorld(Transform.createOriginAndMatrix(Point3d.createFrom(origin), Matrix3d.createRotationAroundVector(Vector3d.unitZ(), angle)));
    }

    /** Compute angles suitable for passing to [[setLocalToWorld3d]] from an array of 3d points. */
    public static placementAnglesFromPoints(pts: Point3d[], defaultUp?: Vector3d, result?: YawPitchRollAngles): YawPitchRollAngles {
      const angles = result ? result : new YawPitchRollAngles();
      const zVec = defaultUp ? defaultUp.clone() : Vector3d.unitZ();
      const matrix = Matrix3d.createRigidHeadsUp(zVec);

      YawPitchRollAngles.createFromMatrix3d(matrix, angles);

      if (pts.length < 2 || pts[0].isAlmostEqual(pts[1]))
        return angles;

      // Check if points have a well defined normal to use instead of defaultUp...
      const frameTransform = FrameBuilder.createFrameToDistantPoints(pts);
      if (undefined !== frameTransform) {
        const plane = Plane3dByOriginAndUnitNormal.create(pts[0], frameTransform.matrix.getColumn(2));
        if (undefined !== plane && Point3dArray.isCloseToPlane(pts, plane))
          zVec.setFrom(plane.getNormalRef());
      }

      const xVec = Vector3d.createStartEnd(pts[0], pts[1]);
      if (xVec.isParallelTo(zVec, true))
        return angles;

      const yVec = xVec.unitCrossProduct(zVec);
      if (undefined === yVec)
        return angles;

      Matrix3d.createColumns(xVec, yVec, zVec, matrix);
      if (undefined === Matrix3d.createRigidFromMatrix3d(matrix, undefined, matrix))
        return angles;

      YawPitchRollAngles.createFromMatrix3d(matrix, angles);
      return angles;
    }

    /** Compute angle suitable for passing to [[setLocalToWorld2d]] from an array of xy plane points. */
    public static placementAngleFromPoints(pts: Point3d[], result?: Angle): Angle {
      const angles = ElementGeometry.Builder.placementAnglesFromPoints(pts);
      if (undefined === result)
        return angles.yaw;
      result.setFrom(angles.yaw);
      return result;
    }

    /** Store local ranges for all subsequent geometry appended. Can improve performance of range testing for elements with a GeometryStream
     * containing more than one [[GeometryQuery]] differentiable by range. Not useful for a single [[GeometryQuery]] as its range and that of the [[GeometricElement]] are the same.
     * Ignored when defining a [[GeometryPart]] and not needed when only appending [[GeometryPart]] instances to a [[GeometricElement]] as these store their own range.
     */
    public appendGeometryRanges(): boolean {
      const entry = fromSubGraphicRange(Range3d.create()); // Computed on backend, just need opcode...
      if (undefined === entry)
        return false;
      this.entries.push(entry);
      return true;
    }

    /** Change [[GeometryParams]] for subsequent geometry.
     * It is not valid to change the sub-category when defining a [[GeometryPart]]. A [[GeometryPart]] inherits the symbology of their instance for anything not explicitly overridden.
     */
    public appendGeometryParamsChange(geomParams: GeometryParams): boolean {
      return appendGeometryParams(geomParams, this.entries, this._worldToLocal);
    }

    /** Append a [[GeometryQuery]] supplied in either local or world coordinates to the [[ElementGeometryDataEntry]] array */
    public appendGeometryQuery(geometry: GeometryQuery): boolean {
      const entry = ElementGeometry.fromGeometryQuery(geometry, this._worldToLocal);
      if (undefined === entry)
        return false;
      this.entries.push(entry);
      return true;
    }

    /** Append a [[TextString]] supplied in either local or world coordinates to the [[ElementGeometryDataEntry]] array */
    public appendTextString(text: TextString): boolean {
      const entry = ElementGeometry.fromTextString(text.toJSON(), this._worldToLocal);
      if (undefined === entry)
        return false;
      this.entries.push(entry);
      return true;
    }

    /** Append a [[ImageGraphic]] supplied in either local or world coordinates to the [[ElementGeometryDataEntry]] array */
    public appendImageGraphic(image: ImageGraphic): boolean {
      const entry = ElementGeometry.fromImageGraphic(image.toJSON(), this._worldToLocal);
      if (undefined === entry)
        return false;
      this.entries.push(entry);
      return true;
    }

    /** Append a [[BRepEntity.DataProps]] supplied in either local or world coordinates to the [[ElementGeometryDataEntry]] array.
     * Provided for compatibility with GeometryStreamBuilder only.
     * Backend code should use IModelDb.createBRepGeometry to create a brep [[ElementGeometryDataEntry]] directly.
     */
    public appendBRepData(brep: BRepEntity.DataProps): boolean {
      const entry = ElementGeometry.fromBRep(brep, this._worldToLocal);
      if (undefined === entry)
        return false;
      this.entries.push(entry);
      return true;
    }

    /** Append a [[GeometryPart]] instance with relative transform to the [[ElementGeometryDataEntry]] array for creating a [[GeometricElement]].
     * Not valid when defining a [[GeometryPart]] as nesting of parts is not supported.
     */
    public appendGeometryPart(partId: Id64String, partTransform?: Transform): boolean {
      const entry = ElementGeometry.fromGeometryPart(partId, partTransform, this._worldToLocal);
      if (undefined === entry)
        return false;
      this.entries.push(entry);
      return true;
    }

    /** Append a [[GeometryPart]] instance with relative position, orientation, and scale to the [[ElementGeometryDataEntry]] array for creating a [[GeometricElement3d]].
     * Not valid when defining a [[GeometryPart]] as nesting of parts is not supported.
     */
    public appendGeometryPart3d(partId: Id64String, instanceOrigin?: Point3d, instanceRotation?: YawPitchRollAngles, instanceScale?: number): boolean {
      const partTransform = Transform.createOriginAndMatrix(instanceOrigin, instanceRotation ? instanceRotation.toMatrix3d() : Matrix3d.createIdentity());
      if (undefined !== instanceScale)
        partTransform.matrix.scaleColumnsInPlace(instanceScale, instanceScale, instanceScale);
      return this.appendGeometryPart(partId, partTransform);
    }

    /** Append a [[GeometryPart]] instance with relative position, orientation, and scale to the [[ElementGeometryDataEntry]] array for creating a [[GeometricElement2d]].
     * Not valid when defining a [[GeometryPart]] as nesting of parts is not supported.
     */
    public appendGeometryPart2d(partId: Id64String, instanceOrigin?: Point2d, instanceRotation?: Angle, instanceScale?: number): boolean {
      return this.appendGeometryPart3d(partId, instanceOrigin ? Point3d.createFrom(instanceOrigin) : undefined, instanceRotation ? new YawPitchRollAngles(instanceRotation) : undefined, instanceScale);
    }
  }

  /** Current state information for [[ElementGeometry.Iterator]] */
  export interface IteratorData {
    /** A [[GeometryParams]] representing the appearance of the current geometric entry */
    readonly geomParams: GeometryParams;
    /** Placement transform, used for converting placement relative, local coordinate entries to world */
    readonly localToWorld?: Transform;
    /** Optional stored local range for the current geometric entry */
    readonly localRange?: Range3d;
    /** The current displayable opcode */
    readonly value: ElementGeometryDataEntry;
  }

  export class IteratorEntry implements IteratorData {
    public readonly geomParams: GeometryParams;
    public readonly localToWorld?: Transform;
    public localRange?: Range3d;
    private _value?: ElementGeometryDataEntry;
    private readonly _applyLocalToWorld: boolean;

    public constructor(geomParams: GeometryParams, localToWorld: Transform, applyLocalToWorld?: boolean) {
      this.geomParams = geomParams;
      this.localToWorld = localToWorld;
      this._applyLocalToWorld = applyLocalToWorld ? !localToWorld.isIdentity : false;
    }

    public get value() { return this._value!; }
    public set value(value: ElementGeometryDataEntry) { this._value = value; }

    public get outputTransform(): Transform | undefined {
      return this._applyLocalToWorld ? this.localToWorld : undefined;
    }

    /** Return the [[GeometryQuery]] representation for the current entry */
    public toGeometryQuery(): GeometryQuery | undefined {
      return toGeometryQuery(this.value, this.outputTransform);
    }

    /** Return the [[BRepEntity.DataProps]] representation for the current entry for checking brep type and face attachments. */
    public toBRepData(wantBRepData: boolean = false): BRepEntity.DataProps | undefined {
      return toBRep(this.value, wantBRepData, this.outputTransform);
    }

    /** Return the [[TextString]] representation for the current entry */
    public toTextString(): TextString | undefined {
      const props = toTextString(this.value, this.outputTransform);
      return (undefined !== props ? new TextString(props) : undefined);
    }

    /** Return the [[ImageGraphic]] representation for the current entry */
    public toImageGraphic(): ImageGraphic | undefined {
      const props = toImageGraphic(this.value, this.outputTransform);
      return (undefined !== props ? ImageGraphic.fromJSON(props) : undefined);
    }

    /** Return the GeometryPart information for the current entry */
    public toGeometryPart(partToLocal?: Transform, partToWorld?: Transform): Id64String | undefined {
      if (undefined === partToLocal && undefined !== partToWorld)
        partToLocal = Transform.createIdentity();

      const partId = toGeometryPart(this.value, partToLocal);
      if (undefined === partId || undefined === partToLocal || undefined === partToWorld)
        return partId;

      if (undefined !== this.localToWorld)
        this.localToWorld.multiplyTransformTransform(partToLocal, partToWorld);

      return partId;
    }
  }

  /** [[ElementGeometry.Iterator]] is a helper class for iterating a [[ElementGeometryDataEntry]] array.
   * Each [[ElementGeometryDataEntry]] returned by the iterator represents exactly one displayable entry.
   */
  export class Iterator implements IterableIterator<IteratorEntry> {
    /** GeometryStream entries */
    public readonly entryArray: ElementGeometryDataEntry[];
    /** The geometric element's placement or geometry part's local range (placement.bbox) */
    public readonly placement: Placement3d;
    /** If true, geometry displays oriented to face the camera */
    public readonly viewIndependent?: boolean;
    /** If true, geometry stream contained breps that were omitted or replaced as requested */
    public readonly brepsPresent?: boolean;
    /** Current entry position */
    private _index = 0;
    /** Allocated on first call to next() and reused thereafter */
    private _entry?: IteratorEntry;
    /** Used to initialize this._entry */
    private readonly _appearance: GeometryParams;
    private readonly _localToWorld: Transform;
    /** Whether deserialized entry data is returned in world or local coordinates */
    private _applyLocalToWorld = false;

    /** Construct a new Iterator given a [[ElementGeometryInfo]] from either a [[GeometricElement3d]], [[GeometricElement2d]], or [[GeometryPart]].
     * Supply the optional [[GeometryParams]] and localToWorld transform to iterate a [[GeometryPart]] in the context of a [[GeometricElement]] reference.
    */
    public constructor(info: ElementGeometryInfo, categoryOrGeometryParams?: Id64String | GeometryParams, localToWorld?: Transform) {
      this.entryArray = info.entryArray;
      this.viewIndependent = info.viewIndependent;
      this.brepsPresent = info.brepsPresent;

      if (undefined !== info.categoryId)
        categoryOrGeometryParams = info.categoryId;

      if (undefined !== categoryOrGeometryParams)
        this._appearance = typeof categoryOrGeometryParams === "string" ? new GeometryParams(categoryOrGeometryParams) : categoryOrGeometryParams;
      else
        this._appearance = new GeometryParams(Id64.invalid);

      if (undefined !== info.sourceToWorld)
        localToWorld = ElementGeometry.toTransform(info.sourceToWorld);

      if (undefined !== localToWorld)
        this._localToWorld = localToWorld;
      else
        this._localToWorld = Transform.createIdentity();

      const orgAng = YawPitchRollAngles.tryFromTransform(this._localToWorld);
      if (undefined === orgAng.angles)
        orgAng.angles = YawPitchRollAngles.createDegrees(0, 0, 0);

      let bbox = (undefined !== info.bbox ? ElementGeometry.toElementAlignedBox3d(info.bbox) : undefined);
      if (undefined === bbox)
        bbox = Range3d.createNull();

      this.placement = new Placement3d(orgAng.origin, orgAng.angles, bbox);
    }

    /** Call to return deserialized entry data in world coordinates */
    public requestWorldCoordinates(): void {
      this._applyLocalToWorld = !this._localToWorld.isIdentity;
    }

    // eslint-disable-next-line @typescript-eslint/naming-convention
    private get entry() {
      if (undefined === this._entry)
        this._entry = new IteratorEntry(this._appearance, this._localToWorld, this._applyLocalToWorld);

      return this._entry;
    }

    /** Advance to next displayable opcode (geometric entry or geometry part) while updating the current [[GeometryParams]] from appearance related opcodes. */
    public next(): IteratorResult<IteratorEntry> {
      while (this._index < this.entryArray.length) {
        const value = this.entryArray[this._index++];
        if (ElementGeometry.isAppearanceEntry(value)) {
          const localToWorld = (this._applyLocalToWorld ? this._localToWorld : undefined);
          ElementGeometry.updateGeometryParams(value, this.entry.geomParams, localToWorld);
        } else if (ElementGeometryOpcode.SubGraphicRange === value.opcode) {
          // NOTE: localRange remains valid until the next sub-range entry is encountered...
          this.entry.localRange = ElementGeometry.toSubGraphicRange(value);
        } else if (ElementGeometryOpcode.PartReference === value.opcode) {
          this.entry.value = value;
          return { value: this.entry, done: false };
        } else if (ElementGeometry.isGeometricEntry(value)) {
          this.entry.value = value;
          return { value: this.entry, done: false };
        }
      }

      return { value: this.entry, done: true };
    }

    public [Symbol.iterator](): IterableIterator<IteratorEntry> {
      return this;
    }
  }

  /** Return whether the supplied entry can be represented as a [[GeometryQuery]] */
  export function isGeometryQueryEntry(entry: ElementGeometryDataEntry): boolean {
    switch (entry.opcode) {
      case ElementGeometryOpcode.PointPrimitive:
      case ElementGeometryOpcode.PointPrimitive2d:
      case ElementGeometryOpcode.ArcPrimitive:
      case ElementGeometryOpcode.CurveCollection:
      case ElementGeometryOpcode.Polyface:
      case ElementGeometryOpcode.CurvePrimitive:
      case ElementGeometryOpcode.SolidPrimitive:
      case ElementGeometryOpcode.BsplineSurface:
        return true;

      default:
        return false;
    }
  }

  /** Return whether the supplied entry is displayable geometry [[GeometryQuery]], [[BRepEntity.DataProps]], [[TextString]], or [[ImageGraphic]] */
  export function isGeometricEntry(entry: ElementGeometryDataEntry): boolean {
    switch (entry.opcode) {
      case ElementGeometryOpcode.BRep:
      case ElementGeometryOpcode.TextString:
      case ElementGeometryOpcode.Image:
        return true;

      default:
        return isGeometryQueryEntry(entry);
    }
  }

  /** Return whether the supplied entry represents appearance information */
  export function isAppearanceEntry(entry: ElementGeometryDataEntry): boolean {
    switch (entry.opcode) {
      case ElementGeometryOpcode.BasicSymbology:
      case ElementGeometryOpcode.Fill:
      case ElementGeometryOpcode.Pattern:
      case ElementGeometryOpcode.Material:
      case ElementGeometryOpcode.LineStyleModifiers:
        return true;

      default:
        return false;
    }
  }

  /** Return entry as a [[GeometryQuery]] */
  export function toGeometryQuery(entry: ElementGeometryDataEntry, localToWorld?: Transform): GeometryQuery | undefined {
    if (!isGeometryQueryEntry(entry))
      return undefined;

    switch (entry.opcode) {
      case ElementGeometryOpcode.PointPrimitive: {
        const buffer = new flatbuffers.ByteBuffer(entry.data);
        const ppfb = EGFBAccessors.PointPrimitive.getRootAsPointPrimitive(buffer);

        const pts: Point3d[] = [];
        for (let i = 0; i < ppfb.coordsLength(); i++)
          pts.push(Point3d.create(ppfb.coords(i)!.x(), ppfb.coords(i)!.y(), ppfb.coords(i)!.z()));

        if (0 === pts.length)
          return undefined;

        if (undefined !== localToWorld)
          localToWorld.multiplyPoint3dArrayInPlace(pts);

        switch (ppfb.boundary()) {
          case EGFBAccessors.BoundaryType.Open:
            return LineString3d.createPoints(pts);
          case EGFBAccessors.BoundaryType.Closed:
            return Loop.createPolygon(pts);
          default:
            return PointString3d.createPoints(pts);
        }
      }

      case ElementGeometryOpcode.PointPrimitive2d: {
        const buffer = new flatbuffers.ByteBuffer(entry.data);
        const ppfb = EGFBAccessors.PointPrimitive2d.getRootAsPointPrimitive2d(buffer);

        const pts: Point3d[] = [];
        for (let i = 0; i < ppfb.coordsLength(); i++)
          pts.push(Point3d.create(ppfb.coords(i)!.x(), ppfb.coords(i)!.y()));

        if (0 === pts.length)
          return undefined;

        if (undefined !== localToWorld)
          localToWorld.multiplyPoint3dArrayInPlace(pts);

        switch (ppfb.boundary()) {
          case EGFBAccessors.BoundaryType.Open:
            return LineString3d.createPoints(pts);
          case EGFBAccessors.BoundaryType.Closed:
            return Loop.createPolygon(pts);
          default:
            return PointString3d.createPoints(pts);
        }
      }

      case ElementGeometryOpcode.ArcPrimitive: {
        const buffer = new flatbuffers.ByteBuffer(entry.data);
        const ppfb = EGFBAccessors.ArcPrimitive.getRootAsArcPrimitive(buffer);

        const center = Point3d.create(ppfb.center()!.x(), ppfb.center()!.y(), ppfb.center()!.z());
        const vector0 = Vector3d.create(ppfb.vector0()!.x(), ppfb.vector0()!.y(), ppfb.vector0()!.z());
        const vector90 = Vector3d.create(ppfb.vector90()!.x(), ppfb.vector90()!.y(), ppfb.vector90()!.z());
        const arc = Arc3d.create(center, vector0, vector90, AngleSweep.createStartSweepRadians(ppfb.start(), ppfb.sweep()));

        if (undefined !== localToWorld && !arc.tryTransformInPlace(localToWorld))
          return undefined;

        return (EGFBAccessors.BoundaryType.Closed === ppfb.boundary() ? Loop.create(arc) : arc);
      }

      case ElementGeometryOpcode.CurvePrimitive:
      case ElementGeometryOpcode.CurveCollection:
      case ElementGeometryOpcode.SolidPrimitive:
      case ElementGeometryOpcode.BsplineSurface:
      case ElementGeometryOpcode.Polyface:
        const geom = BentleyGeometryFlatBuffer.bytesToGeometry(entry.data, true);
        if (undefined === geom || Array.isArray(geom))
          return undefined; // Should always be a single entry not an array...
        if (undefined !== localToWorld && !geom.tryTransformInPlace(localToWorld))
          return undefined;
        return geom;

      default:
        return undefined; // Not a GeometryQuery, need to be handled explicitly...
    }
  }

  /** Create entry from a [[GeometryQuery]] */
  export function fromGeometryQuery(geom: GeometryQuery, worldToLocal?: Transform): ElementGeometryDataEntry | undefined {
    let opcode;
    switch (geom.geometryCategory) {
      case "bsurf":
        opcode = ElementGeometryOpcode.BsplineSurface;
        break;
      case "curveCollection":
        opcode = ElementGeometryOpcode.CurveCollection;
        break;
      case "curvePrimitive":
      case "pointCollection":
        opcode = ElementGeometryOpcode.CurvePrimitive;
        break;
      case "polyface":
        opcode = ElementGeometryOpcode.Polyface;
        break;
      case "solid":
        opcode = ElementGeometryOpcode.SolidPrimitive;
        break;
      default:
        return undefined;
    }

    if (undefined !== worldToLocal) {
      const localGeom = geom.cloneTransformed(worldToLocal);
      if (undefined === localGeom)
        return undefined;
      geom = localGeom;
    }

    const data = BentleyGeometryFlatBuffer.geometryToBytes(geom, true);
    if (undefined === data)
      return undefined;

    return { opcode, data };
  }

  /** Return entry as a [[TextString]] */
  export function toTextString(entry: ElementGeometryDataEntry, localToWorld?: Transform): TextStringProps | undefined {
    if (ElementGeometryOpcode.TextString !== entry.opcode)
      return undefined;

    const buffer = new flatbuffers.ByteBuffer(entry.data);
    const ppfb = EGFBAccessors.TextString.getRootAsTextString(buffer);

    const style = ppfb.style();
    if (null === style)
      return undefined;

    const text = ppfb.text();
    const props: TextStringProps = { text: (null !== text ? text : ""), font: style.fontId(), height: style.height() };

    props.widthFactor = style.widthFactor();
    props.bold = style.isBold();
    props.italic = style.isItalic();
    props.underline = style.isUnderlined();

    const transform = ppfb.transform();
    if (null !== transform) {
      props.origin = Point3d.create(transform.form3d03(), transform.form3d13(), transform.form3d23());
      props.rotation = YawPitchRollAngles.createFromMatrix3d(Matrix3d.createRowValues(transform.form3d00(), transform.form3d01(), transform.form3d02(), transform.form3d10(), transform.form3d11(), transform.form3d12(), transform.form3d20(), transform.form3d21(), transform.form3d22()));
    }

    if (undefined === localToWorld)
      return props;

    const textString = new TextString(props);
    if (!textString.transformInPlace(localToWorld))
      return undefined;

    return textString.toJSON();
  }

  /** Create entry from a [[TextString]] */
  export function fromTextString(text: TextStringProps, worldToLocal?: Transform): ElementGeometryDataEntry | undefined {
    if (undefined !== worldToLocal) {
      const localText = new TextString(text);
      if (!localText.transformInPlace(worldToLocal))
        return undefined;
      text = localText.toJSON();
    }

    const fbb = new flatbuffers.Builder();
    const builder = EGFBAccessors.TextString;

    const textOffset = fbb.createString(text.text);
    const styleOffset = EGFBAccessors.TextStringStyle.createTextStringStyle(fbb, 1, 0, text.font, undefined === text.bold ? false : text.bold, undefined === text.italic ? false : text.italic, undefined === text.underline ? false : text.underline, text.height, undefined === text.widthFactor ? 1.0 : text.widthFactor);

    builder.startTextString(fbb);

    builder.addMajorVersion(fbb, 1);
    builder.addMinorVersion(fbb, 0);

    builder.addText(fbb, textOffset);
    builder.addStyle(fbb, styleOffset);

    if (undefined !== text.origin || undefined !== text.rotation) {
      const origin = Point3d.fromJSON(text.origin);
      const angles = YawPitchRollAngles.fromJSON(text.rotation);
      const matrix = angles.toMatrix3d();
      const coffs = matrix.coffs;
      const transformOffset = EGFBAccessors.TextStringTransform.createTextStringTransform(fbb, coffs[0], coffs[1], coffs[2], origin.x, coffs[3], coffs[4], coffs[5], origin.y, coffs[6], coffs[7], coffs[8], origin.z);
      builder.addTransform(fbb, transformOffset);
    }

    const mLoc = builder.endTextString(fbb);
    fbb.finish(mLoc);
    const data = fbb.asUint8Array();

    return { opcode: ElementGeometryOpcode.TextString, data };
  }

  /** Return entry as a [[ImageGraphic]] */
  export function toImageGraphic(entry: ElementGeometryDataEntry, localToWorld?: Transform): ImageGraphicProps | undefined {
    if (ElementGeometryOpcode.Image !== entry.opcode)
      return undefined;

    const buffer = new flatbuffers.ByteBuffer(entry.data);
    const ppfb = EGFBAccessors.Image.getRootAsImage(buffer);

    const textureLong = ppfb.textureId();
    const textureId = Id64.fromUint32Pair(textureLong.low, textureLong.high);
    const hasBorder = (1 === ppfb.drawBorder());

    const corners = new ImageGraphicCorners(Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero());
    const corner0 = ppfb.tileCorner0();
    const corner1 = ppfb.tileCorner1();
    const corner2 = ppfb.tileCorner2();
    const corner3 = ppfb.tileCorner3();

    if (null !== corner0)
      corners[0].setFrom(Point3d.create(corner0.x(), corner0.y(), corner0.z()));
    if (null !== corner1)
      corners[1].setFrom(Point3d.create(corner1.x(), corner1.y(), corner1.z()));
    if (null !== corner2)
      corners[2].setFrom(Point3d.create(corner2.x(), corner2.y(), corner2.z()));
    if (null !== corner3)
      corners[3].setFrom(Point3d.create(corner3.x(), corner3.y(), corner3.z()));

    if (undefined !== localToWorld) {
      localToWorld.multiplyXYAndZInPlace(corners[0]);
      localToWorld.multiplyXYAndZInPlace(corners[1]);
      localToWorld.multiplyXYAndZInPlace(corners[2]);
      localToWorld.multiplyXYAndZInPlace(corners[3]);
    }

    return { corners: corners.toJSON(), textureId, hasBorder };
  }

  /** Create entry from a [[ImageGraphic]] */
  export function fromImageGraphic(image: ImageGraphicProps, worldToLocal?: Transform): ElementGeometryDataEntry | undefined {
    if (undefined !== worldToLocal) {
      const localImage = ImageGraphic.fromJSON(image).cloneTransformed(worldToLocal);
      image = localImage.toJSON();
    }

    const fbb = new flatbuffers.Builder();
    const builder = EGFBAccessors.Image;
    builder.startImage(fbb);

    const textudeIdPair = Id64.getUint32Pair(image.textureId);
    builder.addTextureId(fbb, flatbuffers.Long.create(textudeIdPair.lower, textudeIdPair.upper));
    builder.addDrawBorder(fbb, image.hasBorder ? 1 : 0);

    const corners = ImageGraphicCorners.fromJSON(image.corners);
    const cornerOffset0 = EGFBAccessors.DPoint3d.createDPoint3d(fbb, corners[0].x, corners[0].y, corners[0].z);
    builder.addTileCorner0(fbb, cornerOffset0);
    const cornerOffset1 = EGFBAccessors.DPoint3d.createDPoint3d(fbb, corners[1].x, corners[1].y, corners[1].z);
    builder.addTileCorner1(fbb, cornerOffset1);
    const cornerOffset2 = EGFBAccessors.DPoint3d.createDPoint3d(fbb, corners[2].x, corners[2].y, corners[2].z);
    builder.addTileCorner2(fbb, cornerOffset2);
    const cornerOffset3 = EGFBAccessors.DPoint3d.createDPoint3d(fbb, corners[3].x, corners[3].y, corners[3].z);
    builder.addTileCorner3(fbb, cornerOffset3);

    const mLoc = builder.endImage(fbb);
    fbb.finish(mLoc);
    const data = fbb.asUint8Array();

    return { opcode: ElementGeometryOpcode.Image, data };
  }

  /** Return entry as a [[BRepEntity.DataProps]] for checking brep type and face attachments. */
  export function toBRep(entry: ElementGeometryDataEntry, wantBRepData: boolean = false, localToWorld?: Transform): BRepEntity.DataProps | undefined {
    if (ElementGeometryOpcode.BRep !== entry.opcode)
      return undefined;

    const buffer = new flatbuffers.ByteBuffer(entry.data);
    const ppfb = EGFBAccessors.BRepData.getRootAsBRepData(buffer);

    const toBRepType = (typeFb: EGFBAccessors.BRepType) => {
      switch (typeFb) {
        case EGFBAccessors.BRepType.Wire:
          return BRepEntity.Type.Wire;
        case EGFBAccessors.BRepType.Sheet:
          return BRepEntity.Type.Sheet;
        default:
          return BRepEntity.Type.Solid;
      }
    };

    const type = toBRepType(ppfb.brepType());

    let transform;
    const entityTransform = ppfb.entityTransform();
    if (null !== entityTransform)
      transform = Transform.createRowValues(entityTransform.x00(), entityTransform.x01(), entityTransform.x02(), entityTransform.tx(), entityTransform.x10(), entityTransform.x11(), entityTransform.x12(), entityTransform.ty(), entityTransform.x20(), entityTransform.x21(), entityTransform.x22(), entityTransform.tz());

    if (undefined !== localToWorld) {
      if (undefined !== transform)
        transform.multiplyTransformTransform(localToWorld, transform);
      else
        transform = localToWorld;
    }

    const faceSymbLen = ppfb.symbologyLength();
    let faceSymbology;
    if (0 !== faceSymbLen) {
      const faceSymbPropsArray: BRepEntity.FaceSymbologyProps[] = [];
      for (let index = 0; index < faceSymbLen; ++index) {
        const faceSymbFb = ppfb.symbology(index);
        const faceSymbProps: BRepEntity.FaceSymbologyProps = {};
        if (null !== faceSymbFb) {
          if (1 === faceSymbFb.useColor())
            faceSymbProps.color = faceSymbFb.color();
          if (1 === faceSymbFb.useMaterial())
            faceSymbProps.materialId = Id64.fromUint32Pair(faceSymbFb.materialId().low, faceSymbFb.materialId().high);
          faceSymbProps.transparency = faceSymbFb.transparency();
        }
        faceSymbPropsArray.push(faceSymbProps);
      }
      faceSymbology = faceSymbPropsArray;
    }

    let data;
    const entityData = ppfb.entityDataArray();
    if (wantBRepData && null !== entityData)
      data = Base64EncodedString.fromUint8Array(entityData);

    return { data, type, transform: transform?.toJSON(), faceSymbology };
  }

  /** Create entry from a [[BRepEntity.DataProps]]. Provided for compatibility with GeometryStreamBuilder only. */
  export function fromBRep(brep: BRepEntity.DataProps, worldToLocal?: Transform): ElementGeometryDataEntry | undefined {
    if (undefined !== worldToLocal) {
      const entityTrans = Transform.fromJSON(brep.transform);
      const localTrans = entityTrans.multiplyTransformTransform(worldToLocal);
      brep = {
        data: brep.data,
        type: brep.type,
        transform: localTrans.isIdentity ? undefined : localTrans.toJSON(),
        faceSymbology: brep.faceSymbology,
      };
    }

    const fbb = new flatbuffers.Builder();
    const builder = EGFBAccessors.BRepData;
    let dataOffset;
    let faceSymbOffset;

    if (undefined !== brep.data) {
      const entityData = Base64EncodedString.toUint8Array(brep.data);
      if (entityData.length === 0)
        return undefined;

      dataOffset = builder.createEntityDataVector(fbb, entityData);
    }

    if (undefined !== brep.faceSymbology) {
      builder.startSymbologyVector(fbb, brep.faceSymbology.length);
      for (let i = brep.faceSymbology.length - 1; i >= 0; i--) {
        const symb = brep.faceSymbology[i];
        const materialIdPair = Id64.getUint32Pair(symb.materialId ? symb.materialId : Id64.invalid);
        const matLong = flatbuffers.Long.create(materialIdPair.lower, materialIdPair.upper);
        EGFBAccessors.FaceSymbology.createFaceSymbology(fbb, symb.color ? 1 : 0, symb.materialId ? 1 : 0, symb.color ? symb.color : 0, matLong, symb.transparency ? symb.transparency : 0, 0, 0);
      }
      faceSymbOffset = fbb.endVector();
    }

    builder.startBRepData(fbb);

    const toEGFBBRepType = (type: BRepEntity.Type) => {
      switch (type) {
        case BRepEntity.Type.Wire:
          return EGFBAccessors.BRepType.Wire;
        case BRepEntity.Type.Sheet:
          return EGFBAccessors.BRepType.Sheet;
        default:
          return EGFBAccessors.BRepType.Solid;
      }
    };

    if (undefined !== brep.type)
      builder.addBrepType(fbb, toEGFBBRepType(brep.type));

    if (undefined !== brep.transform) {
      const transform = Transform.fromJSON(brep.transform);
      const transformOffset = EGFBAccessors.Transform.createTransform(fbb, transform.matrix.coffs[0], transform.matrix.coffs[1], transform.matrix.coffs[2], transform.origin.x, transform.matrix.coffs[3], transform.matrix.coffs[4], transform.matrix.coffs[5], transform.origin.y, transform.matrix.coffs[6], transform.matrix.coffs[7], transform.matrix.coffs[8], transform.origin.z);
      builder.addEntityTransform(fbb, transformOffset);
    }

    if (undefined !== dataOffset)
      builder.addEntityData(fbb, dataOffset);

    if (undefined !== faceSymbOffset)
      builder.addSymbology(fbb, faceSymbOffset);

    const mLoc = builder.endBRepData(fbb);
    fbb.finish(mLoc);
    const data = fbb.asUint8Array();

    return { opcode: ElementGeometryOpcode.BRep, data };
  }

  /** Apply transform directly to ElementGeometryDataEntry for a BRep */
  export function transformBRep(entry: ElementGeometryDataEntry, inputTransform: Transform): boolean {
    if (ElementGeometryOpcode.BRep !== entry.opcode)
      return false;

    const buffer = new flatbuffers.ByteBuffer(entry.data);
    const ppfb = EGFBAccessors.BRepData.getRootAsBRepData(buffer);

    const fbb = new flatbuffers.Builder();
    const builder = EGFBAccessors.BRepData;

    const entityData = ppfb.entityDataArray();
    const dataOffset = (null !== entityData ? builder.createEntityDataVector(fbb, entityData) : undefined);

    let faceSymbOffset;
    const faceSymbLen = ppfb.symbologyLength();
    if (0 !== faceSymbLen) {
      builder.startSymbologyVector(fbb, faceSymbLen);
      for (let i = faceSymbLen - 1; i >= 0; i--) {
        const faceSymbFb = ppfb.symbology(i);
        if (null === faceSymbFb)
          continue;
        EGFBAccessors.FaceSymbology.createFaceSymbology(fbb, faceSymbFb.useColor(), faceSymbFb.useMaterial(), faceSymbFb.color(), faceSymbFb.materialId(), faceSymbFb.transparency(), 0, 0);
      }
      faceSymbOffset = fbb.endVector();
    }

    builder.startBRepData(fbb);
    builder.addBrepType(fbb, ppfb.brepType());

    let transform;
    const entityTransform = ppfb.entityTransform();
    if (null !== entityTransform)
      transform = Transform.createRowValues(entityTransform.x00(), entityTransform.x01(), entityTransform.x02(), entityTransform.tx(), entityTransform.x10(), entityTransform.x11(), entityTransform.x12(), entityTransform.ty(), entityTransform.x20(), entityTransform.x21(), entityTransform.x22(), entityTransform.tz());

    if (undefined !== transform)
      transform.multiplyTransformTransform(inputTransform, transform);
    else
      transform = inputTransform;

    const transformOffset = EGFBAccessors.Transform.createTransform(fbb, transform.matrix.coffs[0], transform.matrix.coffs[1], transform.matrix.coffs[2], transform.origin.x, transform.matrix.coffs[3], transform.matrix.coffs[4], transform.matrix.coffs[5], transform.origin.y, transform.matrix.coffs[6], transform.matrix.coffs[7], transform.matrix.coffs[8], transform.origin.z);
    builder.addEntityTransform(fbb, transformOffset);

    if (undefined !== dataOffset)
      builder.addEntityData(fbb, dataOffset);

    if (undefined !== faceSymbOffset)
      builder.addSymbology(fbb, faceSymbOffset);

    const mLoc = builder.endBRepData(fbb);
    fbb.finish(mLoc);
    entry.data = fbb.asUint8Array();

    return true;
  }

  /** @internal */
  enum StyleMod {
    Scale = 0x01,
    DashScale = 0x02,
    GapScale = 0x04,
    StartWidth = 0x08,
    EndWidth = 0x10,
    DistPhase = 0x20,
    FractPhase = 0x40,
    CenterPhase = 0x80,
    Normal = 0x0100,
    Rotation = 0x0200,
    PhysicalWidth = 0x02000,
    SegMode = 0x40000000,
    NoSegMode = 0x80000000,
  }

  /** Update the supplied [[GeometryParams]] from an entry with appearance information */
  export function updateGeometryParams(entry: ElementGeometryDataEntry, geomParams: GeometryParams, localToWorld?: Transform): boolean {
    if (!isAppearanceEntry(entry))
      return false;

    let changed = false;

    switch (entry.opcode) {
      case ElementGeometryOpcode.BasicSymbology: {
        const buffer = new flatbuffers.ByteBuffer(entry.data);
        const ppfb = EGFBAccessors.BasicSymbology.getRootAsBasicSymbology(buffer);

        const subcatLong = ppfb.subCategoryId();
        let subcatId = Id64.fromUint32Pair(subcatLong.low, subcatLong.high);

        if (Id64.isInvalid(subcatId))
          subcatId = geomParams.subCategoryId; // Preserve current sub-category if not explicitly stored...

        if (Id64.isValid(subcatId)) {
          geomParams.setSubCategoryId(subcatId); // Reset to sub-category appearance...
          changed = true;
        }

        if (ppfb.useColor()) {
          const lineColor = ColorDef.fromTbgr(ppfb.color());
          if (undefined === geomParams.lineColor || !lineColor.equals(geomParams.lineColor)) {
            geomParams.lineColor = lineColor;
            changed = true;
          }
        }

        if (ppfb.useWeight()) {
          const weight = ppfb.weight();
          if (undefined === geomParams.weight || weight !== geomParams.weight) {
            geomParams.weight = weight;
            changed = true;
          }
        }

        if (ppfb.useStyle()) {
          const styleLong = ppfb.lineStyleId();
          const styleId = Id64.fromUint32Pair(styleLong.low, styleLong.high);
          if (undefined === geomParams.styleInfo || styleId !== geomParams.styleInfo.styleId) {
            geomParams.styleInfo = new LineStyle.Info(styleId);
            changed = true;
          }
        }

        const transparency = ppfb.transparency();
        if (transparency !== (undefined !== geomParams.elmTransparency ? geomParams.elmTransparency : 0)) {
          geomParams.elmTransparency = transparency;
          changed = true;
        }

        const displayPriority = ppfb.displayPriority();
        if (displayPriority !== (undefined !== geomParams.elmPriority ? geomParams.elmPriority : 0)) {
          geomParams.elmPriority = displayPriority;
          changed = true;
        }

        const geometryClass = ppfb.geomClass();
        if (geometryClass !== (undefined !== geomParams.geometryClass ? geomParams.geometryClass : GeometryClass.Primary)) {
          geomParams.geometryClass = geometryClass;
          changed = true;
        }

        return changed;
      }

      case ElementGeometryOpcode.LineStyleModifiers: {
        const buffer = new flatbuffers.ByteBuffer(entry.data);
        const ppfb = EGFBAccessors.LineStyleModifiers.getRootAsLineStyleModifiers(buffer);
        const props: LineStyle.ModifierProps = {};

        if (0 !== (ppfb.modifiers() & StyleMod.Scale))
          props.scale = ppfb.scale();

        if (0 !== (ppfb.modifiers() & StyleMod.GapScale))
          props.gapScale = ppfb.gapScale();

        if (0 !== (ppfb.modifiers() & StyleMod.DashScale))
          props.dashScale = ppfb.dashScale();

        if (0 !== (ppfb.modifiers() & StyleMod.StartWidth))
          props.startWidth = ppfb.startWidth();

        if (0 !== (ppfb.modifiers() & StyleMod.EndWidth))
          props.endWidth = ppfb.endWidth();

        if (0 !== (ppfb.modifiers() & StyleMod.DistPhase))
          props.distPhase = ppfb.distPhase();

        if (0 !== (ppfb.modifiers() & StyleMod.FractPhase))
          props.fractPhase = ppfb.fractPhase();

        if (0 !== (ppfb.modifiers() & StyleMod.CenterPhase))
          props.centerPhase = true;

        if (0 !== (ppfb.modifiers() & StyleMod.SegMode))
          props.segmentMode = true;
        else if (0 !== (ppfb.modifiers() & StyleMod.NoSegMode))
          props.segmentMode = false;

        if (0 !== (ppfb.modifiers() & StyleMod.PhysicalWidth))
          props.physicalWidth = true;

        if (0 !== (ppfb.modifiers() & StyleMod.Normal)) {
          const normal = ppfb.normal();
          if (null !== normal)
            props.normal = Vector3d.create(normal.x(), normal.y(), normal.z());
        }

        if (0 !== (ppfb.modifiers() & StyleMod.Rotation))
          props.rotation = YawPitchRollAngles.createDegrees(ppfb.yaw(), ppfb.pitch(), ppfb.roll());

        const styleMod = new LineStyle.Modifier(props);
        if (undefined !== localToWorld)
          styleMod.applyTransform(localToWorld);

        if (undefined === geomParams.styleInfo) {
          geomParams.styleInfo = new LineStyle.Info(Id64.invalid, styleMod);
          changed = true;
        } else if (undefined === geomParams.styleInfo.styleMod || !styleMod.equals(geomParams.styleInfo.styleMod)) {
          geomParams.styleInfo.styleMod = styleMod;
          changed = true;
        }

        return changed;
      }

      case ElementGeometryOpcode.Fill: {
        const buffer = new flatbuffers.ByteBuffer(entry.data);
        const ppfb = EGFBAccessors.AreaFill.getRootAsAreaFill(buffer);

        const toFillDisplay = (fill: EGFBAccessors.FillDisplay) => {
          switch (fill) {
            case EGFBAccessors.FillDisplay.ByView:
              return FillDisplay.ByView;
            case EGFBAccessors.FillDisplay.Always:
              return FillDisplay.Always;
            case EGFBAccessors.FillDisplay.Blanking:
              return FillDisplay.Blanking;
            default:
              return FillDisplay.Never;
          }
        };

        const fillDisplay = toFillDisplay(ppfb.fill());
        if (fillDisplay !== (undefined !== geomParams.fillDisplay ? geomParams.fillDisplay : FillDisplay.Never)) {
          geomParams.fillDisplay = fillDisplay;
          changed = true;
        }

        if (FillDisplay.Never === fillDisplay)
          return changed;

        const transparency = ppfb.transparency();
        if (transparency !== (undefined !== geomParams.fillTransparency ? geomParams.fillTransparency : 0)) {
          geomParams.fillTransparency = transparency;
          changed = true;
        }

        if (EGFBAccessors.GradientMode.None !== ppfb.mode()) {
          const toGradientMode = (mode: EGFBAccessors.GradientMode) => {
            switch (mode) {
              case EGFBAccessors.GradientMode.Linear:
                return Gradient.Mode.Linear;
              case EGFBAccessors.GradientMode.Curved:
                return Gradient.Mode.Curved;
              case EGFBAccessors.GradientMode.Cylindrical:
                return Gradient.Mode.Cylindrical;
              case EGFBAccessors.GradientMode.Spherical:
                return Gradient.Mode.Spherical;
              case EGFBAccessors.GradientMode.Hemispherical:
                return Gradient.Mode.Hemispherical;
              case EGFBAccessors.GradientMode.Thematic:
                return Gradient.Mode.Thematic;
              default:
                return Gradient.Mode.None;
            }
          };

          const keys: Gradient.KeyColorProps[] = [];
          const colors = ppfb.colorsArray();
          const values = ppfb.valuesArray();
          if (null !== colors && null !== values && colors.length === values.length) {
            for (let iKey = 0; iKey < colors.length; ++iKey)
              keys.push({ value: values[iKey], color: colors[iKey] });
          }

          const props: Gradient.SymbProps = { mode: toGradientMode(ppfb.mode()), keys };

          const flags = ppfb.flags();
          const angle = ppfb.angle();
          const tint = ppfb.tint();
          const shift = ppfb.shift();

          props.flags = (0 !== flags ? flags : undefined);
          props.angle = (0 !== angle ? { radians: angle } : undefined);
          props.tint = (0 !== tint ? tint : undefined);
          props.shift = (0 !== shift ? shift : undefined);

          if (Gradient.Mode.Thematic === props.mode) {
            const thematic = ppfb.thematicSettings();

            if (null !== thematic) {
              const tprops: ThematicGradientSettingsProps = {};

              const mode = thematic.mode();
              const stepCount = thematic.stepCount();
              const marginColor = thematic.marginColor();
              const colorScheme = thematic.colorScheme();

              tprops.mode = (0 !== mode ? mode : undefined);
              tprops.stepCount = (0 !== stepCount ? stepCount : undefined);
              tprops.marginColor = (0 !== marginColor ? marginColor : undefined);
              tprops.colorScheme = (0 !== colorScheme ? colorScheme : undefined);

              props.thematicSettings = tprops;
            }
          }

          const gradient = Gradient.Symb.fromJSON(props);
          if (undefined === geomParams.gradient || !gradient.equals(geomParams.gradient)) {
            geomParams.gradient = gradient;
            changed = true;
          }
        } else if (0 !== ppfb.backgroundFill()) {
          const backgroundFill = (2 === ppfb.backgroundFill() ? BackgroundFill.Outline : BackgroundFill.Solid);
          if (backgroundFill !== geomParams.backgroundFill) {
            geomParams.backgroundFill = backgroundFill;
            changed = true;
          }
        } else if (ppfb.useColor()) {
          const fillColor = ColorDef.fromTbgr(ppfb.color());
          if (undefined === geomParams.fillColor || !fillColor.equals(geomParams.fillColor)) {
            geomParams.fillColor = fillColor;
            changed = true;
          }
        }

        return changed;
      }

      case ElementGeometryOpcode.Pattern: {
        const buffer = new flatbuffers.ByteBuffer(entry.data);
        const ppfb = EGFBAccessors.AreaPattern.getRootAsAreaPattern(buffer);
        const props: AreaPattern.ParamsProps = {};

        const origin = ppfb.origin();
        if (null !== origin) {
          const point = Point3d.create(origin.x(), origin.y(), origin.z());
          if (!point.isAlmostZero)
            props.origin = point;
        }

        const rotation = ppfb.rotation();
        if (null !== rotation) {
          const angles = YawPitchRollAngles.createFromMatrix3d(Matrix3d.createRowValues(
            rotation.x00(), rotation.x01(), rotation.x02(),
            rotation.x10(), rotation.x11(), rotation.x12(),
            rotation.x20(), rotation.x21(), rotation.x22())
          );
          if (undefined !== angles && !angles.isIdentity())
            props.rotation = angles;
        }

        const space1 = ppfb.space1();
        const space2 = ppfb.space2();
        const angle1 = ppfb.angle1();
        const angle2 = ppfb.angle2();
        const scale = ppfb.scale();

        props.space1 = (0 !== space1 ? space1 : undefined);
        props.space2 = (0 !== space2 ? space2 : undefined);
        props.angle1 = (0 !== angle1 ? { radians: angle1 } : undefined);
        props.angle2 = (0 !== angle2 ? { radians: angle2 } : undefined);
        props.scale = (0 !== scale ? scale : undefined);

        if (ppfb.useColor())
          props.color = ppfb.color();

        if (ppfb.useWeight())
          props.weight = ppfb.weight();

        props.invisibleBoundary = (1 === ppfb.invisibleBoundary() ? true : undefined);
        props.snappable = (1 === ppfb.snappable() ? true : undefined);

        const symbolId = Id64.fromUint32Pair(ppfb.symbolId().low, ppfb.symbolId().high);
        props.symbolId = (Id64.isValid(symbolId) ? symbolId : undefined);

        const nDefLines = ppfb.defLineLength();
        if (0 !== nDefLines) {
          const defLines: AreaPattern.HatchDefLineProps[] = [];

          for (let iLine = 0; iLine < nDefLines; ++iLine) {
            const defLine = ppfb.defLine(iLine);
            if (!defLine)
              continue;

            const line: AreaPattern.HatchDefLineProps = {};

            const angle = defLine.angle();
            line.angle = (0 !== angle ? { radians: defLine.angle() } : undefined);

            const through = defLine.through();
            if (through) {
              const thr = Point2d.create(through.x(), through.y());
              if (!thr.isAlmostZero)
                line.through = thr;
            }

            const offset = defLine.offset();
            if (offset) {
              const off = Point2d.create(offset.x(), offset.y());
              if (!off.isAlmostZero)
                line.offset = off;
            }

            const dashArray = defLine.dashesArray();
            if (0 !== defLine.dashesLength() && null !== dashArray) {
              const dashes: number[] = [];
              for (const value of dashArray) {
                dashes.push(value);
              }
              line.dashes = dashes;
            }

            defLines.push(line);
          }

          props.defLines = defLines;
        }

        const pattern = AreaPattern.Params.fromJSON(props);
        if (undefined !== localToWorld)
          pattern.applyTransform(localToWorld);

        if (undefined === geomParams.pattern || !pattern.equals(geomParams.pattern)) {
          geomParams.pattern = pattern;
          changed = true;
        }

        return changed;
      }

      case ElementGeometryOpcode.Material: {
        const buffer = new flatbuffers.ByteBuffer(entry.data);
        const ppfb = EGFBAccessors.Material.getRootAsMaterial(buffer);

        if (ppfb.useMaterial()) {
          const matLong = ppfb.materialId();
          const materialId = Id64.fromUint32Pair(matLong.low, matLong.high);
          if (undefined === geomParams.materialId || materialId !== geomParams.materialId) {
            geomParams.materialId = materialId;
            changed = true;
          }
        }

        return changed;
      }

      default:
        return changed;
    }
  }

  /** Append entries to represent a [[GeometryParams]] */
  export function appendGeometryParams(geomParams: GeometryParams, entries: ElementGeometryDataEntry[], worldToLocal?: Transform): boolean {
    const fbbBas = new flatbuffers.Builder();
    const builder = EGFBAccessors.BasicSymbology;
    builder.startBasicSymbology(fbbBas);

    const subcatIdPair = Id64.getUint32Pair(geomParams.subCategoryId);
    builder.addSubCategoryId(fbbBas, flatbuffers.Long.create(subcatIdPair.lower, subcatIdPair.upper));

    if (undefined !== geomParams.lineColor) {
      builder.addColor(fbbBas, geomParams.lineColor.tbgr);
      builder.addUseColor(fbbBas, 1);
    }

    if (undefined !== geomParams.weight) {
      builder.addWeight(fbbBas, geomParams.weight);
      builder.addUseWeight(fbbBas, 1);
    }

    if (undefined !== geomParams.styleInfo) {
      const styleIdPair = Id64.getUint32Pair(geomParams.styleInfo.styleId);
      builder.addLineStyleId(fbbBas, flatbuffers.Long.create(styleIdPair.lower, styleIdPair.upper));
      builder.addUseStyle(fbbBas, 1);
    }

    if (undefined !== geomParams.elmTransparency && 0 !== geomParams.elmTransparency) {
      builder.addTransparency(fbbBas, geomParams.elmTransparency);
    }

    if (undefined !== geomParams.elmPriority && 0 !== geomParams.elmPriority) {
      builder.addDisplayPriority(fbbBas, geomParams.elmPriority);
    }

    if (undefined !== geomParams.geometryClass && GeometryClass.Primary !== geomParams.geometryClass) {
      builder.addGeomClass(fbbBas, geomParams.geometryClass);
    }

    const mLoc = builder.endBasicSymbology(fbbBas);
    fbbBas.finish(mLoc);
    const data = fbbBas.asUint8Array();

    entries.push({ opcode: ElementGeometryOpcode.BasicSymbology, data });

    if (undefined !== geomParams.styleInfo && undefined !== geomParams.styleInfo.styleMod) {
      const fbbLS = new flatbuffers.Builder();
      const builderLS = EGFBAccessors.LineStyleModifiers;
      builderLS.startLineStyleModifiers(fbbLS);

      let lsMods = geomParams.styleInfo.styleMod;
      if (undefined !== worldToLocal) {
        lsMods = new LineStyle.Modifier(lsMods);
        if (!lsMods.applyTransform(worldToLocal))
          return false;
      }

      let modifiers = 0;

      if (undefined !== lsMods.scale) {
        builderLS.addScale(fbbLS, lsMods.scale);
        modifiers |= StyleMod.Scale;
      }

      if (undefined !== lsMods.dashScale) {
        builderLS.addDashScale(fbbLS, lsMods.dashScale);
        modifiers |= StyleMod.DashScale;
      }

      if (undefined !== lsMods.gapScale) {
        builderLS.addGapScale(fbbLS, lsMods.gapScale);
        modifiers |= StyleMod.GapScale;
      }

      if (undefined !== lsMods.startWidth) {
        builderLS.addStartWidth(fbbLS, lsMods.startWidth);
        modifiers |= StyleMod.StartWidth;
      }

      if (undefined !== lsMods.endWidth) {
        builderLS.addEndWidth(fbbLS, lsMods.endWidth);
        modifiers |= StyleMod.EndWidth;
      }

      if (undefined !== lsMods.distPhase) {
        builderLS.addDistPhase(fbbLS, lsMods.distPhase);
        modifiers |= StyleMod.DistPhase;
      }

      if (undefined !== lsMods.fractPhase) {
        builderLS.addFractPhase(fbbLS, lsMods.fractPhase);
        modifiers |= StyleMod.FractPhase;
      }

      if (lsMods.centerPhase) {
        modifiers |= StyleMod.CenterPhase;
      }

      if (undefined !== lsMods.segmentMode) {
        modifiers |= (lsMods.segmentMode ? StyleMod.SegMode : StyleMod.NoSegMode);
      }

      if (lsMods.physicalWidth) {
        modifiers |= StyleMod.PhysicalWidth;
      }

      if (undefined !== lsMods.normal) {
        const normalOffset = EGFBAccessors.DVec3d.createDVec3d(fbbLS, lsMods.normal.x, lsMods.normal.y, lsMods.normal.z);
        builderLS.addNormal(fbbLS, normalOffset);
        modifiers |= StyleMod.Normal;
      }

      if (undefined !== lsMods.rotation) {
        builderLS.addYaw(fbbLS, lsMods.rotation.yaw.degrees);
        builderLS.addPitch(fbbLS, lsMods.rotation.pitch.degrees);
        builderLS.addRoll(fbbLS, lsMods.rotation.roll.degrees);
        modifiers |= StyleMod.Rotation;
      }

      builderLS.addModifiers(fbbLS, modifiers);

      const mLocLS = builderLS.endLineStyleModifiers(fbbLS);
      fbbLS.finish(mLocLS);
      const dataLS = fbbLS.asUint8Array();

      if (0 !== modifiers)
        entries.push({ opcode: ElementGeometryOpcode.LineStyleModifiers, data: dataLS });
    }

    if (undefined !== geomParams.fillDisplay && FillDisplay.Never !== geomParams.fillDisplay) {
      const fbbFill = new flatbuffers.Builder();
      const builderFill = EGFBAccessors.AreaFill;

      let keyValuesOff;
      let keyColorsOff;
      let thematicOffset;

      if (undefined !== geomParams.gradient) {
        const keyColors: number[] = [];
        const keyValues: number[] = [];

        for (const key of geomParams.gradient.keys) {
          keyColors.push(key.color.tbgr);
          keyValues.push(key.value);
        }

        keyValuesOff = builderFill.createValuesVector(fbbFill, keyValues);
        keyColorsOff = builderFill.createColorsVector(fbbFill, keyColors);

        if (Gradient.Mode.Thematic === geomParams.gradient.mode && undefined !== geomParams.gradient.thematicSettings) {
          const thematic = geomParams.gradient.thematicSettings;
          const builderThematic = EGFBAccessors.ThematicSettings;
          builderThematic.startThematicSettings(fbbFill);

          builderThematic.addMode(fbbFill, thematic.mode);
          builderThematic.addStepCount(fbbFill, thematic.stepCount);
          builderThematic.addMarginColor(fbbFill, thematic.marginColor.tbgr);
          builderThematic.addColorScheme(fbbFill, thematic.colorScheme);

          const rangeOffset = EGFBAccessors.DRange1d.createDRange1d(fbbFill, ThematicGradientSettings.contentRange, ThematicGradientSettings.contentMax);
          builderThematic.addRange(fbbFill, rangeOffset);

          thematicOffset = builderThematic.endThematicSettings(fbbFill);
        }
      }

      builderFill.startAreaFill(fbbFill);

      const toEGFBFillDisplay = (fill: FillDisplay) => {
        switch (fill) {
          case FillDisplay.ByView:
            return EGFBAccessors.FillDisplay.ByView;
          case FillDisplay.Always:
            return EGFBAccessors.FillDisplay.Always;
          case FillDisplay.Blanking:
            return EGFBAccessors.FillDisplay.Blanking;
          default:
            return EGFBAccessors.FillDisplay.None;
        }
      };

      builderFill.addFill(fbbFill, toEGFBFillDisplay(geomParams.fillDisplay));

      if (undefined !== geomParams.fillTransparency)
        builderFill.addTransparency(fbbFill, geomParams.fillTransparency);

      if (undefined !== geomParams.gradient) {
        const toEGFBGradientMode = (mode: Gradient.Mode) => {
          switch (mode) {
            case Gradient.Mode.Linear:
              return EGFBAccessors.GradientMode.Linear;
            case Gradient.Mode.Curved:
              return EGFBAccessors.GradientMode.Curved;
            case Gradient.Mode.Cylindrical:
              return EGFBAccessors.GradientMode.Cylindrical;
            case Gradient.Mode.Spherical:
              return EGFBAccessors.GradientMode.Spherical;
            case Gradient.Mode.Hemispherical:
              return EGFBAccessors.GradientMode.Hemispherical;
            case Gradient.Mode.Thematic:
              return EGFBAccessors.GradientMode.Thematic;
            default:
              return EGFBAccessors.GradientMode.None;
          }
        };

        builderFill.addMode(fbbFill, toEGFBGradientMode(geomParams.gradient.mode));

        builderFill.addFlags(fbbFill, geomParams.gradient.flags);
        builderFill.addShift(fbbFill, geomParams.gradient.shift);

        if (undefined !== geomParams.gradient.tint)
          builderFill.addTint(fbbFill, geomParams.gradient.tint);

        if (undefined !== geomParams.gradient.angle)
          builderFill.addAngle(fbbFill, geomParams.gradient.angle.radians);

        if (undefined !== keyValuesOff)
          builderFill.addValues(fbbFill, keyValuesOff);

        if (undefined !== keyColorsOff)
          builderFill.addColors(fbbFill, keyColorsOff);

        if (undefined !== thematicOffset)
          builderFill.addThematicSettings(fbbFill, thematicOffset);
      } else if (undefined !== geomParams.backgroundFill && BackgroundFill.None !== geomParams.backgroundFill) {
        builderFill.addBackgroundFill(fbbFill, BackgroundFill.Outline === geomParams.backgroundFill ? 2 : 1);
      } else if (undefined !== geomParams.fillColor) {
        builderFill.addColor(fbbFill, geomParams.fillColor.tbgr);
        builderFill.addUseColor(fbbFill, 1);
      }

      const mLocFill = builderFill.endAreaFill(fbbFill);
      fbbFill.finish(mLocFill);
      const dataFill = fbbFill.asUint8Array();

      entries.push({ opcode: ElementGeometryOpcode.Fill, data: dataFill });
    }

    if (undefined !== geomParams.pattern) {
      const fbbPat = new flatbuffers.Builder();
      const builderPat = EGFBAccessors.AreaPattern;

      let pattern = geomParams.pattern;
      if (undefined !== worldToLocal) {
        pattern = pattern.clone();
        if (!pattern.applyTransform(worldToLocal))
          return false;
      }

      let defLineVecOffset;

      if (undefined !== pattern.defLines) {
        const defLines = pattern.defLines;
        const builderDefLines = EGFBAccessors.DwgHatchDefLine;
        const defLineOffsets: number[] = [];

        for (const line of defLines) {
          let dashOffset;

          if (undefined !== line.dashes)
            dashOffset = builderDefLines.createDashesVector(fbbPat, line.dashes);

          builderDefLines.startDwgHatchDefLine(fbbPat);

          if (undefined !== line.angle)
            builderDefLines.addAngle(fbbPat, line.angle.radians);

          // NOTE: Backend requires through and offset to be present...
          const throughOffset = EGFBAccessors.DPoint2d.createDPoint2d(fbbPat, undefined !== line.through ? line.through.x : 0, undefined !== line.through ? line.through.y : 0);
          builderDefLines.addThrough(fbbPat, throughOffset);

          const offsetOffset = EGFBAccessors.DPoint2d.createDPoint2d(fbbPat, undefined !== line.offset ? line.offset.x : 0, undefined !== line.offset ? line.offset.y : 0);
          builderDefLines.addOffset(fbbPat, offsetOffset);

          if (undefined !== dashOffset)
            builderDefLines.addDashes(fbbPat, dashOffset);

          defLineOffsets.push(builderDefLines.endDwgHatchDefLine(fbbPat));
        }

        if (0 !== defLineOffsets.length)
          defLineVecOffset = builderPat.createDefLineVector(fbbPat, defLineOffsets);
      }

      builderPat.startAreaPattern(fbbPat);

      if (undefined !== pattern.origin) {
        const originOffset = EGFBAccessors.DPoint3d.createDPoint3d(fbbPat, pattern.origin.x, pattern.origin.y, pattern.origin.z);
        builderPat.addOrigin(fbbPat, originOffset);
      }

      if (undefined !== pattern.rotation) {
        const matrix = pattern.rotation.toMatrix3d();
        const coffs = matrix.coffs;
        const rotationOffset = EGFBAccessors.RotMatrix.createRotMatrix(fbbPat, coffs[0], coffs[1], coffs[2], coffs[3], coffs[4], coffs[5], coffs[6], coffs[7], coffs[8]);
        builderPat.addRotation(fbbPat, rotationOffset);
      }

      if (undefined !== pattern.space1)
        builderPat.addSpace1(fbbPat, pattern.space1);

      if (undefined !== pattern.space2)
        builderPat.addSpace2(fbbPat, pattern.space2);

      if (undefined !== pattern.angle1)
        builderPat.addAngle1(fbbPat, pattern.angle1.radians);

      if (undefined !== pattern.angle2)
        builderPat.addAngle2(fbbPat, pattern.angle2.radians);

      if (undefined !== pattern.scale)
        builderPat.addScale(fbbPat, pattern.scale);

      if (undefined !== pattern.color) {
        builderPat.addColor(fbbPat, pattern.color.tbgr);
        builderPat.addUseColor(fbbPat, 1);
      }

      if (undefined !== pattern.weight) {
        builderPat.addWeight(fbbPat, pattern.weight);
        builderPat.addUseWeight(fbbPat, 1);
      }

      if (undefined !== pattern.invisibleBoundary && pattern.invisibleBoundary)
        builderPat.addInvisibleBoundary(fbbPat, 1);

      if (undefined !== pattern.snappable && pattern.snappable)
        builderPat.addSnappable(fbbPat, 1);

      if (undefined !== pattern.symbolId) {
        const symbolIdPair = Id64.getUint32Pair(pattern.symbolId);
        builderPat.addSymbolId(fbbPat, flatbuffers.Long.create(symbolIdPair.lower, symbolIdPair.upper));
      }

      if (undefined !== defLineVecOffset)
        builderPat.addDefLine(fbbPat, defLineVecOffset);

      const mLocPat = builderPat.endAreaPattern(fbbPat);
      fbbPat.finish(mLocPat);
      const dataPat = fbbPat.asUint8Array();

      entries.push({ opcode: ElementGeometryOpcode.Pattern, data: dataPat });
    }

    if (undefined !== geomParams.materialId) {
      const fbbMat = new flatbuffers.Builder();
      const builderMat = EGFBAccessors.Material;
      builderMat.startMaterial(fbbMat);

      const matIdPair = Id64.getUint32Pair(geomParams.materialId);
      builderMat.addMaterialId(fbbMat, flatbuffers.Long.create(matIdPair.lower, matIdPair.upper));
      builderMat.addUseMaterial(fbbMat, 1);

      const mLocMat = builderMat.endMaterial(fbbMat);
      fbbMat.finish(mLocMat);
      const dataMat = fbbMat.asUint8Array();

      entries.push({ opcode: ElementGeometryOpcode.Material, data: dataMat });
    }

    return true;
  }

  /** Return entry as [[GeometryPart]] id and instance transform */
  export function toGeometryPart(entry: ElementGeometryDataEntry, partToElement?: Transform): Id64String | undefined {
    if (ElementGeometryOpcode.PartReference !== entry.opcode)
      return undefined;

    const buffer = new flatbuffers.ByteBuffer(entry.data);
    const ppfb = EGFBAccessors.GeometryPart.getRootAsGeometryPart(buffer);

    const partLong = ppfb.geomPartId();
    const partId = Id64.fromUint32Pair(partLong.low, partLong.high);

    if (undefined !== partToElement) {
      let origin;
      const originfb = ppfb.origin();
      if (null !== originfb)
        origin = Point3d.create(originfb.x(), originfb.y(), originfb.z());
      else
        origin = Point3d.createZero();

      const angles = YawPitchRollAngles.createDegrees(ppfb.yaw(), ppfb.pitch(), ppfb.roll());
      const matrix = angles.toMatrix3d();
      if (1.0 !== ppfb.scale())
        matrix.scaleColumnsInPlace(ppfb.scale(), ppfb.scale(), ppfb.scale());

      Transform.createOriginAndMatrix(origin, matrix, partToElement);
    }

    return partId;
  }

  /** Create entry from a [[GeometryPart]] id and instance transform */
  export function fromGeometryPart(partId: Id64String, partTransform?: Transform, worldToLocal?: Transform): ElementGeometryDataEntry | undefined {
    let partToElement = partTransform;
    if (undefined !== worldToLocal)
      partToElement = worldToLocal.multiplyTransformTransform(undefined !== partTransform ? partTransform : Transform.createIdentity());

    const fbb = new flatbuffers.Builder();
    const builder = EGFBAccessors.GeometryPart;
    builder.startGeometryPart(fbb);

    const idPair = Id64.getUint32Pair(partId);
    builder.addGeomPartId(fbb, flatbuffers.Long.create(idPair.lower, idPair.upper));

    if (undefined !== partToElement && !partToElement.isIdentity) {
      const originOffset = EGFBAccessors.DPoint3d.createDPoint3d(fbb, partToElement.origin.x, partToElement.origin.y, partToElement.origin.z);
      builder.addOrigin(fbb, originOffset);

      const angles = YawPitchRollAngles.createFromMatrix3d(partToElement.matrix);
      if (undefined !== angles) {
        builder.addYaw(fbb, angles.yaw.degrees);
        builder.addPitch(fbb, angles.pitch.degrees);
        builder.addRoll(fbb, angles.roll.degrees);
      }

      const result = partToElement.matrix.factorRigidWithSignedScale();
      if (undefined !== result && result.scale > 0.0)
        builder.addScale(fbb, result.scale);
    }

    const mLoc = builder.endGeometryPart(fbb);
    fbb.finish(mLoc);
    const data = fbb.asUint8Array();

    return { opcode: ElementGeometryOpcode.PartReference, data };
  }

  /** Return entry as a [[ElementAlignedBox3d]] representing the local range of a geometric entry */
  export function toSubGraphicRange(entry: ElementGeometryDataEntry): ElementAlignedBox3d | undefined {
    if (ElementGeometryOpcode.SubGraphicRange !== entry.opcode)
      return undefined;

    const buffer = new flatbuffers.ByteBuffer(entry.data);
    const ppfb = EGFBAccessors.PointPrimitive.getRootAsPointPrimitive(buffer);

    if (2 !== ppfb.coordsLength())
      return undefined;

    const low = Point3d.create(ppfb.coords(0)!.x(), ppfb.coords(0)!.y(), ppfb.coords(0)!.z());
    const high = Point3d.create(ppfb.coords(1)!.x(), ppfb.coords(1)!.y(), ppfb.coords(1)!.z());

    return Range3d.create(low, high);
  }

  /** Create entry from a [[ElementAlignedBox3d]] to compute and store local ranges for subsequent geometric entries */
  export function fromSubGraphicRange(bbox: ElementAlignedBox3d): ElementGeometryDataEntry | undefined {
    const fbb = new flatbuffers.Builder();
    const builder = EGFBAccessors.PointPrimitive;

    builder.startCoordsVector(fbb, 2);
    fbb.addFloat64(bbox.high.z);
    fbb.addFloat64(bbox.high.y);
    fbb.addFloat64(bbox.high.x);
    fbb.addFloat64(bbox.low.z);
    fbb.addFloat64(bbox.low.y);
    fbb.addFloat64(bbox.low.x);
    const offset = fbb.endVector();

    builder.startPointPrimitive(fbb);
    builder.addCoords(fbb, offset);

    const mLoc = builder.endPointPrimitive(fbb);
    fbb.finish(mLoc);
    const data = fbb.asUint8Array();

    return { opcode: ElementGeometryOpcode.SubGraphicRange, data };
  }

  /** Create [[Transform]] from row-major storage 4x3 Float64Array */
  export function toTransform(sourceToWorld: Float64Array): Transform | undefined {
    if (12 !== sourceToWorld.length)
      return undefined;
    return Transform.createRowValues(
      sourceToWorld[0], sourceToWorld[1], sourceToWorld[2], sourceToWorld[3],
      sourceToWorld[4], sourceToWorld[5], sourceToWorld[6], sourceToWorld[7],
      sourceToWorld[8], sourceToWorld[9], sourceToWorld[10], sourceToWorld[11]
    );
  }

  /** Create [[ElementAlignedBox3d]] from lowX, lowY, lowZ, highX, highY, highZ Float64Array */
  export function toElementAlignedBox3d(bbox: Float64Array): ElementAlignedBox3d | undefined {
    if (6 !== bbox.length)
      return undefined;
    return Range3d.fromFloat64Array(bbox);
  }
}

