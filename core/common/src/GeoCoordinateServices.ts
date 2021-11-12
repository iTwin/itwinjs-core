/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { GeoServiceStatus } from "@itwin/core-bentley";
import { XYZProps } from "@itwin/core-geometry";

/** This enumeration lists all possible status as returned from a coordinate conversion to or from a
 * [[GeographicCRS]] and either another [[GeographicCRS]] or a [[GeodeticDatum]].
 * @see the [[PointWithStatus]] included in an [[IModelCoordinatesResponseProps]] or [[GeoCoordinatesResponseProps]].
 * @public
 */
export enum GeoCoordStatus {
  /** Indicates successful coordinate conversion. */
  Success = 0,
  /** Indicates that the source or target of the conversion is not defined, usually the iModel Geographic Coordinate Reference System.*/
  NoGCSDefined = 100,
  /** This value indicates that the conversion was performed outside of the normal use of application of either Geographic Coordinate Reference Systems.
   *  This return value can often be treated as a warning in specific cases. For example, global imagery extent spans the whole globe and
   *  may extend far beyond the normal area of the iModel project extents and the extent of normal use of its Geographic Coordinate Reference System.
   *  In such cases this value can be considered a warning as accuracy and precision is not expected in this specific case and approximate localization
   *  of global imagery or other low accuracy context data is not essential far from the project.
   *  If this status is returned for high accuracy data then it indicates that either Geographic Coordinate Reference Systems were inappropriately selected
   *  for the iModel or other geolocated data. If this is the case the status should be somehow reported so action
   *  can be performed to verify used geolocation parameters.
   *  In either case the returned coordinates are to be considered valid though they may be inaccurate or result in some unexpected distortion of graphical
   *  elements.
   */
  OutOfUsefulRange = 1,
  /** Indicates a hard error where conversions were requested outside of the area of the mathematical capacity of the conversion process for either
   *  Geographic Coordinate Reference Systems involved. An example could be to attempt a conversion involving a Transverse Mercator more than 60 degrees
   *  East or West of the projection central meridian.
   *  The values returned may or may not be valid and should be discarded.
   */
  OutOfMathematicalDomain = 2,
  /** Indicates that datum transformation between the two Geographic Coordinate Reference Systems could not be performed.
   *  This error is usually the result of a datum transformation path requiring use of latitude/longitude grid shift files that could not be obtained
   *  or installed. In this case the latitude/longitude transformation is bypassed but the remainder of the conversion process is completed.
   *  This error can be ignored for low accuracy data but should be somehow reported so actions can be performed to provide the missing files.
   */
  NoDatumConverter = 25,
  /** Indicates that a problem occurred during vertical datum conversion. This may the result of the inability to access the
   *  Geoid separation data or vertical datum differential data (such as used by NGVD29 to NAVD88 conversion).
   *  The horizontal coordinates returned are valid but the elevation ordinate will be returned unchanged or partially changed.
   *  This status should be somehow reported so actions can be performed to provide the missing information.
   */
  VerticalDatumConvertError = 26,
  /** General inner conversion engine error. Coordinates returned are invalid and should be discarded */
  CSMapError = 4096,
  /** This temporary status is used to mark coordinates for which the conversion has not yet been processed by the backend
   *  as opposed to other coordinate conversions that may have been resolved otherwise (typically a cache).
   *  At the completion of the conversion promise no coordinates should have this status.
   */
  Pending = -41556,
}

/** Maps a GeoCoordStatus to the equivalent GeoServiceStatus.
 * @public
 */
export function mapToGeoServiceStatus(s: GeoCoordStatus): GeoServiceStatus {
  switch (s) {
    case GeoCoordStatus.Success: return GeoServiceStatus.Success;
    case GeoCoordStatus.NoGCSDefined: return GeoServiceStatus.NoGeoLocation;
    case GeoCoordStatus.OutOfUsefulRange: return GeoServiceStatus.OutOfUsefulRange;
    case GeoCoordStatus.OutOfMathematicalDomain: return GeoServiceStatus.OutOfMathematicalDomain;
    case GeoCoordStatus.NoDatumConverter: return GeoServiceStatus.NoDatumConverter;
    case GeoCoordStatus.VerticalDatumConvertError: return GeoServiceStatus.VerticalDatumConvertError;
    case GeoCoordStatus.CSMapError: return GeoServiceStatus.CSMapError;
    case GeoCoordStatus.Pending: return GeoServiceStatus.Pending;
    default:
      throw new Error("GeoCoordStatus -> GeoServiceStatus - Missing enum conversion");
  }
}

/** Information required to request conversion of an array of Geographic coordinates (Longitude/Latitude) to iModel coordinates
 * @beta
 */
export interface IModelCoordinatesRequestProps {
  source: string;
  geoCoords: XYZProps[];
}

/** Information returned from a request to convert an array of Geographic coordinates (Longitude/Latitude) to iModel coordinates
 * @beta
 */
export interface PointWithStatus {
  p: XYZProps;
  s: GeoCoordStatus;
}

/** @beta */
export interface IModelCoordinatesResponseProps {
  iModelCoords: PointWithStatus[];
  fromCache: number;    // the number that were read from the cache rather than calculated.
}

/** Information required to request conversion of an array of iModel coordinates to Geographic Coordinates (longitude and latitude)
 * @beta
 */
export interface GeoCoordinatesRequestProps {
  target: string;
  iModelCoords: XYZProps[];
}

/** Information returned from a request to convert an array of iModel coordinates to Geographic Coordinates (longitude and latitude)
 * @beta
 */
export interface GeoCoordinatesResponseProps {
  geoCoords: PointWithStatus[];
  fromCache: number;    // the number that were read from the cache rather than calculated.
}
