/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import {
  Point2d, Point3d, Vector3d, YawPitchRollAngles, Transform, RotMatrix, Angle, GeometryQuery, XYZProps, YawPitchRollProps,
} from "@bentley/geometry-core";
import { IModelJson as GeomJson } from "@bentley/geometry-core/lib/serialization/IModelJsonSchema";
import { Id64, Id64Props } from "@bentley/bentleyjs-core";
import { ColorDef } from "../ColorDef";
import { GeometryClass, GeometryParams } from "../Render";
import { TextStringProps, TextString } from "./TextString";

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

// NEEDSWORK: StyleModifierProps/AreaFillProps/AreaPatternProps/MaterialProps...

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

/** Allowed GeometryStream entries */
export type GeometryStreamEntryProps =
  { appearance: GeometryAppearanceProps } |
  { geomPart: GeometryPartInstanceProps } |
  { textString: TextStringProps } |
  GeomJson.GeometryProps;

export type GeometryStreamProps = GeometryStreamEntryProps[];

export enum GeomCoordSystem {
  Local = 0,  // <-- Geometry is being supplied in local coordinates. @note Builder must be created with a known placement for local coordinates to be meaningful.
  World = 1,  // <-- Geometry is being supplied in world coordinates. @note Builder should not be supplied world coordinate geometry for an identity placement.
}

/** GeometryStreamBuilder is a helper class for populating the GeometryStreamEntryProps array needed to create a GeometricElement or GeometryPart */
export class GeometryStreamBuilder {
  /** Current placement transform, used for converting world input to local */
  public readonly sourceToWorld = Transform.createIdentity();
  /** GeometryStream entries */
  public readonly geometryStream: GeometryStreamProps = [];

  /** Create a new GeometryStreamBuilder with source to world transform for specifying input in world coordinates instead of local */
  public constructor(transform?: Transform) {
    if (transform)
      this.sourceToWorld.setFrom(transform);
  }

  /** Create a new GeometryStreamBuilder with source to world supplied as a Point2d and Angle */
  public static from2d(origin: Point2d, angle: Angle = Angle.createDegrees(0.0)): GeometryStreamBuilder {
    return new GeometryStreamBuilder(Transform.createOriginAndMatrix(Point3d.createFrom(origin), RotMatrix.createRotationAroundVector(Vector3d.unitZ(), angle)!));
  }

  /** Create a new GeometryStreamBuilder with source to world supplied as a Point3d and YawPitchRollAngles */
  public static from3d(origin: Point3d, angles: YawPitchRollAngles = YawPitchRollAngles.createDegrees(0.0, 0.0, 0.0)): GeometryStreamBuilder {
    return new GeometryStreamBuilder(Transform.createOriginAndMatrix(origin, angles.toRotMatrix()));
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
  public appendGeometryParamsChange(geomParams: GeometryParams, coord: GeomCoordSystem = GeomCoordSystem.Local): boolean {
    if (GeomCoordSystem.Local === coord) {
      const appearance: GeometryAppearanceProps = {
        subCategory: geomParams.subCategoryId,
        color: geomParams.appearanceOverrides.color ? geomParams.getLineColor() : undefined,
        weight: geomParams.appearanceOverrides.weight ? geomParams.getWeight() : undefined,
        style: geomParams.appearanceOverrides.style ? (geomParams.getLineStyle() ? geomParams.getLineStyle()!.styleId : new Id64()) : undefined,
        transparency: geomParams.getTransparency(),
        displayPriority: geomParams.getDisplayPriority(),
        geometryClass: geomParams.getGeometryClass(),
      };
      this.geometryStream.push({ appearance });
      return true;
    }
    return this.appendGeometryParamsChange(geomParams); // NEEDSWORK: Handle GeomCoordSystem.World when support added for patterns and linestyles...
  }

  /** Append a GeometryPart instance with relative position, orientation, and scale to a GeometryStreamEntryProps array for creating a GeometricElement2d.
   *  Not valid when defining a GeometryPart as nested GeometryParts are not allowed.
   */
  public appendGeometryPart2d(partId: Id64, instanceOrigin?: Point2d, instanceRotation?: Angle, instanceScale?: number): boolean {
    this.geometryStream.push({ geomPart: { part: partId, origin: instanceOrigin ? Point3d.createFrom(instanceOrigin) : undefined, rotation: instanceRotation ? new YawPitchRollAngles(instanceRotation) : undefined, scale: instanceScale } });
    return true;
  }

  /** Append a GeometryPart instance with relative position, orientation, and scale to a GeometryStreamEntryProps array for creating a GeometricElement3d.
   *  Not valid when defining a GeometryPart as nested GeometryParts are not allowed.
   */
  public appendGeometryPart3d(partId: Id64, instanceOrigin?: Point3d, instanceRotation?: YawPitchRollAngles, instanceScale?: number): boolean {
    this.geometryStream.push({ geomPart: { part: partId, origin: instanceOrigin, rotation: instanceRotation, scale: instanceScale } });
    return true;
  }

  /** Append a TextString supplied in either local or world coordinates to the GeometryStreamProps array */
  public appendTextString(textString: TextString, coord: GeomCoordSystem = GeomCoordSystem.Local): boolean {
    if (GeomCoordSystem.Local === coord) {
      this.geometryStream.push({ textString });
      return true;
    }
    const localTextString = new TextString(textString);
    if (!localTextString.transformInPlace(this.sourceToWorld.inverse()!))
      return false;
    return this.appendTextString(localTextString);
  }

  /** Append a GeometryQuery supplied in either local or world coordinates to the GeometryStreamProps array */
  public appendGeometryQuery(geometry: GeometryQuery, coord: GeomCoordSystem = GeomCoordSystem.Local): boolean {
    if (GeomCoordSystem.Local === coord) {
      const geomData = GeomJson.Writer.toIModelJson(geometry);
      if (undefined === geomData)
        return false;
      this.geometryStream.push(geomData);
      return true;
    }
    const localGeometry = geometry.cloneTransformed(this.sourceToWorld.inverse()!);
    if (undefined === localGeometry)
      return false;
    return this.appendGeometryQuery(localGeometry);
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
