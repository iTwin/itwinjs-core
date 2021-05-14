/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Geometry
 */

/** This interface defines the mathematical model of the Earth shape in the form of an ellipsoid.
 *  There are various ways to define an ellipsoid but we have retained the definition based on the polar and equatorial radiuses.
 *  The other ellipsoid properties, such as flattening and inverse flattening, can be obtained using
 *  the simple equations that are defined at:
 *  https://en.wikipedia.org/wiki/Flattening and https://en.wikipedia.org/wiki/Earth_ellipsoid.
 *  @public
 */
export interface GeodeticEllipsoidProps {
  /** Ellipsoid key name */
  id?: string;
  /** Description of the ellipsoid */
  description?: string;
  /** If true then indicates the definition is deprecated. It should then be used for backward compatibility only.
   *  If false or undefined then the definition is not deprecated.
   */
  deprecated?: boolean;
  /** The textual description of the source of the ellipsoid definition. */
  source?: string;
  /** The EPSG code of the ellipsoid. If undefined then there is no EPSG code associated. */
  epsg?: number;
  /** The equatorial radius of the ellipsoid in meters */
  equatorialRadius?: number;
  /** The polar radius of the ellipsoid in meters*/
  polarRadius?: number;
}

/** This class defines the mathematical model of the Earth shape in the form of an ellipsoid.
 *  There are various ways to define an ellipsoid but we have retained the definition based on the polar and equatorial radiuses.
 *  The other ellipsoid properties, such as flattening and inverse flattening, can be obtained using
 *  the simple equations that are defined at:
 *  https://en.wikipedia.org/wiki/Flattening and https://en.wikipedia.org/wiki/Earth_ellipsoid.
 *  The present class only implements the definition of the ellipsoid. No processing is performed here. If ellipsoid based computation
 *  are required refer to [[Ellipsoid]] in core/geometry package.
 *  The class only serves to describe a geodetic ellipsoid and can be partially or fully defined.
 *  For a lot of purposes simply setting the id property is sufficient to describe the ellipsoid in most cases
 *  as the mathematical properties (equatorial and polar radiuses) will be often extracted from the dictionary
 *  of commonly known ellipsoids by the reprojection engine used.
 *  @public
 */
export class GeodeticEllipsoid implements GeodeticEllipsoidProps {
  /** Ellipsoid key name */
  public readonly id?: string;
  /** Description of the ellipsoid */
  public readonly description?: string;
  /** If true then indicates the definition is deprecated. It should then be used for backward compatibility only.
   *  If false then the definition is not deprecated. Default is false.
   */
  public readonly deprecated: boolean;
  /** The textual description of the source of the ellipsoid definition. */
  public readonly source?: string;
  /** The EPSG code of the ellipsoid. If undefined then there is no EPSG code associated. */
  public readonly epsg?: number;
  /** The equatorial radius of the ellipsoid in meters. */
  public readonly equatorialRadius?: number;
  /** The polar radius of the ellipsoid in meters. */
  public readonly polarRadius?: number;

  public constructor(data?: GeodeticEllipsoidProps) {
    this.deprecated = false;
    if (data) {
      this.id = data.id;
      this.description = data.description;
      this.deprecated = data.deprecated ?? false;
      this.source = data.source;
      this.epsg = data.epsg;
      this.equatorialRadius = data.equatorialRadius;
      this.polarRadius = data.polarRadius;
    }
  }

  /** Creates a Geodetic Ellipsoid from JSON representation.
   * @public */
  public static fromJSON(data: GeodeticEllipsoidProps): GeodeticEllipsoid {
    return new GeodeticEllipsoid(data);
  }

  /** Creates a JSON from the Geodetic Ellipsoid definition
   * @public */
  public toJSON(): GeodeticEllipsoidProps {
    const data: GeodeticEllipsoidProps = { equatorialRadius: this.equatorialRadius, polarRadius: this.polarRadius };
    data.id = this.id;
    data.description = this.description;
    /* We prefer to use the default undef instead of false value for deprecated in Json */
    data.deprecated = (this.deprecated === false ? undefined : true);
    data.source = this.source;
    data.epsg = this.epsg;
    data.equatorialRadius = this.equatorialRadius;
    data.polarRadius = this.polarRadius;
    return data;
  }

  /** Compares two Geodetic Ellipsoid. It is a strict compare operation not an equivalence test.
   * It takes into account descriptive properties not only mathematical definition properties.
   * It is useful for tests purposes only.
   *  @internal */
  public equals(other: GeodeticEllipsoid): boolean {
    return this.id === other.id &&
      this.description === other.description &&
      this.deprecated === other.deprecated &&
      this.source === other.source &&
      this.epsg === other.epsg &&
      this.equatorialRadius === other.equatorialRadius &&
      this.polarRadius === other.polarRadius;
  }
}

