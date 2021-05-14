/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Geometry
 */
// cspell:ignore Albers, Krovak, OSTN, Cassini, Grinten, Mollweide, Eckert, Homolosine, Carree, Winkel, Tripel, Polyconic

/** This enum contains the list of all projection methods that can be represented as part of the HorizontalCRS
 *  class. The None method indicates there is no projection and thus the CRS is longitude/latitude based
 *  with units as degrees.
 *  All other projection indicated a projected CRS.
 *  @public
 */
export type ProjectionMethod =
  "None" |
  "TransverseMercator" |
  "SouthOrientedTransverseMercator" |
  "TransverseMercatorWisconsin" |
  "TransverseMercatorMinnesota" |
  "TransverseMercatorAffine" |
  "MercatorStandardParallel" |
  "Mercator" |
  "UniversalTransverseMercator" |
  "LambertConformalConicTwoParallels" |
  "LambertConformalConicBelgium" |
  "LambertConformalConicAffine" |
  "LambertConformalConicWisconsin" |
  "LambertConformalConicMinnesota" |
  "LambertConformalConicMichigan" |
  "LambertConformalConicOneParallel" |
  "AlbersEqualArea" |
  "NewZealandNationalGrid" |
  "ObliqueMercator1" |
  "ObliqueMercator2" |
  "TransverseMercatorOSTN97" |
  "TransverseMercatorOSTN02" |
  "TransverseMercatorOSTN15" |
  "Krovak" |
  "KrovakModified" |
  "ObliqueCylindricalSwiss" |
  "TransverseMercatorDenmarkSystem34" |
  "TransverseMercatorDenmarkSystem3499" |
  "TransverseMercatorDenmarkSystem3401" |
  "Cassini" |
  "Sinusoidal" |
  "VanDerGrinten" |
  "Bonne" |
  "Mollweide" |
  "EckertIV" |
  "EckertVI" |
  "GoodeHomolosine" |
  "Robinson" |
  "PlateCarree" |
  "MillerCylindrical" |
  "WinkelTripel" |
  "AzimuthalEqualArea" |
  "ObliqueStereographic" |
  "RectifiedSkewOrthomorphicCentered" |
  "RectifiedSkewOrthomorphicOrigin" |
  "ObliqueCylindricalHungary" |
  "Orthographic" |
  "AmericanPolyconic" |
  "LambertEquidistantAzimuthal" |
  "ObliqueMercatorMinnesota";

/** The equations are:
 *  X1 = a1*X + a2*Y + TranslationX
 *  Y1 = b1*X + b2*Y + translationY
 *  An affine representing no transformation will have: a1 = 1.0, a2 = 0.0, b1 = 0.0, b2 = 1.0.
 *  @public
 */
export interface AffineTransformProps {
  /** The X post translation */
  translationX: number;
  /** The Y post-translation */
  translationY: number;
  /** A1 value as defined in global comment. */
  a1: number;
  /** B1 value as defined in global comment. */
  b1: number;
  /** A2 value as defined in global comment. */
  a2: number;
  /** B2 value as defined in global comment. */
  b2: number;
}

/** The equations are:
 *  X1 = a1*X + a2*Y + TranslationX
 *  Y1 = b1*X + b2*Y + translationY
 *  An affine representing no transformation will have: a1 = 1.0, a2 = 0.0, b1 = 0.0, b2 = 1.0.
 *  @public
 */
export class AffineTransform implements AffineTransformProps {
  /** The X post translation */
  public readonly translationX!: number;
  /** The Y post-translation */
  public readonly translationY!: number;
  /** A1 value as defined in global comment. */
  public readonly a1!: number;
  /** B1 value as defined in global comment. */
  public readonly b1!: number;
  /** A2 value as defined in global comment. */
  public readonly a2!: number;
  /** B2 value as defined in global comment. */
  public readonly b2!: number;

  constructor(data?: AffineTransformProps) {
    if (data) {
      this.translationX = data.translationX;
      this.translationY = data.translationY;
      this.a1 = data.a1;
      this.b1 = data.b1;
      this.a2 = data.a2;
      this.b2 = data.b2;
    }
  }

  /** Creates an Affine Transform from JSON representation.
   * @public */
  public static fromJSON(data: AffineTransformProps): AffineTransform {
    return new AffineTransform(data);
  }

  /** Creates a JSON from the Affine Transform definition
   * @public */
  public toJSON(): AffineTransformProps {
    return { translationX: this.translationX, a1: this.a1, a2: this.a2, translationY: this.translationY, b1: this.b1, b2: this.b2 };
  }

  /** Compares two Affine Transforms. It is a strict compare operation.
   * It is useful for tests purposes only.
   *  @internal */
  public equals(other: AffineTransform): boolean {
    return (this.translationX === other.translationX &&
      this.translationY === other.translationY &&
      this.a1 === other.a1 &&
      this.b1 === other.b1 &&
      this.a2 === other.a2 &&
      this.b2 === other.b2);
  }
}

/** Type used in the definition of UTM Zoning projection. This projection only requires a zone number and
 *  the hemisphere North or South.
 *  @public
 */
export type HemisphereEnum = "South" | "North";

/** The type to define the three zones of the Danish System 34 projections.
 *  @public
 */
export type DanishSystem34Region = "Jylland" | "Sjaelland" | "Bornholm";

/** This class encapsulates the projection of the CRS. The projection relies on a projection method
 *  and a set of projection parameters specific to projection method selected.
 *  @public
 */
export interface ProjectionProps {
  /** The projection method. */
  method: ProjectionMethod;
  /** The False Easting of the projection. */
  falseEasting?: number;
  /** The False Northing of the projection. */
  falseNorthing?: number;
  /** The Central Meridian. */
  centralMeridian?: number;
  /** The latitude of origin of the projection. */
  latitudeOfOrigin?: number;
  /** Longitude of origin of the projection. */
  longitudeOfOrigin?: number;
  /** The scale reduction factor applied at origin. The nature of the projection has a
   *  inherent scale factor applied that gradually varies outward from the projection origin.
   *  The scale factor at origin enables to level the inherent scale factor over an use extent.
   *  For the michigan variation of the Lambert Conformal Conic projection it
   *  can be used instead or in addition to Standard Parallel to define
   *  a scale factor.
   */
  scaleFactor?: number;
  /** The elevation of the origin of the projection above the geoid. This value
   *  allows compensation for the scale factor related to elevation above the sea level.
   */
  elevationAboveGeoid?: number;
  /** The geoid separation. It represents the elevation of the geoid above the ellipsoid at the center of the projection. */
  geoidSeparation?: number;
  /** The definition of the affine post-transformation for Transverse Mercator and Lambert Conformal Conic with post-affine projections */
  affine?: AffineTransformProps;
  /** Standard parallel for projection that only use one.
   *  For cylindrical projections (mercator, transverse mercator ...) it defines the parallel at
   *  which the cylinder crosses the ellipsoid resulting in a scale factor being applied.
   *  For conic projections (Lambert Tangential ...) it defines
   *  the standard parallel at which the cone is tangent to the ellipsoid.
   */
  standardParallel?: number;
  /** The first standard parallel at which the cone crosses the ellipsoid. */
  standardParallel1?: number;
  /** The second standard parallel at which the cone crosses the ellipsoid. */
  standardParallel2?: number;
  /** The UTM zone number. A number from 0 to 60. */
  zoneNumber?: number;
  /** The hemisphere for Universal Transverse Mercator projection. */
  hemisphere?: HemisphereEnum;
  /** Longitude of the central point. */
  centralPointLongitude?: number;
  /** Latitude of the central point. */
  centralPointLatitude?: number;
  /** Longitude of the first alignment point for some Oblique Mercator and Krovak projections. */
  point1Longitude?: number;
  /** Latitude of the first alignment point for some Oblique Mercator and Krovak projections. */
  point1Latitude?: number;
  /** Longitude of the second alignment point for some Oblique Mercator projections. */
  point2Longitude?: number;
  /** Latitude of the second alignment point for some Oblique Mercator projections. */
  point2Latitude?: number;
  /** The Danish zone for Danish projections. */
  danishSystem34Region?: DanishSystem34Region;
  /** Azimuth. */
  azimuth?: number;
}

/** This class encapsulates the projection of the CRS. The projection relies on a projection method and a set
 *  of projection parameters specific to projection method selected to flatten the surface of the model of the Earth
 *  defines as a geodetic ellipsoid. The flattening and the distortion angular, linear, scale from the process varies between methods.
 *  Refer to appropriate external documentation for details.
 *  @note Various property sets are required for specific projection methods. The current class implementation does not enforce
 *        these rules yet and it is possible to define or not define any property regardless the method used.
 *  @public
 */
export class Projection implements ProjectionProps {
  /** The projection method. */
  public readonly method!: ProjectionMethod;
  /** The False Easting of the projection. */
  public readonly falseEasting?: number;
  /** The False Northing of the projection. */
  public readonly falseNorthing?: number;
  /** The Central Meridian. */
  public readonly centralMeridian?: number;
  /** The latitude of origin of the projection. */
  public readonly latitudeOfOrigin?: number;
  /** Longitude of origin of the projection. */
  public readonly longitudeOfOrigin?: number;
  /** The scale reduction factor applied at origin. The nature of the projection has a
   *  inherent scale factor applied that gradually varies outward from the projection origin.
   *  The scale factor at origin enables to level the inherent scale factor over an use extent.
   *  For the michigan variation of the Lambert Conformal Conic projection it
   *  can be used instead or in addition to Standard Parallel to define
   *  a scale factor.
   */
  public readonly scaleFactor?: number;
  /** The elevation of the origin of the projection above the geoid. This value
   *  allows compensation for the scale factor related to elevation above the sea level.
   */
  public readonly elevationAboveGeoid?: number;
  /** The geoid separation. It represents the elevation of the geoid above the ellipsoid at the center of the projection. */
  public readonly geoidSeparation?: number;
  /** The definition of the affine post-transformation for Transverse Mercator and Lambert Conformal Conic with post-affine projections */
  public readonly affine?: AffineTransform;
  /** Standard parallel for projection that only use one.
   *  For cylindrical projections (mercator, transverse mercator ...) it defines the parallel at
   ** which the cylinder crosses the ellipsoid resulting in a scale factor being applied.
   *  For conic projections (Lambert Tangential ...) it defines
   *  the standard parallel at which the cone is tangent to the ellipsoid.
   */
  public readonly standardParallel?: number;
  /** The first standard parallel at which the cone crosses the ellipsoid. */
  public readonly standardParallel1?: number;
  /** The second standard parallel at which the cone crosses the ellipsoid. */
  public readonly standardParallel2?: number;
  /** The UTM zone number. A number from 0 to 60. */
  public readonly zoneNumber?: number;
  /** The hemisphere for Universal Transverse Mercator projection. */
  public readonly hemisphere?: HemisphereEnum;
  /** Longitude of the central point. */
  public readonly centralPointLongitude?: number;
  /** Latitude of the central point. */
  public readonly centralPointLatitude?: number;
  /** Longitude of the first alignment point for some Oblique Mercator and Krovak projections. */
  public readonly point1Longitude?: number;
  /** Latitude of the first alignment point for some Oblique Mercator and Krovak projections. */
  public readonly point1Latitude?: number;
  /** Longitude of the second alignment point for some Oblique Mercator projections. */
  public readonly point2Longitude?: number;
  /** Latitude of the second alignment point for some Oblique Mercator projections. */
  public readonly point2Latitude?: number;
  /** The Danish zone for Danish projections. */
  public readonly danishSystem34Region?: DanishSystem34Region;
  /** Azimuth. */
  public readonly azimuth?: number;

  public constructor(_data?: ProjectionProps) {
    if (_data) {
      this.method = _data.method;
      this.falseEasting = _data.falseEasting;
      this.falseNorthing = _data.falseNorthing;
      this.centralMeridian = _data.centralMeridian;
      this.latitudeOfOrigin = _data.latitudeOfOrigin;
      this.longitudeOfOrigin = _data.longitudeOfOrigin;
      this.scaleFactor = _data.scaleFactor;
      this.elevationAboveGeoid = _data.elevationAboveGeoid;
      this.geoidSeparation = _data.geoidSeparation;
      this.affine = _data.affine ? AffineTransform.fromJSON(_data.affine) : undefined;
      this.standardParallel = _data.standardParallel;
      this.standardParallel1 = _data.standardParallel1;
      this.standardParallel2 = _data.standardParallel2;
      this.zoneNumber = _data.zoneNumber;
      this.hemisphere = _data.hemisphere;
      this.centralPointLongitude = _data.centralPointLongitude;
      this.centralPointLatitude = _data.centralPointLatitude;
      this.point1Longitude = _data.point1Longitude;
      this.point1Latitude = _data.point1Latitude;
      this.point2Longitude = _data.point2Longitude;
      this.point2Latitude = _data.point2Latitude;
      this.danishSystem34Region = _data.danishSystem34Region;
      this.azimuth = _data.azimuth;
    }
  }

  /** Creates a Projection from JSON representation.
   * @public */
  public static fromJSON(data: ProjectionProps): Projection {
    return new Projection(data);
  }

  /** Creates a JSON from the Projection definition
   * @public */
  public toJSON(): ProjectionProps {
    const data: ProjectionProps = { method: this.method };
    data.falseEasting = this.falseEasting;
    data.falseNorthing = this.falseNorthing;
    data.centralMeridian = this.centralMeridian;
    data.latitudeOfOrigin = this.latitudeOfOrigin;
    data.longitudeOfOrigin = this.longitudeOfOrigin;
    data.scaleFactor = this.scaleFactor;
    data.elevationAboveGeoid = this.elevationAboveGeoid;
    data.geoidSeparation = this.geoidSeparation;
    data.affine = this.affine ? this.affine.toJSON() : undefined;
    data.standardParallel = this.standardParallel;
    data.standardParallel1 = this.standardParallel1;
    data.standardParallel2 = this.standardParallel2;
    data.zoneNumber = this.zoneNumber;
    data.hemisphere = this.hemisphere;
    data.centralPointLongitude = this.centralPointLongitude;
    data.centralPointLatitude = this.centralPointLatitude;
    data.point1Longitude = this.point1Longitude;
    data.point1Latitude = this.point1Latitude;
    data.point2Longitude = this.point2Longitude;
    data.point2Latitude = this.point2Latitude;
    data.danishSystem34Region = this.danishSystem34Region;
    data.azimuth = this.azimuth;
    return data;
  }

  /** Compares two projections. It is a strict compare operation and not an equivalence test.
   * It is useful for tests purposes only.
   *  @internal */
  public equals(other: Projection): boolean {
    if (this.method !== other.method ||
      this.falseEasting !== other.falseEasting ||
      this.falseNorthing !== other.falseNorthing ||
      this.centralMeridian !== other.centralMeridian ||
      this.latitudeOfOrigin !== other.latitudeOfOrigin ||
      this.longitudeOfOrigin !== other.longitudeOfOrigin ||
      this.scaleFactor !== other.scaleFactor ||
      this.elevationAboveGeoid !== other.elevationAboveGeoid ||
      this.geoidSeparation !== other.geoidSeparation ||
      this.standardParallel !== other.standardParallel ||
      this.standardParallel1 !== other.standardParallel1 ||
      this.standardParallel2 !== other.standardParallel2 ||
      this.zoneNumber !== other.zoneNumber ||
      this.hemisphere !== other.hemisphere ||
      this.centralPointLongitude !== other.centralPointLongitude ||
      this.centralPointLatitude !== other.centralPointLatitude ||
      this.point1Longitude !== other.point1Longitude ||
      this.point1Latitude !== other.point1Latitude ||
      this.point2Longitude !== other.point2Longitude ||
      this.point2Latitude !== other.point2Latitude ||
      this.danishSystem34Region !== other.danishSystem34Region ||
      this.azimuth !== other.azimuth)
      return false;

    if (this.affine && other.affine) {
      if (!this.affine.equals(other.affine))
        return false;
    } else {
      if (this.affine || other.affine)
        return false;
    }
    return true;
  }
}

/** A 2D cartographic point in degrees
 *  @public
 */
export interface Carto2DDegreesProps {
  /** Latitude value in degrees */
  latitude: number;
  /** Longitude value in degrees */
  longitude: number;
}

/** A 2D cartographic point in degrees
 *  @public
 */
export class Carto2DDegrees implements Carto2DDegreesProps {
  /** Latitude value in degrees. Must be between -90 and +90 included */
  private _latitude!: number;
  /** Returns or sets the latitude in degrees. When setting the provided number must be between or equal from -90 to 90. */
  public get latitude() { return this._latitude; }
  public set latitude(newLatitude: number) {
    if ((newLatitude <= 90.0) && (newLatitude >= -90.0))
      this._latitude = newLatitude;
  }
  /** Longitude value in degrees */
  public longitude!: number;

  public constructor(data?: Carto2DDegreesProps) {
    this.latitude = 0.0; /* make sure latitude is init even if invalid latitude provided */
    if (data) {
      this.latitude = data.latitude;
      this.longitude = data.longitude;
    }
  }

  /** Creates a Carto2DDegrees object from JSON representation.
   * @public */
  public static fromJSON(data: Carto2DDegreesProps): Carto2DDegrees {
    return new Carto2DDegrees(data);
  }

  /** Creates a JSON from the Carto2DDegrees definition
   * @public */
  public toJSON(): Carto2DDegreesProps {
    return { latitude: this.latitude, longitude: this.longitude };
  }

  /** Compares two Carto2DDegrees object. It is a strict compare operation.
   * It is useful for tests purposes only.
   *  @internal */
  public equals(other: Carto2DDegrees): boolean {
    return (this.latitude === other.latitude && this.longitude === other.longitude);
  }
}

