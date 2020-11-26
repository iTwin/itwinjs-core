/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** This interface defines the mathematical model of the Earth shape in the form of an ellipsoid.
 *  There are various ways to define an ellipsoid but we have retained the definition based on the polar and equatorial radiuses.
 *  The other ellipsoid properties, such as flattening and inverse flattening, can be obtained using
 *  the simple equations that are defined at:
 *  https://en.wikipedia.org/wiki/Flattening and https://en.wikipedia.org/wiki/Earth_ellipsoid.
 *  @alpha
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
 *  @alpha
 */
export class GeodeticEllipsoid implements GeodeticEllipsoidProps {
  /** Ellipsoid key name */
  public id?: string;
  /** Description of the ellipsoid */
  public description?: string;
  /** If true then indicates the definition is deprecated. It should then be used for backward compatibility only.
   *  If false then the definition is not deprecated. Default is false.
   */
  public deprecated: boolean;
  /** The textual description of the source of the ellipsoid definition. */
  public source?: string;
  /** The EPSG code of the ellipsoid. If undefined then there is no EPSG code associated. */
  public epsg?: number;
  /** The equatorial radius of the ellipsoid in meters. */
  public equatorialRadius?: number;
  /** The polar radius of the ellipsoid in meters. */
  public polarRadius?: number;

  public constructor(data?: GeodeticEllipsoidProps) {
    this.deprecated = false;
    this.initialize(data);
  }

  /** @internal */
  public initialize(_data?: GeodeticEllipsoidProps) {
    if (_data) {
      this.id = _data.id;
      this.description = _data.description;
      this.deprecated = (_data.deprecated ? _data.deprecated : false);
      this.source = _data.source;
      this.epsg = _data.epsg;
      this.equatorialRadius = _data.equatorialRadius;
      this.polarRadius = _data.polarRadius;
    }
  }

  /** @internal */
  public static fromJSON(data: GeodeticEllipsoidProps): GeodeticEllipsoid {
    return new GeodeticEllipsoid(data);
  }

  /** @internal */
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

  /** @internal */
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

