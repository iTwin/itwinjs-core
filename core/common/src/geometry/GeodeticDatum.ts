/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Geometry
 */
// cspell:ignore JSONXYZ, ETRF, OSGB, DHDN, NADCON, GEOCN

import { Geometry, Vector3d, XYAndZ } from "@itwin/core-geometry";
import { GeodeticEllipsoid, GeodeticEllipsoidProps } from "./GeodeticEllipsoid";

/** Holds 3 components of a Positional Vector rotation definition in arc seconds
 *  @public
 */
export interface XyzRotationProps {
  /** X rotation component in arc second */
  x: number;
  /** Y rotation component in arc second*/
  y: number;
  /** Z rotation component in arc second*/
  z: number;
}

/** Hold 3 components data of a Positional Vector rotation definition in arc seconds
 *  @public
 */
export class XyzRotation implements XyzRotationProps {
  /** X rotation component in arc second */
  public readonly x!: number;
  /** Y rotation component in arc second*/
  public readonly y!: number;
  /** Z rotation component in arc second*/
  public readonly z!: number;

  public constructor(data?: XyzRotationProps) {
    if (data) {
      this.x = data.x;
      this.y = data.y;
      this.z = data.z;
    }
  }

  /** Creates a Rotations object from JSON representation.
   * @public */
  public static fromJSON(data: XyzRotationProps): XyzRotation {
    return new XyzRotation(data);
  }

  /** Creates a JSON from the Rotations definition
   * @public */
  public toJSON(): XyzRotationProps {
    return { x: this.x, y: this.y, z: this.z };
  }

  /** Compares two geodetic rotations. It applies a minuscule angular tolerance
   *  @public */
  public equals(other: XyzRotation): boolean {
    return (Math.abs(this.x - other.x) < Geometry.smallAngleSeconds &&
      Math.abs(this.y - other.y) < Geometry.smallAngleSeconds &&
      Math.abs(this.z - other.z) < Geometry.smallAngleSeconds);
  }
}

/** Type indicating the geodetic transformation method
 *  @public
 */
export type GeodeticTransformMethod =
  "None" |
  "Geocentric" |
  "PositionalVector" |
  "GridFiles" |
  "MultipleRegression" |
  "Undefined";

/** This interface represents a geocentric (three parameters) geodetic transformation.
 *  @public
 */
export interface GeocentricTransformProps {
  /** The frame translation components in meters */
  delta: XYAndZ;
}

/** This class represents a geocentric (three parameters) geodetic transformation.
 *  @public
 */
export class GeocentricTransform implements GeocentricTransformProps {
  /** The frame translation components in meters */
  public readonly delta: Vector3d;

  public constructor(data?: GeocentricTransformProps) {
    this.delta = data ? Vector3d.fromJSON(data.delta) : new Vector3d();
  }

  /** Creates a Geocentric Transform from JSON representation.
   * @public */
  public static fromJSON(data: GeocentricTransformProps): GeocentricTransform {
    return new GeocentricTransform(data);
  }

  /** Creates a JSON from the Geodetic GeocentricTransform definition
   * @public */
  public toJSON(): GeocentricTransformProps {
    return { delta: { x: this.delta.x, y: this.delta.y, z: this.delta.z } };
  }

  /** Compares two geodetic transforms. It applies a minuscule tolerance.
   *  @public */
  public equals(other: GeocentricTransform): boolean {
    return (Math.abs(this.delta.x - other.delta.x) < Geometry.smallMetricDistance &&
      Math.abs(this.delta.y - other.delta.y) < Geometry.smallMetricDistance &&
      Math.abs(this.delta.z - other.delta.z) < Geometry.smallMetricDistance);
  }
}

/** This interface represents a positional vector (seven parameters) geodetic transformation corresponding to
 *  EPSG operation 9606. Beware that the convention relative to rotation direction is different
 *  from the Coordinate Frame operation (epsg 9607).
 *  @public
 */
export interface PositionalVectorTransformProps {
  /** The frame translation components in meters */
  delta: XYAndZ;
  /** The frame rotation components in arc seconds. The rotation sign convention is the one associated with
   * the operation EPSG:9606 following recommendation of ISO 19111 specifications */
  rotation: XyzRotationProps;
  /** Scale in parts per million. The scale effectively applied will be 1 plus scale divided by 1 000 000. */
  scalePPM: number;
}

/** This class represents a positional vector (seven parameters) geodetic transformation corresponding to
 *  EPSG operation 9606. Beware that the convention relative to rotation direction is different
 *  from the Coordinate Frame operation (epsg 9607).
 *  @public
 */
export class PositionalVectorTransform implements PositionalVectorTransformProps {
  /** The frame translation components in meters */
  public readonly delta!: Vector3d;
  /** The frame rotation components in arc seconds. The rotation sign convention is the one associated with
   * the operation EPSG:9606 following recommendation of ISO 19111 specifications */
  public readonly rotation!: XyzRotation;
  /** Scale in parts per million. The scale effectively applied will be 1 plus scale divided by 1 000 000. */
  public readonly scalePPM!: number;

  public constructor(data?: PositionalVectorTransformProps) {
    if (data) {
      this.delta = data.delta ? Vector3d.fromJSON(data.delta) : new Vector3d();
      this.rotation = data.rotation ? XyzRotation.fromJSON(data.rotation) : new XyzRotation();
      this.scalePPM = data.scalePPM;
    }
  }

  /** Creates a Positional Vector Transform from JSON representation.
   * @public */
  public static fromJSON(data: PositionalVectorTransformProps): PositionalVectorTransform {
    return new PositionalVectorTransform(data);
  }

  /** Creates a JSON from the Positional Vector Transform definition
   * @public */
  public toJSON(): PositionalVectorTransformProps {
    return {
      delta: { x: this.delta.x, y: this.delta.y, z: this.delta.z },
      rotation: this.rotation.toJSON(),
      scalePPM: this.scalePPM,
    };
  }

  /** Compares two Positional Vector Transforms. It applies a minuscule tolerance to number compares.
   *  @public */
  public equals(other: PositionalVectorTransform): boolean {
    if (Math.abs(this.delta.x - other.delta.x) > Geometry.smallMetricDistance ||
      Math.abs(this.delta.y - other.delta.y) > Geometry.smallMetricDistance ||
      Math.abs(this.delta.z - other.delta.z) > Geometry.smallMetricDistance ||
      Math.abs(this.scalePPM - other.scalePPM) > Geometry.smallFraction)
      return false;

    return this.rotation.equals(other.rotation);
  }
}

/** Type indicating the file format of the grid files.
 *  @public
 */
export type GridFileFormat =
  "NONE" |
  "NTv1" |
  "NTv2" |
  "NADCON" |
  "FRENCH" |
  "JAPAN" |
  "ATS77" |
  "GEOCN";

/** type to indicate the grid file application direction.
 *  @public
 */
export type GridFileDirection = "Direct" | "Inverse";

/** Grid file definition containing name of the file, the format and the direction it should be applied
 *  @public
 */
export interface GridFileDefinitionProps {
  /** Name of the grid shift file. This name is relative to the expected dictionary root document.
   *  Typical grid shift file name will contain first the country name it applies to then possibly some sub path.
   *  Example of existing grid files:
   *  Germany/BETA2007.gsb or Brazil/SAD69_003.GSB but sometimes longer paths USA/NADCON/conus.l*s
   *  Note that the file name can contain wildcards when the format requires more than one file. For example
   *  the NADCON format makes use of a different file for latitude and longitude shifts thus the .l*s extension in the
   *  file name above.
   *  Forward slash is always used to separate the path components.
   */
  fileName: string;
  /** The grid file format */
  format: GridFileFormat;
  /** The grid file application direction */
  direction: GridFileDirection;
}

/** Grid file definition containing name of the file, the format and the direction it should be applied
 *  @public
 */
export class GridFileDefinition implements GridFileDefinitionProps {
  /** Name of the grid shift file. This name is relative to the expected dictionary root document.
   *  Typical grid shift file name will contain first the country name it applies to then possibly some sub path.
   *  Example of existing grid files:
   *  Germany/BETA2007.gsb or Brazil/SAD69_003.GSB but sometimes longer paths USA/NADCON/conus.l*s
   *  Note that the file name can contain wildcards when the format requires more than one file. For example
   *  the NADCON format makes use of a different file for latitude and longitude shifts thus the .l*s extension in the
   *  file name above.
   *  Forward slash is always used to separate the path components.
   */
  public readonly fileName: string;
  /** The grid file format */
  public readonly format: GridFileFormat;
  /** The grid file application direction */
  public readonly direction: GridFileDirection;

  public constructor(data?: GridFileDefinitionProps) {
    this.fileName = data ? data.fileName : "";
    this.format = data ? data.format : "NTv2";
    this.direction = data ? data.direction : "Direct";
  }

  /** Creates a Grid File Definition from JSON representation.
   * @public */
  public static fromJSON(data: GridFileDefinitionProps): GridFileDefinition {
    return new GridFileDefinition(data);
  }

  /** Creates a JSON from the Grid File Definition
   * @public */
  public toJSON(): GridFileDefinitionProps {
    return { fileName: this.fileName, format: this.format, direction: this.direction };
  }

  /** Compares two grid file definition. It is a strict compare operation not an equivalence test.
   *  @public */
  public equals(other: GridFileDefinition): boolean {
    return (this.fileName === other.fileName && this.direction === other.direction && this.format === other.format);
  }
}

/** This interface represents a grid files based geodetic transformation.
 *  @public
 */
export interface GridFileTransformProps {
  /** The list of grid files. The order of file is meaningful, the first encountered that covers the extent of coordinate
   *  transformation will be used. */
  files: GridFileDefinitionProps[];
  /** The positional vector fallback transformation used for extents not covered by the grid files */
  fallback?: PositionalVectorTransformProps;
}

/** This class represents a grid files based geodetic transformation.
 *  @public
 */
export class GridFileTransform implements GridFileTransformProps {
  /** The list of grid files. The order of file is meaningful, the first encountered that covers the extent of coordinate
   *  transformation will be used. */
  public readonly files: GridFileDefinition[];
  /** The positional vector fallback transformation used for extents not covered by the grid files */
  public readonly fallback?: PositionalVectorTransform;

  public constructor(data?: GridFileTransformProps) {
    this.files = [];
    if (data) {
      this.fallback = data.fallback ? PositionalVectorTransform.fromJSON(data.fallback) : undefined;
      if (Array.isArray(data.files)) {
        this.files = [];
        for (const item of data.files)
          this.files.push(GridFileDefinition.fromJSON(item));
      }
    }
  }

  /** Creates a Grid File Transform from JSON representation.
   * @public */
  public static fromJSON(data: GridFileTransformProps): GridFileTransform {
    return new GridFileTransform(data);
  }

  /** Creates a JSON from the Grid File Transform definition
   * @public */
  public toJSON(): GridFileTransformProps {
    const data: GridFileTransformProps = { files: [] };
    data.fallback = this.fallback ? this.fallback.toJSON() : undefined;
    if (Array.isArray(this.files)) {
      for (const item of this.files)
        data.files.push(item.toJSON());
    }
    return data;
  }

  /** Compares two Grid File Transforms. It is a strict compare operation not an equivalence test.
   *  @public */
  public equals(other: GridFileTransform): boolean {
    if (this.files.length !== other.files.length)
      return false;

    for (let idx = 0; idx < this.files.length; ++idx)
      if (!this.files[idx].equals(other.files[idx]))
        return false;

    if ((this.fallback === undefined) !== (other.fallback === undefined))
      return false;

    if (this.fallback && !this.fallback.equals(other.fallback!))
      return false;

    return true;
  }
}

/** This interface represents a geodetic transformation that enables transforming longitude/latitude coordinates
 *  from one datum to another.
 *  @public
 */
export interface GeodeticTransformProps {
  /** The method used by the geodetic transform */
  method: GeodeticTransformMethod;
  /** The complete definition of the source geodetic ellipsoid referred to by ellipsoidId.
   *  The source ellipsoid identifier enables obtaining the shape of the Earth mathematical model
   *  for the purpose of performing the transformation.
  */
  sourceEllipsoid?: GeodeticEllipsoidProps;
  /** The complete definition of the target geodetic ellipsoid referred to by ellipsoidId.
   *  The target ellipsoid identifier enables obtaining the shape of the Earth mathematical model
   *  for the purpose of performing the transformation.*/
  targetEllipsoid?: GeodeticEllipsoidProps;
  /** When method is Geocentric this property contains the geocentric parameters */
  geocentric?: GeocentricTransformProps;
  /** When method is PositionalVector this property contains the positional vector parameters */
  positionalVector?: PositionalVectorTransformProps;
  /** When method is GridFiles this property contains the grid files parameters */
  gridFile?: GridFileTransformProps;
}

/** This class represents a geodetic transformation that enables transforming longitude/latitude coordinates
 *  from one datum to another.
 *  @public
 */
export class GeodeticTransform implements GeodeticTransformProps {
  /** The method used by the geodetic transform */
  public readonly method: GeodeticTransformMethod;
  /** The identifier of the source geodetic datum as stored in the dictionary or the service database.
   *  This identifier is optional and informational only.
   */
  public readonly sourceEllipsoid?: GeodeticEllipsoid;
  /** The complete definition of the target geodetic ellipsoid referred to by ellipsoidId.
   *  The target ellipsoid identifier enables obtaining the shape of the Earth mathematical model
   *  for the purpose of performing the transformation.*/
  public readonly targetEllipsoid?: GeodeticEllipsoid;
  /** When method is Geocentric this property contains the geocentric parameters */
  public readonly geocentric?: GeocentricTransform;
  /** When method is PositionalVector this property contains the positional vector parameters */
  public readonly positionalVector?: PositionalVectorTransform;
  /** When method is GridFiles this property contains the grid files parameters */
  public readonly gridFile?: GridFileTransform;

  public constructor(data?: GeodeticTransformProps) {
    this.method = "None";
    if (data) {
      this.method = data.method;
      this.sourceEllipsoid = data.sourceEllipsoid ? GeodeticEllipsoid.fromJSON(data.sourceEllipsoid) : undefined;
      this.targetEllipsoid = data.targetEllipsoid ? GeodeticEllipsoid.fromJSON(data.targetEllipsoid) : undefined;
      this.geocentric = data.geocentric ? GeocentricTransform.fromJSON(data.geocentric) : undefined;
      this.positionalVector = data.positionalVector ? PositionalVectorTransform.fromJSON(data.positionalVector) : undefined;
      this.gridFile = data.gridFile ? GridFileTransform.fromJSON(data.gridFile) : undefined;
    }
  }

  /** Creates a Geodetic Transform from JSON representation.
   * @public */
  public static fromJSON(data: GeodeticTransformProps): GeodeticTransform {
    return new GeodeticTransform(data);
  }

  /** Creates a JSON from the Geodetic Transform definition
   * @public */
  public toJSON(): GeodeticTransformProps {
    const data: GeodeticTransformProps = { method: this.method };
    data.sourceEllipsoid = this.sourceEllipsoid ? this.sourceEllipsoid.toJSON() : undefined;
    data.targetEllipsoid = this.targetEllipsoid ? this.targetEllipsoid.toJSON() : undefined;
    data.geocentric = this.geocentric ? this.geocentric.toJSON() : undefined;
    data.positionalVector = this.positionalVector ? this.positionalVector.toJSON() : undefined;
    data.gridFile = this.gridFile ? this.gridFile.toJSON() : undefined;
    return data;
  }

  /** Compares two geodetic Transforms. It is not an equivalence test since
   * descriptive information is strictly compared. A minuscule tolerance is applied to number compares.
   *  @public */
  public equals(other: GeodeticTransform): boolean {
    if (this.method !== other.method)
      return false;

    if ((this.sourceEllipsoid === undefined) !== (other.sourceEllipsoid === undefined))
      return false;
    if (this.sourceEllipsoid && !this.sourceEllipsoid.equals(other.sourceEllipsoid!))
      return false;

    if ((this.targetEllipsoid === undefined) !== (other.targetEllipsoid === undefined))
      return false;
    if (this.targetEllipsoid && !this.targetEllipsoid.equals(other.targetEllipsoid!))
      return false;

    if ((this.geocentric === undefined) !== (other.geocentric === undefined))
      return false;
    if (this.geocentric && !this.geocentric.equals(other.geocentric!))
      return false;

    if ((this.positionalVector === undefined) !== (other.positionalVector === undefined))
      return false;
    if (this.positionalVector && !this.positionalVector.equals(other.positionalVector!))
      return false;

    if ((this.gridFile === undefined) !== (other.gridFile === undefined))
      return false;
    if (this.gridFile && !this.gridFile.equals(other.gridFile!))
      return false;

    return true;
  }
}

/** This interface represents a geodetic datum. Geodetic datums are based on an ellipsoid.
 *  In addition to the ellipsoid definition they are the base for longitude/latitude coordinates.
 *  Geodetic datums are the basis for geodetic transformations. Most geodetic datums are defined by specifying
 *  the transformation to the common base WGS84 (or local equivalent). The transforms property can contain the
 *  definition of the transformation path to WGS84.
 *  Sometimes there exists transformation paths direct from one non-WGS84 datum to another non-WGS84. The current model
 *  does not allow specifications of these special paths at the moment.
 *  @public
 */
export interface GeodeticDatumProps {
  /** GeodeticDatum key name */
  id?: string;
  /** Description */
  description?: string;
  /** If true then indicates the definition is deprecated. It should then be used for backward compatibility only.
   ** If false or undefined then the definition is not deprecated.
   */
  deprecated?: boolean;
  /** A textual description of the source of the geodetic datum definition. */
  source?: string;
  /** The EPSG code of the geodetic datum. If undefined then there is no EPSG code associated. */
  epsg?: number;
  /** The key name to the base Ellipsoid. */
  ellipsoidId?: string;
  /** The full definition of the geodetic ellipsoid associated to the datum. If undefined then the ellipsoidId must be used to fetch the definition from the dictionary, geographic coordinate system service or the backend */
  ellipsoid?: GeodeticEllipsoidProps;
  /** The transformation to WGS84. If null then there is no known transformation to WGS84. Although
   *  this is rare it occurs in a few cases where the country charges for obtaining and using
   *  the transformation and its parameters, or if the transformation is maintained secret for military reasons.
   *  In this case the recommendation is to considered the geodetic datum to be coincident to WGS84 keeping
   *  in mind imported global data such as Google Map or Bing Map data may be approximately located.
   *  The list of transforms contains normally a single transform but there can be a sequence of transformations
   *  required to transform to WGS84, such as the newer datum definitions for Slovakia or Switzerland.
   */
  transforms?: GeodeticTransformProps[];
}

/** This class represents a geodetic datum. Geodetic datums are based on an ellipsoid.
 *  In addition to the ellipsoid definition they are the base for longitude/latitude coordinates.
 *  Geodetic datums are the basis for geodetic transformations. Most geodetic datums are defined by specifying
 *  the transformation to the common base WGS84 (or local equivalent). The transforms property can contain the
 *  definition of the transformation path to WGS84.
 *  Sometimes there exists transformation paths direct from one non-WGS84 datum to another non-WGS84. The current model
 *  does not allow specifications of these special paths at the moment.
 *  @public
 */
export class GeodeticDatum implements GeodeticDatumProps {
  /** GeodeticDatum key name */
  public readonly id?: string;
  /** Description */
  public readonly description?: string;
  /** If true then indicates the definition is deprecated. It should then be used for backward compatibility only.
   *  If false then the definition is not deprecated. Default is false.
   */
  public readonly deprecated: boolean;
  /** A textual description of the source of the geodetic datum definition. */
  public readonly source?: string;
  /** The EPSG code of the geodetic datum. If undefined then there is no EPSG code associated. */
  public readonly epsg?: number;
  /** The key name to the base Ellipsoid. */
  public readonly ellipsoidId?: string;
  /** The full definition of the geodetic ellipsoid associated to the datum. If undefined then the ellipsoidId must
   *  be used to fetch the definition from the dictionary, geographic coordinate system service or the backend
   */
  public readonly ellipsoid?: GeodeticEllipsoid;
  /** The transformation to WGS84. If null then there is no known transformation to WGS84. Although
   *  this is rare it occurs in a few cases where the country charges for obtaining and using
   *  the transformation and its parameters, or if the transformation is maintained secret for military reasons.
   *  In this case the recommendation is to considered the geodetic datum to be coincident to WGS84 keeping
   *  in mind imported global data such as Google Map or Bing Map data may be approximately located.
   *  The list of transforms contains normally a single transform but there can be a sequence of transformations
   *  required to transform to WGS84, such as the newer datum definitions for Slovakia or Switzerland.
   */
  public readonly transforms?: GeodeticTransform[];

  public constructor(_data?: GeodeticDatumProps) {
    this.deprecated = false;
    if (_data) {
      this.id = _data.id;
      this.description = _data.description;
      this.deprecated = _data.deprecated ?? false;
      this.source = _data.source;
      this.epsg = _data.epsg;
      this.ellipsoidId = _data.ellipsoidId;
      this.ellipsoid = _data.ellipsoid ? GeodeticEllipsoid.fromJSON(_data.ellipsoid) : undefined;
      if (Array.isArray(_data.transforms)) {
        this.transforms = [];
        for (const item of _data.transforms)
          this.transforms.push(GeodeticTransform.fromJSON(item));
      }
    }
  }

  /** Creates a Geodetic Datum from JSON representation.
   * @public */
  public static fromJSON(data: GeodeticDatumProps): GeodeticDatum {
    return new GeodeticDatum(data);
  }

  /** Creates a JSON from the Geodetic Datum definition
   * @public */
  public toJSON(): GeodeticDatumProps {
    const data: GeodeticDatumProps = {};
    data.id = this.id;
    data.description = this.description;
    /* We prefer to use the default undef instead of false value for deprecated value in Json */
    data.deprecated = (this.deprecated === false ? undefined : true);
    data.source = this.source;
    data.epsg = this.epsg;
    data.ellipsoidId = this.ellipsoidId;
    data.ellipsoid = this.ellipsoid ? this.ellipsoid.toJSON() : undefined;
    if (Array.isArray(this.transforms)) {
      data.transforms = [];
      for (const item of this.transforms)
        data.transforms.push(item.toJSON());
    }
    return data;
  }

  /** Compares two Geodetic Datums. It is a strict compare operation not an equivalence test.
   * It takes into account descriptive properties not only mathematical definition properties.
   *  @public */
  public equals(other: GeodeticDatum): boolean {
    if (this.id !== other.id ||
      this.description !== other.description ||
      this.deprecated !== other.deprecated ||
      this.source !== other.source ||
      this.epsg !== other.epsg ||
      this.ellipsoidId !== other.ellipsoidId)
      return false;

    if ((this.ellipsoid === undefined) !== (other.ellipsoid === undefined))
      return false;

    if (this.ellipsoid && !this.ellipsoid.equals(other.ellipsoid!))
      return false;

    if ((this.transforms === undefined) !== (other.transforms === undefined))
      return false;

    if (this.transforms && other.transforms) {
      if (this.transforms.length !== other.transforms.length)
        return false;

      for (let idx = 0; idx < this.transforms.length; ++idx)
        if (!this.transforms[idx].equals(other.transforms[idx]))
          return false;
    }
    return true;
  }
}

