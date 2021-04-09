/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// cspell:ignore NAVD, NGVD

import { GeodeticDatum, GeodeticDatumProps } from "./GeodeticDatum";
import { GeodeticEllipsoid, GeodeticEllipsoidProps } from "./GeodeticEllipsoid";
import { MinMax, MinMaxProps, Projection, ProjectionProps } from "./Projection";
import { AdditionalTransform, AdditionalTransformProps } from "./AdditionalTransform";
/** This type indicates possible linear and angular units supported.
 *  @alpha
*/
export type UnitType = "Meter" | "InternationalFoot" | "USSurveyFoot" | "Degree" | "Unsupported";

/** The area in latitude, longitude bounds where a horizontal CRS is applicable
 *  @alpha
*/
export interface HorizontalCRSAreaProps {
  /* The latitude minimum and maximum for the user-defined area of the CRS */
  latitude: MinMaxProps;
  /* The longitude minimum and maximum for the user-defined area of the CRS */
  longitude: MinMaxProps;
}

/** The area in latitude, longitude bounds where a horizontal CRS is applicable
 *  @alpha
 */
export class HorizontalCRSArea implements HorizontalCRSAreaProps {
  /* The latitude minimum and maximum for the user-defined area of the CRS */
  public readonly latitude: MinMax;
  /* The longitude minimum and maximum for the user-defined area of the CRS */
  public readonly longitude: MinMax;

  public constructor(data?: HorizontalCRSAreaProps) {
    if (data) {
      this.latitude = MinMax.fromJSON(data.latitude);
      this.longitude = MinMax.fromJSON(data.longitude);
    } else {
      this.latitude = new MinMax();
      this.longitude = new MinMax();
    }
  }

  /** @internal */
  public static fromJSON(data: HorizontalCRSAreaProps): HorizontalCRSArea {
    return new HorizontalCRSArea(data);
  }

  /** @internal */
  public toJSON(): HorizontalCRSAreaProps {
    return { latitude: this.latitude.toJSON(), longitude: this.longitude.toJSON() };
  }

  /** @internal */
  public equals(other: HorizontalCRSArea): boolean {
    return this.latitude.equals(other.latitude) && this.longitude.equals(other.longitude);
  }
}

/** Horizontal Geographic Coordinate Reference System definition
 *  @alpha
 */
export interface HorizontalCRSProps {
  /** The identifier of the horizontal CRS as stored in the dictionary or the service database */
  id?: string;
  /** Used only for user-defined definitions that will typically use a GUID as id. A display name for the CRS that allows
   *  a human to understand the nature of the definition
   */
  name?: string;
  /** Description */
  description?: string;
  /** A textual description of the source of the CRS definition. */
  source?: string;
  /** If true then indicates the definition is deprecated. It should then be used for backward compatibility only.
   *  If false or undefined then the definition is not deprecated.
   */
  deprecated?: boolean;
  /** The EPSG code of the CRS. If undefined then there is no EPSG code associated. */
  epsg?: number;
  /** The identifier of the geodetic datum as stored in the dictionary or the service database. */
  datumId?: string;
  /** The complete definition of the geodetic datum referred to by datumId. It can also be used if the datum is not stored
   *  in either service or dictionary.
   */
  datum?: GeodeticDatumProps;
  /** The identifier of the geodetic ellipsoid as stored in the dictionary or the service database. This property is exclusive
   * of having datumId and datum properties undefined.
  */
  ellipsoidId?: string;
  /** The complete definition of the geodetic datum referred to by datumId. It can also be used if the datum is not stored
   *  in either service or dictionary
   */
  ellipsoid?: GeodeticEllipsoidProps;
  unit?: UnitType;
  projection?: ProjectionProps;
  area?: HorizontalCRSAreaProps;
}

/** Horizontal Geographic Coordinate reference System implementation.
 *  An horizontal CRS defines the portion which is horizontal to the Earth surface (within the deformation brought by the projection process).
 *  There are two major classes of Horizontal Coordinate Reference Systems:
 *  - The projected CRS which rely on a projection to flatten the coordinate system space into axises using linear
 *    units (meter, US Survey Feet, ...) relative to some origin.
 *  - The non projected CRS (also named geographic CRS by EPSG nomenclature) that does
 *    not require a projection (projection method = None) and horizontal coordinates are expressed
 *    as longitude and latitude (see [[Cartographic]])
 *  Horizontal Coordinate Systems rely on a projection to flatten the surface of an ellipsoid (see [[GeodeticEllipsoid]]) which is
 *  the mathematical model of the Earth surface.
 *  Explanations in more details of the various concepts can be obtained from other sources including the page on the subject
 *  on itwinJS.org (see https://www.itwinjs.org/learning/geolocation/?term=coordinate+system).
 *  A few details are still required to grasp the model. Geographic Coordinate Reference Systems rely on the concept of geodetic datums
 *  (see [[GeodeticDatum]]) to convert latitude/longitude from one frame of reference to another. Such geodetic datum will bind the ellipsoid
 *  and possibly define transformation steps required to convert from the currently used geodetic datum to the common datum WGS84
 *  used for worldwide data (such as most popular imagery data sources). If there are no rules established to convert to WGS84
 *  or if those rules are secret then the horizontal CRS can be datum-less and must make direct use of the ellipsoid
 *  to define the earth surface.
 *  For this purpose either the geodetic datum must be specified using either datumId or datum properties or both. If
 *  both these values are undefined then it is possible to define the ellipsoid using properties ellipsoidId or ellipsoid or both.
 *  These two pairs of properties are mutually exclusive with datum related properties having precedence. If a datum or datumId is set then
 *  ellipsoid properties will automatically be undefined. If datumId or datum is defined then attempts to set ellipsoidId or ellipsoid
 *  will fail silently, the values remaining undefined. The ellipsoidId will not be a repeat of the ellipsoidId property part of the
 *  geodetic datum definition.
 *  @alpha
 */
export class HorizontalCRS implements HorizontalCRSProps {
  /** The identifier of the horizontal CRS as stored in the dictionary or the service database */
  public readonly id?: string;
  /** Used only for user-defined definitions that will typically use a GUID as id. A display name for the CRS that allows
   ** a human to understand the nature of the definition
   */
  public readonly name?: string;
  /** Description */
  public readonly description?: string;
  /** The source of the CRS definition. */
  public readonly source?: string;
  /** If true then indicates the definition is deprecated. It should then be used for backward compatibility only.
   *  If false then the definition is not deprecated. Default is false.
   */
  public readonly deprecated: boolean;
  /** The EPSG code of the CRS. If undefined then there is no EPSG code associated. */
  public readonly epsg?: number;
  /** The identifier of the geodetic datum as stored in the dictionary or the service database. */
  public readonly datumId?: string;
  /** The complete definition of the geodetic datum referred to by datumId. It can also be used if the datum is not stored
   *  in either service or dictionary.
   */
  public readonly datum?: GeodeticDatum;

  /** The identifier of the geodetic ellipsoid as stored in the dictionary or the service database. This property is exclusive
   *  of having datumId and datum properties undefined.
   *  @alpha
  */
  public readonly ellipsoidId?: string;
  /** The complete definition of the geodetic ellipsoid referred to by ellipsoidId. It can also be used if the ellipsoid is not stored
   *  in either service or dictionary. This property is exclusive
   *  of having datumId and datum properties undefined.
   *  @alpha
  */
  public readonly ellipsoid?: GeodeticEllipsoid;

  public readonly unit?: UnitType;
  public readonly projection?: Projection;
  public readonly area?: HorizontalCRSArea;

  public constructor(_data?: HorizontalCRSProps) {
    this.deprecated = false;
    if (_data) {
      this.id = _data.id;
      this.description = _data.description;
      this.source = _data.source;
      this.deprecated = _data.deprecated ?? false;
      this.epsg = _data.epsg;
      this.datumId = _data.datumId;
      this.datum = _data.datum ? GeodeticDatum.fromJSON(_data.datum) : undefined;
      if (!this.datumId && !this.datum) {
        this.ellipsoidId = _data.ellipsoidId;
        this.ellipsoid = _data.ellipsoid ? GeodeticEllipsoid.fromJSON(_data.ellipsoid) : undefined;
      }
      this.unit = _data.unit;
      this.projection = _data.projection ? Projection.fromJSON(_data.projection) : undefined;
      this.area = _data.area ? HorizontalCRSArea.fromJSON(_data.area) : undefined;
    }
  }

  /** @internal */
  public static fromJSON(data: HorizontalCRSProps): HorizontalCRS {
    return new HorizontalCRS(data);
  }

  /** @internal */
  public toJSON(): HorizontalCRSProps {
    const data: HorizontalCRSProps = {};
    data.id = this.id;
    data.description = this.description;
    data.source = this.source;
    /* We prefer to use the default undef instead of false value for deprecated in Json */
    data.deprecated = (this.deprecated === false ? undefined : true);
    data.epsg = this.epsg;
    data.datumId = this.datumId;
    data.datum = this.datum ? this.datum.toJSON() : undefined;
    data.ellipsoidId = this.ellipsoidId;
    data.ellipsoid = this.ellipsoid ? this.ellipsoid.toJSON() : undefined;
    data.unit = this.unit;
    data.projection = this.projection ? this.projection.toJSON() : undefined;
    data.area = this.area ? this.area.toJSON() : undefined;
    return data;
  }

  /** @internal */
  public equals(other: HorizontalCRS): boolean {
    if (this.id !== other.id ||
      this.description !== other.description ||
      this.source !== other.source ||
      this.deprecated !== other.deprecated ||
      this.epsg !== other.epsg ||
      this.datumId !== other.datumId ||
      this.ellipsoidId !== other.ellipsoidId ||
      this.unit !== other.unit)
      return false;

    if ((this.datum === undefined) !== (other.datum === undefined))
      return false;

    if (this.datum && !this.datum.equals(other.datum!))
      return false;

    if ((this.ellipsoid === undefined) !== (other.ellipsoid === undefined))
      return false;

    if (this.ellipsoid && !this.ellipsoid.equals(other.ellipsoid!))
      return false;

    if ((this.projection === undefined) !== (other.projection === undefined))
      return false;

    if (this.projection && !this.projection.equals(other.projection!))
      return false;

    if ((this.area === undefined) !== (other.area === undefined))
      return false;

    if (this.area && !this.area.equals(other.area!))
      return false;

    return true;
  }
}

/** Vertical Geographic Coordinate reference System definition
 * @alpha
 */
export interface VerticalCRSProps {
  /** Vertical CRS Key name. */
  id: "GEOID" | "ELLIPSOID" | "NGVD29" | "NAVD88";
}

/** Vertical Coordinate reference System implementation.
 *  The VerticalCRS contains currently a single identifier property of string type. Although
 *  we currently only support four distinct key values "GEOID", "ELLIPSOID", "NAVD88" and "NGVD29"
 *  we expect to support a broader set in the future including, eventually, user defined vertical CRS
 *  which will require additional parameters to be added.
 *  @alpha
*/
export class VerticalCRS implements VerticalCRSProps {
  /** Vertical CRS Key name. The only supported values are currently "GEOID", "ELLIPSOID", "NAVD88" and "NGVD29". The default is ELLIPSOID */
  public readonly id: "GEOID" | "ELLIPSOID" | "NGVD29" | "NAVD88";

  public constructor(data?: VerticalCRSProps) {
    this.id = "ELLIPSOID";
    if (data)
      this.id = data.id;
  }

  /** @internal */
  public static fromJSON(data: VerticalCRSProps): VerticalCRS {
    return new VerticalCRS(data);
  }

  /** @internal */
  public toJSON(): VerticalCRSProps {
    return { id: this.id };
  }

  /** @internal */
  public equals(other: VerticalCRS): boolean {
    return (this.id === other.id);
  }
}

/** Geographic Coordinate Reference System definition that includes both the horizontal and vertical definitions
 *  @alpha
 */
export interface GeographicCRSProps {
  /** The horizontal portion of the geographic coordinate reference system. */
  horizontalCRS?: HorizontalCRSProps;
  /** The vertical portion of the geographic coordinate reference system. */
  verticalCRS?: VerticalCRSProps;
  /** The optional additional transform the geographic coordinate reference system. */
  additionalTransform?: AdditionalTransformProps;
}

/** Geographic Coordinate Reference System implementation. This is the class that indicates the definition of a Geographic
 *  coordinate reference system comprised of two components: Horizontal and Vertical.
 *  The vertical component (see [[VerticalCRS]]) is the simplest being formed of a simple identifier as a string.
 *  The horizontal component contains a list of identification and documentation properties as well as
 *  defining details possibly including the projection with method and parameters, the definition of the datum, ellipsoid, area and so on.
 *  The principle of describing a Geographic CRS is that the definition may be incomplete. The whole set of classes related to geographic
 *  coordinate reference system classes ([[GeodeticEllipsoid]], [[GeodeticDatum]], [[Projection]], [[GeodeticTransform]], ...) are designed
 *  so that they can be parsed from incomplete JSON fragments, or produce incomplete JSON fragments such as would be
 *  generated from a request to a REST API to a server when select OData clauses are used.
 *  Often GeographicCRS would knowingly be created incomplete but with sufficient information to perform conversion from some
 *  reprojection engine (the present set of classes do not provide any GeographicCRS conversion).
 *  For example the following definitions are quite sufficient to request conversion to or from by a reprojection engine:
 *  { horizontalCRS: {id: "LL84"}, verticalCRS: {id:"GEOID"}
 *  or
 *  { horizontalCRS: {datumId: "WGS84", projection: {method: "None"}}, verticalCRS: "ELLIPSOID"}
 *  The reprojection engine will use the engine internal dictionary to obtain the details if it can.
 *  Some definitions will originate from other sources (a parsed WKT for example) and the reprojection engine will require
 *  all mathematical and operational details to perform any conversion (descriptive information are ignored in the conversion process).
 *  @note In the absence of the verticalCRS property then ELLIPSOID (Geodetic elevation) will be assumed by reprojection engines.
 *  @note see important detailed explanation in the [[HorizontalCRS]] documentation.
 *  @note Earth Centered, Earth Fixed coordinate system (ECEF) is a full 3D cartesian system that unambiguously
 *        expressed coordinates relative to the Earth Center. Since there is no horizontal portion independent from
 *        the vertical portion this system cannot be represented by a GeographicCRS and remains a separate concept.
 *  @alpha
*/
export class GeographicCRS implements GeographicCRSProps {
  /** The horizontal portion of the geographic coordinate reference system. */
  public readonly horizontalCRS?: HorizontalCRS;
  /** The vertical portion of the geographic coordinate reference system. */
  public readonly verticalCRS?: VerticalCRS;
  /** The optional additional transform the geographic coordinate reference system. */
  public readonly additionalTransform?: AdditionalTransform;

  public constructor(data?: GeographicCRSProps) {
    if (data) {
      this.horizontalCRS = data.horizontalCRS ? HorizontalCRS.fromJSON(data.horizontalCRS) : undefined;
      this.verticalCRS = data.verticalCRS ? VerticalCRS.fromJSON(data.verticalCRS) : undefined;
      this.additionalTransform = data.additionalTransform ? AdditionalTransform.fromJSON(data.additionalTransform) : undefined;
    }
  }

  /** @internal */
  public static fromJSON(data: GeographicCRSProps): GeographicCRS {
    return new GeographicCRS(data);
  }

  /** @internal */
  public toJSON(): GeographicCRSProps {
    const data: GeographicCRSProps = {};
    data.horizontalCRS = this.horizontalCRS ? this.horizontalCRS.toJSON() : undefined;
    data.verticalCRS = this.verticalCRS ? this.verticalCRS.toJSON() : undefined;
    data.additionalTransform = this.additionalTransform ? this.additionalTransform.toJSON() : undefined;
    return data;
  }

  /** @internal */
  public equals(other: GeographicCRS): boolean {
    if ((this.horizontalCRS === undefined) !== (other.horizontalCRS === undefined))
      return false;

    if (this.horizontalCRS && !this.horizontalCRS.equals(other.horizontalCRS!))
      return false;

    if ((this.verticalCRS === undefined) !== (other.verticalCRS === undefined))
      return false;

    if (this.verticalCRS && !this.verticalCRS.equals(other.verticalCRS!))
      return false;

    if ((this.additionalTransform === undefined) !== (other.additionalTransform === undefined))
      return false;

    if (this.additionalTransform && !this.additionalTransform.equals(other.additionalTransform!))
      return false;

    return true;
  }
}

