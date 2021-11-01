/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Geometry
 */

import { Id64, Id64String, IModelStatus } from "@itwin/core-bentley";
import {
  Angle, AnyGeometryQuery, GeometryQuery, IModelJson as GeomJson, LowAndHighXYZ, Matrix3d, Point2d, Point3d, Range3d, Transform, TransformProps,
  Vector3d, XYZProps, YawPitchRollAngles, YawPitchRollProps,
} from "@itwin/core-geometry";
import { ColorDef, ColorDefProps } from "../ColorDef";
import { GeometricElement2dProps, GeometricElement3dProps, GeometryPartProps, isPlacement2dProps, PlacementProps } from "../ElementProps";
import { BackgroundFill, FillDisplay, GeometryClass, GeometryParams } from "../GeometryParams";
import { Gradient } from "../Gradient";
import { IModelError } from "../IModelError";
import { AreaPattern } from "./AreaPattern";
import { ImageGraphic, ImageGraphicProps } from "./ImageGraphic";
import { LineStyle } from "./LineStyle";
import { TextString, TextStringProps } from "./TextString";
import { Base64EncodedString } from "../Base64EncodedString";
import { Placement2d, Placement3d } from "./Placement";

/** Establish a non-default [[SubCategory]] or to override [[SubCategoryAppearance]] for the geometry that follows.
 * A GeometryAppearanceProps always signifies a reset to the [[SubCategoryAppearance]] for subsequent [[GeometryStreamProps]] entries for undefined values.
 * @see [[GeometryStreamEntryProps]]
 * @public
 */
export interface GeometryAppearanceProps {
  /** Optional [[SubCategory]] id for subsequent geometry. Use to create a GeometryStream with geometry that is not on the default [[SubCategory]] for the element's [[Category]] or is has geometry on multiple subCategories. */
  subCategory?: Id64String;
  /** Optional color to override [[SubCategoryAppearance.color]] for subsequent geometry. */
  color?: ColorDefProps;
  /** Optional weight to override [[SubCategoryAppearance.weight]] for subsequent geometry. */
  weight?: number;
  /** Optional style to override [[SubCategoryAppearance.styleId]] for subsequent geometry. */
  style?: Id64String;
  /** Optional transparency, 0.0 if undefined. Effective transparency is a combination of this value and [[SubCategoryAppearance.color]]. */
  transparency?: number;
  /** Optional display priority (2d only), 0 if undefined. Effective display priority is a combination of this value and [[SubCategoryAppearance.priority]]. */
  displayPriority?: number;
  /** Optional GeometryClass (for DGN compatibility, subCategories preferred), [[GeometryClass.Primary]] if undefined. */
  geometryClass?: GeometryClass;
}

/** Add a [[gradient]], [[backgroundFill]], or solid [[color]] fill to subsequent planar regions (or meshes).
 * Only one value among [[gradient]], [[backgroundFill]], and [[color]] should be set.
 * @see [[GeometryStreamEntryProps]]
 * @public
 */
export interface AreaFillProps {
  /** Fill display type, must be set to something other than [[FillDisplay.Never]] to display fill */
  display: FillDisplay;
  /** Optional fill transparency, will be the same as outline transparency if undefined. Allows for different fill and outline transparencies */
  transparency?: number;
  /** Set fill color to view background color. Use [[BackgroundFill.Solid]] for an opaque fill and [[BackgroundFill.Outline]] to display an outline using the line color */
  backgroundFill?: BackgroundFill;
  /** Set fill color to a specific color. If the fill color the same as the line color, it is an opaque fill, otherwise it is an outline fill */
  color?: ColorDefProps;
  /** Set fill using gradient properties. */
  gradient?: Gradient.SymbProps;
}

/** Override [[SubCategoryAppearance.materialId]] for subsequent surface and solid geometry.
 * @see [[GeometryStreamEntryProps]]
 * @public
 */
export interface MaterialProps {
  /** Material id to use, specify an invalid [[Id64]] to override [[SubCategoryAppearance.materialId]] with no material. */
  materialId?: Id64String;
  /** @internal */
  origin?: XYZProps;
  /** @internal */
  size?: XYZProps;
  /** @internal */
  rotation?: YawPitchRollProps;
}

/** JSON representation of a brep GeometryStream entry.
 * @public
 */
export namespace BRepEntity {
  /** Enum for type of solid kernel entity this represents */
  export enum Type {
    /** Body consisting of at least one solid region */
    Solid = 0,
    /** Body consisting of connected sets of faces having edges that are shared by a maximum of two faces */
    Sheet = 1,
    /** Body consisting of connected sets of edges having vertices that are shared by a maximum of two edges */
    Wire = 2,
  }

  /** Optional symbology that can be assigned to individual faces of a solid or sheet body */
  export interface FaceSymbologyProps {
    /** Optional color override for face */
    color?: ColorDefProps;
    /** Optional transparency override for face */
    transparency?: number;
    /** Optional material override for face */
    materialId?: Id64String;
  }

  /** Geometry entry representing raw brep data.
   * @see [[GeometryStreamEntryProps]]
   */
  export interface DataProps {
    /** data as Base64 encoded string. Must be specifically requested using [[ElementLoadProps.wantBRepData]]. */
    data?: Base64EncodedString;
    /** body type, default is Solid */
    type?: Type;
    /** body transform, default is identity */
    transform?: TransformProps;
    /** body face attachments */
    faceSymbology?: FaceSymbologyProps[];
  }
}

/** Add a reference to a [[GeometryPart]] from the GeometryStream of a [[GeometricElement]].
 * @see [[GeometryStreamEntryProps]]
 * @public
 */
export interface GeometryPartInstanceProps {
  /** GeometryPart id */
  part: Id64String;
  /** Optional translation relative to element's placement, 0.0,0.0,0.0 if undefined. For a 2d element/translation, supply non-zero x and y only */
  origin?: XYZProps;
  /** Optional rotation relative to element's placement, 0.0,0.0,0.0 if undefined. For a 2d element/rotation, supply a non-zero yaw angle only */
  rotation?: YawPitchRollProps;
  /** Optional scale to apply to part, 1.0 if undefined */
  scale?: number;
}

/** Flags applied to the entire contents of a [[GeometryStreamProps]].
 * @see GeometryStreamHeaderProps
 * @public
 */
export enum GeometryStreamFlags {
  /** No flags. */
  None = 0,
  /** When the geometry is displayed, it is always oriented to face the viewer. The placement origin of the element associated with the geometry is used as the rotation point.
   * If the placement origin is outside of the view, the geometry will not necessarily be displayed, even if rotating it to face the viewer would cause its range to intersect the viewed volume.
   */
  ViewIndependent = 1 << 0,
}

/** An entry in a [[GeometryStreamProps]] containing [[GeometryStreamFlags]] that apply to the geometry stream as a whole.
 * If this entry exists in the [[GeometryStreamProps]] array, it will always be the *first* entry.
 * @public
 */
export interface GeometryStreamHeaderProps {
  /** The flags applied to the geometry stream. */
  flags: GeometryStreamFlags;
}

/** Allowed GeometryStream entries - should only set one value.
 * @see [GeometryStream]($docs/learning/common/geometrystream.md)
 * @public
 */
export interface GeometryStreamEntryProps extends GeomJson.GeometryProps {
  header?: GeometryStreamHeaderProps;
  appearance?: GeometryAppearanceProps;
  styleMod?: LineStyle.ModifierProps;
  fill?: AreaFillProps;
  pattern?: AreaPattern.ParamsProps;
  material?: MaterialProps;
  geomPart?: GeometryPartInstanceProps;
  textString?: TextStringProps;
  brep?: BRepEntity.DataProps;
  image?: ImageGraphicProps;
  subRange?: LowAndHighXYZ;
}

/** A [[GeometricElement]]'s GeometryStream is represented by an array of [[GeometryStreamEntryProps]].
 * @public
 */
export type GeometryStreamProps = GeometryStreamEntryProps[];

/** GeometryStreamBuilder is a helper class for populating the [[GeometryStreamProps]] array needed to create a [[GeometricElement]] or [[GeometryPart]].
 * @public
 */
export class GeometryStreamBuilder {
  /** Current inverse placement transform, used for converting world coordinate input to be placement relative */
  private _worldToLocal?: Transform;
  /** GeometryStream entries */
  public readonly geometryStream: GeometryStreamProps = [];

  /** Supply optional local to world transform. Used to transform world coordinate input relative to element placement.
   * For a [[GeometricElement]]'s placement to be meaningful, world coordinate geometry should never be appended to an element with an identity placement.
   * Can be called with undefined or identity transform to start appending geometry supplied in local coordinates again.
   */
  public setLocalToWorld(localToWorld?: Transform) {
    this._worldToLocal = (undefined === localToWorld || localToWorld.isIdentity ? undefined : localToWorld.inverse());
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

  /** Supply local to world transform from a PlacementProps2d or PlacementProps3d.
   * @see [[PlacementProps]]
   */
  public setLocalToWorldFromPlacement(props: PlacementProps) {
    const placement = isPlacement2dProps(props) ? Placement2d.fromJSON(props) : Placement3d.fromJSON(props);
    this.setLocalToWorld(placement.transform);
  }

  /** Store local ranges in GeometryStream for all subsequent geometry appended. Can improve performance of range testing for elements with a GeometryStream
   * containing more than one [[GeometryQuery]] differentiable by range. Not useful for a single [[GeometryQuery]] as its range and that of the [[GeometricElement]] are the same.
   * Ignored when defining a [[GeometryPart]] and not needed when only appending [[GeometryPart]] instances to a [[GeometricElement]] as these store their own range.
   */
  public appendGeometryRanges() {
    this.geometryStream.push({ subRange: Range3d.createNull() });
  }

  /** Change [[SubCategory]] or reset to [[SubCategoryAppearance]] for subsequent geometry.
   *  An invalid sub-category id can be supplied to force a reset to the current [[SubCategoryAppearance]].
   *  It is not valid to change the sub-category when defining a [[GeometryPart]]. A [[GeometryPart]] inherit the symbology of their instance for anything not explicitly overridden.
   */
  public appendSubCategoryChange(subCategoryId: Id64String): boolean {
    this.geometryStream.push({ appearance: { subCategory: subCategoryId } });
    return true;
  }

  /** Change [[GeometryParams]] for subsequent geometry.
   *  It is not valid to change the sub-category when defining a [[GeometryPart]]. A [[GeometryPart]] inherits the symbology of their instance for anything not explicitly overridden.
   */
  public appendGeometryParamsChange(geomParams: GeometryParams): boolean {
    const appearance: GeometryAppearanceProps = {
      subCategory: geomParams.subCategoryId,
      color: geomParams.lineColor?.toJSON(),
      weight: geomParams.weight,
      style: geomParams.styleInfo?.styleId,
      transparency: geomParams.elmTransparency,
      displayPriority: geomParams.elmPriority,
      geometryClass: geomParams.geometryClass,
    };
    this.geometryStream.push({ appearance });

    if (undefined !== geomParams.materialId)
      this.geometryStream.push({ material: { materialId: geomParams.materialId } });

    if (undefined !== geomParams.fillDisplay && FillDisplay.Never !== geomParams.fillDisplay) {
      const fill: AreaFillProps = {
        display: geomParams.fillDisplay,
        transparency: geomParams.fillTransparency,
      };
      if (undefined !== geomParams.gradient && Gradient.Mode.None !== geomParams.gradient.mode)
        fill.gradient = geomParams.gradient?.toJSON();
      else if (undefined !== geomParams.backgroundFill && BackgroundFill.None !== geomParams.backgroundFill)
        fill.backgroundFill = geomParams.backgroundFill;
      else if (undefined !== geomParams.fillColor)
        fill.color = geomParams.fillColor.toJSON();
      this.geometryStream.push({ fill });
    }

    if (undefined !== geomParams.pattern) {
      const localPattern = this._worldToLocal ? geomParams.pattern.clone() : geomParams.pattern;
      if (undefined !== this._worldToLocal && !localPattern.applyTransform(this._worldToLocal))
        return false;

      this.geometryStream.push({ pattern: localPattern.toJSON() });
    }

    if (undefined !== geomParams.styleInfo && undefined !== geomParams.styleInfo.styleMod) {
      const localStyleMod = new LineStyle.Modifier(geomParams.styleInfo.styleMod);
      if (undefined !== this._worldToLocal && !localStyleMod.applyTransform(this._worldToLocal))
        return false;
      this.geometryStream.push({ styleMod: localStyleMod });
    }

    return true;
  }

  /** Append a [[GeometryPart]] instance with relative position, orientation, and scale to a [[GeometryStreamProps]] array for creating a [[GeometricElement3d]].
   *  Not valid when defining a [[GeometryPart]] as nesting of parts is not supported.
   */
  public appendGeometryPart3d(partId: Id64String, instanceOrigin?: Point3d, instanceRotation?: YawPitchRollAngles, instanceScale?: number): boolean {
    if (undefined === this._worldToLocal) {
      this.geometryStream.push({ geomPart: { part: partId, origin: instanceOrigin, rotation: instanceRotation, scale: instanceScale } });
      return true;
    }
    const partTrans = Transform.createOriginAndMatrix(instanceOrigin, instanceRotation ? instanceRotation.toMatrix3d() : Matrix3d.createIdentity());
    if (undefined !== instanceScale)
      partTrans.matrix.scaleColumnsInPlace(instanceScale, instanceScale, instanceScale);
    const resultTrans = this._worldToLocal.multiplyTransformTransform(partTrans);
    const scales = new Vector3d();
    if (!resultTrans.matrix.normalizeColumnsInPlace(scales))
      return false;
    const newRotation = YawPitchRollAngles.createFromMatrix3d(resultTrans.matrix);
    if (undefined === newRotation)
      return false;
    this.geometryStream.push({ geomPart: { part: partId, origin: resultTrans.getOrigin(), rotation: newRotation, scale: scales.x } });
    return true;
  }

  /** Append a [[GeometryPart]] instance with relative position, orientation, and scale to a [[GeometryStreamProps]] array for creating a [[GeometricElement2d]].
   *  Not valid when defining a [[GeometryPart]] as nesting of parts is not supported.
   */
  public appendGeometryPart2d(partId: Id64String, instanceOrigin?: Point2d, instanceRotation?: Angle, instanceScale?: number): boolean {
    return this.appendGeometryPart3d(partId, instanceOrigin ? Point3d.createFrom(instanceOrigin) : undefined, instanceRotation ? new YawPitchRollAngles(instanceRotation) : undefined, instanceScale);
  }

  /** Append a [[TextString]] supplied in either local or world coordinates to the [[GeometryStreamProps]] array */
  public appendTextString(textString: TextString): boolean {
    if (undefined === this._worldToLocal) {
      this.geometryStream.push({ textString });
      return true;
    }
    const localTextString = new TextString(textString);
    if (!localTextString.transformInPlace(this._worldToLocal))
      return false;
    this.geometryStream.push({ textString: localTextString });
    return true;
  }

  /** Append an [[ImageGraphic]] supplied in either local or world coordinates. */
  public appendImage(image: ImageGraphic): boolean {
    if (undefined !== this._worldToLocal)
      image = image.cloneTransformed(this._worldToLocal);

    this.geometryStream.push({ image: image.toJSON() });
    return true;
  }

  /** Append a [[GeometryQuery]] supplied in either local or world coordinates to the [[GeometryStreamProps]] array */
  public appendGeometry(geometry: GeometryQuery): boolean {
    if (undefined === this._worldToLocal) {
      const geomData = GeomJson.Writer.toIModelJson(geometry);
      if (undefined === geomData)
        return false;
      this.geometryStream.push(geomData);
      return true;
    }
    const localGeometry = geometry.cloneTransformed(this._worldToLocal);
    if (undefined === localGeometry)
      return false;
    const localGeomData = GeomJson.Writer.toIModelJson(localGeometry);
    if (undefined === localGeomData)
      return false;
    this.geometryStream.push(localGeomData);
    return true;
  }

  /** Append [[BRepEntity.DataProps]] supplied in either local or world coordinates to the [[GeometryStreamProps]] array
   * @beta
   */
  public appendBRepData(brep: BRepEntity.DataProps): boolean {
    if (undefined === this._worldToLocal) {
      this.geometryStream.push({ brep });
      return true;
    }
    const entityTrans = Transform.fromJSON(brep.transform);
    const localTrans = entityTrans.multiplyTransformTransform(this._worldToLocal);
    const localBrep: BRepEntity.DataProps = {
      data: brep.data,
      type: brep.type,
      transform: localTrans.isIdentity ? undefined : localTrans.toJSON(),
      faceSymbology: brep.faceSymbology,
    };
    this.geometryStream.push({ brep: localBrep });
    return true;
  }

  /** @internal */
  public getHeader(): GeometryStreamHeaderProps | undefined {
    return 0 < this.geometryStream.length ? this.geometryStream[0].header : undefined;
  }

  /** @internal */
  public obtainHeader(): GeometryStreamHeaderProps {
    const hdr = this.getHeader();
    if (undefined !== hdr)
      return hdr;

    const entry = { header: { flags: GeometryStreamFlags.None } };
    this.geometryStream.unshift(entry);
    return entry.header;
  }

  /** Controls whether or not the geometry in the stream should be displayed as view-independent.
   * When view-independent geometry is displayed, it is always oriented to face the viewer, using the placement origin of the element as the rotation point.
   * If the placement origin is outside of the view, the geometry will not necessarily be displayed, even if rotating it to face the viewer would cause its range to intersect the viewed volume
   * @public
   */
  public get isViewIndependent(): boolean {
    const hdr = this.getHeader();
    return undefined !== hdr && GeometryStreamFlags.None !== (hdr.flags & GeometryStreamFlags.ViewIndependent);
  }
  public set isViewIndependent(viewIndependent: boolean) {
    if (viewIndependent === this.isViewIndependent)
      return;

    const hdr = this.obtainHeader();
    if (viewIndependent)
      hdr.flags |= GeometryStreamFlags.ViewIndependent;
    else
      hdr.flags &= ~GeometryStreamFlags.ViewIndependent;
  }
}

/** Represents a text string within a GeometryStream.
 * @public
 */
export interface TextStringPrimitive {
  type: "textString";
  readonly textString: TextString;
}

/** Represents an image within a GeometryStream.
 * @public
 */
export interface ImagePrimitive {
  type: "image";
  readonly image: ImageGraphic;
}

/** Represents a reference to a GeometryPart within a GeometryStream.
 * @public
 */
export interface PartReference {
  type: "partReference";
  part: {
    id: Id64String;
    readonly toLocal?: Transform;
  };
}

/** Represents a BRep within a GeometryStream.
 * @public
 */
export interface BRepPrimitive {
  type: "brep";
  /** @beta */
  readonly brep: BRepEntity.DataProps;
}

/** Represents one of a variety of GeometryQuery objects within a GeometryStream.
 * @public
 */
export interface GeometryPrimitive {
  type: "geometryQuery";
  readonly geometry: AnyGeometryQuery;
}

/** Union of all possible geometric primitive types that may appear within a GeometryStream.
 * @public
 */
export type GeometryStreamPrimitive = TextStringPrimitive | PartReference | BRepPrimitive | GeometryPrimitive | ImagePrimitive;

/** Holds current state information for [[GeometryStreamIterator]]. Each entry represents exactly one geometry primitive in the stream.
 * @public
 */
export interface GeometryStreamIteratorEntry {
  /** A [[GeometryParams]] representing the appearance of the current geometric entry */
  readonly geomParams: GeometryParams;
  /** Placement transform, used for converting placement relative, local coordinate entries to world */
  readonly localToWorld?: Transform;
  /** Optional stored local range for the current geometric entry */
  readonly localRange?: Range3d;
  /** Returns the geometric primitive represented by this entry. */
  readonly primitive: GeometryStreamPrimitive;
}

class IteratorEntry implements GeometryStreamIteratorEntry {
  private _primitive?: GeometryStreamPrimitive;
  public readonly geomParams: GeometryParams;
  public readonly localToWorld?: Transform;
  public localRange?: Range3d;

  public constructor(appearance: Id64String | GeometryParams, localToWorld?: Transform) {
    this.geomParams = typeof appearance === "string" ? new GeometryParams(appearance) : appearance;
    this.localToWorld = localToWorld;
  }

  public get primitive() { return this._primitive!; }
  public set primitive(primitive: GeometryStreamPrimitive) { this._primitive = primitive; }

  public setGeometryQuery(geometry: AnyGeometryQuery) { this._primitive = { type: "geometryQuery", geometry }; }
  public setTextString(textString: TextString) { this._primitive = { type: "textString", textString }; }
  public setBRep(brep: BRepEntity.DataProps) { this._primitive = { type: "brep", brep }; }
  public setImage(image: ImageGraphic) { this._primitive = { type: "image", image }; }
  public setPartReference(id: Id64String, toLocal?: Transform) {
    this._primitive = {
      type: "partReference",
      part: { id, toLocal },
    };
  }
}

/** GeometryStreamIterator is a helper class for iterating a [[GeometryStreamProps]].
 * A [[GeometricElement]]'s GeometryStream must be specifically requested using [[ElementLoadProps.wantGeometry]].
 * Each [[GeometryStreamIteratorEntry]] returned by the iterator represents exactly one geometric primitive in the stream.
 * @public
 */
export class GeometryStreamIterator implements IterableIterator<GeometryStreamIteratorEntry> {
  /** GeometryStream entries */
  public geometryStream: GeometryStreamProps;
  /** Flags applied to the entire geometry stream. */
  public readonly flags: GeometryStreamFlags;
  /** Current entry position */
  private _index = 0;
  /** Allocated on first call to next() and reused thereafter. */
  private _entry?: IteratorEntry;
  /** Used to initialize this._entry. */
  private readonly _appearance: Id64String | GeometryParams;
  private readonly _localToWorld?: Transform;

  /** Construct a new GeometryStreamIterator given a [[GeometryStreamProps]] from either a [[GeometricElement3d]], [[GeometricElement2d]], or [[GeometryPart]].
   * Supply the [[GeometricElement]]'s category to initialize the appearance information for each geometric entry.
   */
  public constructor(geometryStream: GeometryStreamProps, categoryOrGeometryParams?: Id64String | GeometryParams, localToWorld?: Transform) {
    this.geometryStream = geometryStream;
    this._appearance = categoryOrGeometryParams ?? Id64.invalid;
    this._localToWorld = localToWorld;
    if (0 < geometryStream.length && undefined !== geometryStream[0].header) {
      this.flags = geometryStream[0].header.flags;
      ++this._index;
    } else {
      this.flags = GeometryStreamFlags.None;
    }
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private get entry() {
    if (undefined === this._entry)
      this._entry = new IteratorEntry(this._appearance, this._localToWorld);

    return this._entry;
  }

  /** Create a new GeometryStream iterator for a [[GeometricElement3d]].
   * If [[GeometricElement3dProps.placement]] is not undefined, placement relative entries will be returned transformed to world coordinates.
   * @throws [[IModelError]] if element.geom is undefined.
   */
  public static fromGeometricElement3d(element: GeometricElement3dProps) {
    if (element.geom === undefined)
      throw new IModelError(IModelStatus.NoGeometry, "GeometricElement has no geometry or geometry wasn't requested");

    let transform;
    if (element.placement !== undefined)
      transform = Transform.createOriginAndMatrix(Point3d.fromJSON(element.placement.origin), YawPitchRollAngles.fromJSON(element.placement.angles).toMatrix3d());

    return new GeometryStreamIterator(element.geom, element.category, transform);
  }

  /** Create a new GeometryStream iterator for a [[GeometricElement2d]].
   * If [[GeometricElement2dProps.placement]] is not undefined, placement relative entries will be returned transformed to world coordinates.
   * @throws [[IModelError]] if element.geom is undefined.
   */
  public static fromGeometricElement2d(element: GeometricElement2dProps) {
    if (element.geom === undefined)
      throw new IModelError(IModelStatus.NoGeometry, "GeometricElement has no geometry or geometry wasn't requested");

    let transform;
    if (element.placement !== undefined) {
      const origin = Point3d.createFrom(Point2d.fromJSON(element.placement.origin));
      const matrix = Matrix3d.createRotationAroundVector(Vector3d.unitZ(), Angle.fromJSON(element.placement.angle))!;
      transform = Transform.createOriginAndMatrix(origin, matrix);
    }

    return new GeometryStreamIterator(element.geom, element.category, transform);
  }

  /** Create a new GeometryStream iterator for a [[GeometryPart]].
   * To iterate a part's GeometryStream in the context of a part instance found for a [[GeometricElement]], provide the optional [[GeometryParams]] and Transform from the [[GeometricElement]]'s [[GeometryStreamIterator]].
   * Supply the [[GeometryParams]] to return appearance information as inherited from the [[GeometricElement]].
   * Supply the partToWorld transform to return the part geometry in world coordinates.
   * Supply the partToLocal transform to return the part geometry relative to the [[GeometricElement]]'s placement.
   * @throws [[IModelError]] if geomPart.geom is undefined.
   */
  public static fromGeometryPart(geomPart: GeometryPartProps, geomParams?: GeometryParams, partTransform?: Transform) {
    if (geomPart.geom === undefined)
      throw new IModelError(IModelStatus.NoGeometry, "GeometryPart has no geometry or geometry wasn't requested");

    return new GeometryStreamIterator(geomPart.geom, geomParams?.clone(), partTransform);
  }

  /** Get the transform that if applied to a [[GeometryPart]]'s GeometryStream entries would return them in world coordinates. */
  public partToWorld(): Transform | undefined {
    if (undefined === this._entry)
      return this._localToWorld;

    const partToLocal = "partReference" === this._entry.primitive.type ? this._entry.primitive.part.toLocal : undefined;
    if (this._entry.localToWorld === undefined || partToLocal === undefined)
      return this._entry.localToWorld;

    return this._entry.localToWorld.multiplyTransformTransform(partToLocal);
  }

  /** Advance to next displayable geometric entry while updating the current [[GeometryParams]] from appearance related entries.
   * Geometric entries are [[TextString]], [[GeometryQuery]], [[GeometryPart]], [[ImageGraphic]], and [[BRepEntity.DataProps]].
   */
  public next(): IteratorResult<GeometryStreamIteratorEntry> {
    // NOTE: localRange remains valid until new subRange entry is encountered
    while (this._index < this.geometryStream.length) {
      const entry = this.geometryStream[this._index++];
      if (entry.appearance) {
        this.entry.geomParams.resetAppearance();
        if (entry.appearance.subCategory)
          this.entry.geomParams.subCategoryId = Id64.fromJSON(entry.appearance.subCategory);
        if (entry.appearance.color)
          this.entry.geomParams.lineColor = ColorDef.fromJSON(entry.appearance.color);
        if (entry.appearance.weight)
          this.entry.geomParams.weight = entry.appearance.weight;
        if (entry.appearance.style)
          this.entry.geomParams.styleInfo = new LineStyle.Info(Id64.fromJSON(entry.appearance.style));
        if (entry.appearance.transparency)
          this.entry.geomParams.elmTransparency = entry.appearance.transparency;
        if (entry.appearance.displayPriority)
          this.entry.geomParams.elmPriority = entry.appearance.displayPriority;
        if (entry.appearance.geometryClass)
          this.entry.geomParams.geometryClass = entry.appearance.geometryClass;
      } else if (entry.styleMod) {
        if (this.entry.geomParams.styleInfo === undefined)
          continue;

        const styleMod = new LineStyle.Modifier(entry.styleMod);
        if (this.entry.localToWorld !== undefined)
          styleMod.applyTransform(this.entry.localToWorld);

        this.entry.geomParams.styleInfo = new LineStyle.Info(this.entry.geomParams.styleInfo.styleId, styleMod);
      } else if (entry.fill) {
        if (entry.fill.display)
          this.entry.geomParams.fillDisplay = entry.fill.display;
        if (entry.fill.transparency)
          this.entry.geomParams.fillTransparency = entry.fill.transparency;
        if (entry.fill.gradient)
          this.entry.geomParams.gradient = Gradient.Symb.fromJSON(entry.fill.gradient);
        else if (entry.fill.backgroundFill)
          this.entry.geomParams.backgroundFill = entry.fill.backgroundFill;
        else if (entry.fill.color)
          this.entry.geomParams.fillColor = ColorDef.fromJSON(entry.fill.color);
      } else if (entry.pattern) {
        const params = AreaPattern.Params.fromJSON(entry.pattern);
        if (this.entry.localToWorld !== undefined)
          params.applyTransform(this.entry.localToWorld);

        this.entry.geomParams.pattern = params;
      } else if (entry.material) {
        if (entry.material.materialId)
          this.entry.geomParams.materialId = Id64.fromJSON(entry.material.materialId);
      } else if (entry.subRange) {
        this.entry.localRange = Range3d.fromJSON(entry.subRange);
      } else if (entry.geomPart) {
        let transform;
        if (entry.geomPart.origin !== undefined || entry.geomPart.rotation !== undefined || entry.geomPart.scale !== undefined) {
          const origin = entry.geomPart.origin ? Point3d.fromJSON(entry.geomPart.origin) : Point3d.createZero();
          const rotation = entry.geomPart.rotation ? YawPitchRollAngles.fromJSON(entry.geomPart.rotation).toMatrix3d() : Matrix3d.createIdentity();
          transform = Transform.createRefs(origin, rotation);
          if (entry.geomPart.scale)
            transform.multiplyTransformTransform(Transform.createRefs(Point3d.createZero(), Matrix3d.createUniformScale(entry.geomPart.scale)), transform);
        }

        this.entry.setPartReference(Id64.fromJSON(entry.geomPart.part), transform);
        return { value: this.entry, done: false };
      } else if (entry.textString) {
        const textString = new TextString(entry.textString);
        if (this.entry.localToWorld !== undefined)
          textString.transformInPlace(this.entry.localToWorld);

        this.entry.setTextString(textString);
        return { value: this.entry, done: false };
      } else if (entry.image) {
        const image = ImageGraphic.fromJSON(entry.image);
        if (undefined !== this.entry.localToWorld)
          image.transformInPlace(this.entry.localToWorld);

        this.entry.setImage(image);
        return { value: this.entry, done: false };
      } else if (entry.brep) {
        if (this.entry.localToWorld !== undefined) {
          const entityTrans = Transform.fromJSON(entry.brep.transform);
          entry.brep.transform = entityTrans.multiplyTransformTransform(this.entry.localToWorld).toJSON();
        }

        this.entry.setBRep(entry.brep);
        return { value: this.entry, done: false };
      } else {
        const geometryQuery = GeomJson.Reader.parse(entry);
        if (!(geometryQuery instanceof GeometryQuery))
          continue;

        if (this.entry.localToWorld !== undefined)
          geometryQuery.tryTransformInPlace(this.entry.localToWorld);

        this.entry.setGeometryQuery(geometryQuery);
        return { value: this.entry, done: false };
      }
    }

    return { value: this.entry, done: true };
  }

  public [Symbol.iterator](): IterableIterator<GeometryStreamIteratorEntry> {
    return this;
  }

  /** @internal */
  public get isViewIndependent(): boolean { return GeometryStreamFlags.None !== (this.flags & GeometryStreamFlags.ViewIndependent); }
}
