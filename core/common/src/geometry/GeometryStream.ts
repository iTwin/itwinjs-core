/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import {
  Point2d, Point3d, Vector3d, YawPitchRollAngles, YawPitchRollProps, Transform, RotMatrix, Angle, AngleProps, GeometryQuery, XYProps, XYZProps, LowAndHighXYZ,
} from "@bentley/geometry-core";
import { IModelJson as GeomJson } from "@bentley/geometry-core/lib/serialization/IModelJsonSchema";
import { Id64, Id64Props } from "@bentley/bentleyjs-core";
import { ColorDef } from "../ColorDef";
import { GeometryClass, GeometryParams, FillDisplay, BackgroundFill, Gradient } from "../Render";
import { TextStringProps, TextString } from "./TextString";

/** @module Geometry */

/** GeometryStream entry to establish a non-default subCategory or to override the subCategory appearance for the geometry that follows.
 *  GeometryAppearanceProps always signifies a reset to the subCategory appearance for all values without an override.
 */
export interface GeometryAppearanceProps {
  /** Optional subCategory id for subsequent geometry. Use to create a GeometryStream with geometry that is not on the default subCategory for the element's category or is on multiple subCategories */
  subCategory?: Id64Props;
  /** Optional color to override the subCategory appearance color for subsequent geometry */
  color?: ColorDef;
  /** Optional weight to override the subCategory appearance weight for subsequent geometry */
  weight?: number;
  /** Optional style to override the subCategory appearance style for subsequent geometry */
  style?: Id64Props;
  /** Optional transparency, default is 0. Effective transparency is a combination of this value and that from the subCategory appearance */
  transparency?: number;
  /** Optional display priority (2d only), default is 0. Effective display priority is a combination of this value and that from the subCategory appearance */
  displayPriority?: number;
  /** Optional GeometryClass (for DGN compatibility, subCategories preferred), default is Primary */
  geometryClass?: GeometryClass;
}

/** GeometryStream entry to modify the line style appearance without changing the line style definition.
 * Applies to the style previously established by a GeometryAppearanceProps or current subCategory appearance.
 * Most of the modifiers affect the line style stroke pattern, with the orientation and scales being the exception.
 */
export interface StyleModifierProps {
  /** Optional scale to apply to all length values */
  scale?: number;
  /** Optional scale to apply to scalable dashes */
  dashScale?: number;
  /** Optional scale to apply to scalable gaps */
  gapScale?: number;
  /** Optional start width in meters to apply to dashes */
  startWidth?: number;
  /** Optional end width in meters to apply to dashes */
  endWidth?: number;
  /** Optional shift by distance in meters */
  distPhase?: number;
  /** Optional shift by fraction */
  fractPhase?: number;
  /** Optional flag to center stroke pattern and stretch ends */
  centerPhase?: boolean;
  /** Optional flag to enable or disable single segment mode */
  segmentMode?: boolean;
  /** Optional flag that denotes startWidth and endWidth represent physical widths that should not be affected by scale */
  physicalWidth?: boolean;
  /** Optional up vector for style (applicable to 3d only) */
  normal?: XYZProps;
  /** Optional orientation for style (applicable to 3d only) */
  rotation?: YawPitchRollProps;
}

/** Gradient fraction value to [[ColorDef]] pair */
export interface GradientKeyColorProps {
  /** Fraction from 0.0 to 1.0 to denote position along gradient */
  value: number;
  /** Color value for given fraction */
  color: ColorDef;
}

/** @hidden Gradient settings specific to thematic mesh display */
export interface GradientThematicProps {
  mode?: number;
  stepCount?: number;
  margin?: number;
  marginColor?: ColorDef;
  colorScheme?: number;
}

/** Multi-color area fill defined by a range of colors that vary by position */
export interface GradientProps {
  /** Gradient type, must be set to something other than [[Gradient.Mode.None]] in order to display fill */
  mode: Gradient.Mode;
  /** Gradient flags to enable outline display and invert color fractions */
  flags?: Gradient.Flags;
  /** Gradient rotation angle */
  angle?: AngleProps;
  /** Gradient tint value from 0.0 to 1.0, only used when [[GradientKeyColorProps]] size is 1 */
  tint?: number;
  /** Gradient shift value from 0.0 to 1.0 */
  shift?: number;
  /** Gradient fraction value/color pairs, 1 minimum (uses tint for 2nd color), 8 maximum */
  keys: GradientKeyColorProps[];
  /** @hidden Settings applicable to meshes and Gradient.Mode.Thematic only */
  thematicSettings?: GradientThematicProps;
}

/** GeometryStream entry for adding a background color fill, a solid color fill, or a gradient fill to a planar region (or mesh).
 * Only one value among backgroundFill, color, and gradient should be set.
 */
export interface AreaFillProps {
  /** Fill display type, must be set to something other than [[FillDisplay.Never]] in order to display fill */
  display: FillDisplay;
  /** Optional fill transparency. Allows for different fill and outline transparencies */
  transparency?: number;
  /** Set fill color to view background color. Use [[BackgroundFill.Solid]] for an opaque fill and [[BackgroundFill.Outline]] to display an outline using the line color */
  backgroundFill?: BackgroundFill;
  /** Set fill color to a specific color. If the fill color and line color are the same, it's an opaque fill, otherwise it's an outline fill */
  color?: ColorDef;
  /** Set fill using gradient properties */
  gradient?: GradientProps;
}

/** Single hatch line definition */
export interface HatchDefLineProps {
  /** Angle of hatch line */
  angle?: AngleProps;
  /** Origin point (relative to placement) the hatch passes through */
  through?: XYProps;
  /** Offset of successive lines. X offset staggers dashes (ignored for solid lines) and Y offset controls the distance between both solid and dashed lines */
  offset?: XYProps;
  /** Array of gap and dash lengths for creating non-solid hatch lines, max of 20. A positive value denotes dash, a negative value a gap */
  dashes?: number[];
}

/** GeometryStream entry for adding a hatch, cross-hatch, or area pattern to a planar region */
export interface AreaPatternProps {
  /** Pattern offset (relative to placement) */
  origin?: XYZProps;
  /** Pattern orientation (relative to placement) */
  rotation?: YawPitchRollProps;
  /** Spacing of first set of parallel lines in a hatch pattern, or row spacing between area pattern tiles */
  space1?: number;
  /** Spacing of second set of parallel lines in a cross-hatch (leave undefined or 0 for a hatch), or column spacing between area pattern tiles */
  space2?: number;
  /** Angle of first set of parallel lines in a hatch pattern or area pattern tile direction */
  angle1?: AngleProps;
  /** Angle of second set of parallel lines in a cross-hatch */
  angle2?: AngleProps;
  /** Scale to apply to area pattern symbol */
  scale?: number;
  /** Pattern color, leave undefined to inherit color from parent element. For area patterns, does not override explicit colors stored in symbol */
  color?: ColorDef;
  /** Pattern weight, leave undefined to inherit weight from parent element. For area patterns, does not override explicit weights stored in symbol */
  weight?: number;
  /** Set to inhibit display of pattern boundary, not applicable when boundary is also filled */
  invisibleBoundary?: boolean;
  /** Set to allow snapping to pattern geometry */
  snappable?: boolean;
  /** GeometryPart id to use for tiled area pattern display */
  symbolId?: Id64Props;
  /** Define an area pattern by supplying hatch line definitions instead of using a GeometryPart */
  defLines?: HatchDefLineProps[];
}

/** GeometryStream entry to override the material from the subCategory appearance for the geometry that follows.
 */
export interface MaterialProps {
  /** Material id */
  materialId?: Id64Props;
  /** @hidden */
  origin?: XYZProps;
  /** @hidden */
  size?: XYZProps;
  /** @hidden */
  rotation?: YawPitchRollProps;
}

/** GeometryStream entry to a GeometryPart for a GeometricElement */
export interface GeometryPartInstanceProps {
  /** GeometryPart id */
  part: Id64Props;
  /** Optional translation relative to element's placement. Default is 0,0,0. For a 2d element/translation, supply non-zero x and y only */
  origin?: XYZProps;
  /** Optional rotation relative to element's placement. Default is 0,0,0. For a 2d element/rotation, supply a non-zero yaw angle only */
  rotation?: YawPitchRollProps;
  /** Optional scale to apply to part, default scale is 1 */
  scale?: number;
}

/** Allowed GeometryStream entries - should only set one value */
export interface GeometryStreamEntryProps extends GeomJson.GeometryProps {
  appearance?: GeometryAppearanceProps;
  styleMod?: StyleModifierProps;
  fill?: AreaFillProps;
  pattern?: AreaPatternProps;
  material?: MaterialProps;
  geomPart?: GeometryPartInstanceProps;
  textString?: TextStringProps;
  subRange?: LowAndHighXYZ;
}

export type GeometryStreamProps = GeometryStreamEntryProps[];

/** GeometryStreamBuilder is a helper class for populating the GeometryStreamEntryProps array needed to create a GeometricElement or GeometryPart */
export class GeometryStreamBuilder {
  /** Current inverse placement transform, used for converting world coordinate input to be placement relative */
  private worldToLocal?: Transform;
  /** GeometryStream entries */
  public readonly geometryStream: GeometryStreamProps = [];

  /** Supply optional local to world transform. Used to transform world coordinate input relative to element placement.
   * For a GeometricElement's placement to be meaningful, world coordinate geometry should never be appended to an element with an identity placement.
   * Can be called with undefined or identity transform to start appending geometry supplied in local coordinates again.
   */
  public setLocalToWorld(localToWorld?: Transform) {
    this.worldToLocal = (undefined === localToWorld || localToWorld.isIdentity() ? undefined : localToWorld.inverse());
  }

  /** Supply local to world transform from Point3d and YawPitchRollAngles */
  public setLocalToWorld3d(origin: Point3d, angles: YawPitchRollAngles = YawPitchRollAngles.createDegrees(0.0, 0.0, 0.0)) {
    this.setLocalToWorld(Transform.createOriginAndMatrix(origin, angles.toRotMatrix()));
  }

  /** Supply local to world transform from Point2d and Angle */
  public setLocalToWorld2d(origin: Point2d, angle: Angle = Angle.createDegrees(0.0)) {
    this.setLocalToWorld(Transform.createOriginAndMatrix(Point3d.createFrom(origin), RotMatrix.createRotationAroundVector(Vector3d.unitZ(), angle)!));
  }

  /** Change sub-category or reset to sub-category appearance for subsequent geometry.
   *  An invalid sub-category id can be supplied to force a reset to the current sub-category appearance.
   *  It is not valid to change the sub-category when defining a GeometryPart. GeometryParts inherit the symbology of their instance for anything not explicitly overridden.
   */
  public appendSubCategoryChange(subCategoryId: Id64): boolean {
    this.geometryStream.push({ appearance: { subCategory: subCategoryId } });
    return true;
  }

  /** Change GeometryParams for subsequent geometry.
   *  It is not valid to change the sub-category when defining a GeometryPart. GeometryParts inherit the symbology of their instance for anything not explicitly overridden.
   */
  public appendGeometryParamsChange(geomParams: GeometryParams): boolean {
    const appearance: GeometryAppearanceProps = {
      subCategory: geomParams.subCategoryId,
      color: geomParams.appearanceOverrides.color ? geomParams.getLineColor() : undefined,
      weight: geomParams.appearanceOverrides.weight ? geomParams.getWeight() : undefined,
      style: geomParams.appearanceOverrides.style ? (geomParams.getLineStyle() ? geomParams.getLineStyle()!.styleId : new Id64()) : undefined,
      transparency: geomParams.getTransparency(),
      displayPriority: geomParams.getDisplayPriority(),
      geometryClass: geomParams.getGeometryClass(),
    };
    // NOTE: Will need to check worldToLocal when support added for patterns and linestyles...
    this.geometryStream.push({ appearance });
    return true;
  }

  /** Append a GeometryPart instance with relative position, orientation, and scale to a GeometryStreamEntryProps array for creating a GeometricElement3d.
   *  Not valid when defining a GeometryPart as nested GeometryParts are not allowed.
   */
  public appendGeometryPart3d(partId: Id64, instanceOrigin?: Point3d, instanceRotation?: YawPitchRollAngles, instanceScale?: number): boolean {
    if (undefined === this.worldToLocal) {
      this.geometryStream.push({ geomPart: { part: partId, origin: instanceOrigin, rotation: instanceRotation, scale: instanceScale } });
      return true;
    }
    const partTrans = Transform.createOriginAndMatrix(instanceOrigin, instanceRotation ? instanceRotation.toRotMatrix() : RotMatrix.createIdentity());
    if (undefined !== instanceScale)
      partTrans.matrix.scaleColumnsInPlace(instanceScale, instanceScale, instanceScale);
    const resultTrans = partTrans.multiplyTransformTransform(this.worldToLocal);
    const scales = new Vector3d();
    if (!resultTrans.matrix.normalizeColumnsInPlace(scales))
      return false;
    const newRotation = YawPitchRollAngles.createFromRotMatrix(resultTrans.matrix);
    if (undefined === newRotation)
      return false;
    this.geometryStream.push({ geomPart: { part: partId, origin: resultTrans.getOrigin(), rotation: newRotation, scale: scales.x } });
    return true;
  }

  /** Append a GeometryPart instance with relative position, orientation, and scale to a GeometryStreamEntryProps array for creating a GeometricElement2d.
   *  Not valid when defining a GeometryPart as nested GeometryParts are not allowed.
   */
  public appendGeometryPart2d(partId: Id64, instanceOrigin?: Point2d, instanceRotation?: Angle, instanceScale?: number): boolean {
    return this.appendGeometryPart3d(partId, instanceOrigin ? Point3d.createFrom(instanceOrigin) : undefined, instanceRotation ? new YawPitchRollAngles(instanceRotation) : undefined, instanceScale);
  }

  /** Append a TextString supplied in either local or world coordinates to the GeometryStreamProps array */
  public appendTextString(textString: TextString): boolean {
    if (undefined === this.worldToLocal) {
      this.geometryStream.push({ textString });
      return true;
    }
    const localTextString = new TextString(textString);
    if (!localTextString.transformInPlace(this.worldToLocal))
      return false;
    this.geometryStream.push({ textString: localTextString });
    return true;
  }

  /** Append a GeometryQuery supplied in either local or world coordinates to the GeometryStreamProps array */
  public appendGeometryQuery(geometry: GeometryQuery): boolean {
    if (undefined === this.worldToLocal) {
      const geomData = GeomJson.Writer.toIModelJson(geometry);
      if (undefined === geomData)
        return false;
      this.geometryStream.push(geomData);
      return true;
    }
    const localGeometry = geometry.cloneTransformed(this.worldToLocal);
    if (undefined === localGeometry)
      return false;
    const localGeomData = GeomJson.Writer.toIModelJson(localGeometry);
    if (undefined === localGeomData)
      return false;
    this.geometryStream.push(localGeomData);
    return true;
  }
}

/** Class for identifying a geometric primitive in a GeometryStream */
export class GeometryStreamEntryId {
  private _partId: Id64;      // Valid when index refers to a part
  private _index: number;     // Index into top-level GeometryStream
  private _partIndex: number; // Index into part GeometryStream

  public constructor() {
    this._partId = new Id64();
    this._index = 0;
    this._partIndex = 0;
  }

  public get index() { return this._index; }
  public get partIndex() { return this._partIndex; }
  public get geometryPartId() { return this._partId; }
  public isValid() { return this._index !== 0; }
  public increment() { if (this._partId.isValid()) this.incrementPartIndex(); else this.incrementIndex(); }
  public incrementIndex() { if (65535 === this._index) return; this._index++; } // More than 65535 geometric entries in a single GeometryStream is questionable...
  public incrementPartIndex() { if (65535 === this._partIndex) return; this._partIndex++; }
  public setGeometryPartId(partId: Id64) { this._partId = partId; }
  public setIndex(index: number) { this._index = index; }
  public setPartIndex(partIndex: number) { this._index = partIndex; }
  public setActive(enable: boolean) {
    if (this._partId.isValid()) {
      if (!enable) this._partId = new Id64();
      return;
    }
    this._partId = new Id64();
    this._index = 0;
    this._partIndex = 0;
  }
  public setActiveGeometryPart(partId: Id64) {
    this._partId = new Id64(partId);
  }

  public clone(): GeometryStreamEntryId {
    const retVal = new GeometryStreamEntryId();
    retVal._partId = new Id64(this._partId);
    retVal._index = this._index;
    retVal._partIndex = this._partIndex;
    return retVal;
  }
}

// class CurrentState {
//   public geomParams?: GeometryParams;
//   public sourceToWorld: Transform;
//   public geomToSource: Transform;
//   public geomToWorld: Transform;
//   public geometry?: GeometricPrimitive;
//   public geomStreamEntryId?: GeometryStreamEntryId;
//   public localRange: Range3d;

//   public constructor() {
//     this.sourceToWorld = Transform.createIdentity();
//     this.geomToSource = Transform.createIdentity();
//     this.geomToWorld = Transform.createIdentity();
//     this.localRange = Range3d.createNull();
//   }
// }
