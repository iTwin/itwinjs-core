/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

//package orbitgt.pointcloud.model;

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

import { AttributeTypes } from "./AttributeTypes";
import { AttributeValue } from "./AttributeValue";
import { PointAttribute } from "./PointAttribute";

/**
 * Class StandardAttributes defines some common attributes for pointclouds.
 *
 * @version 1.0 October 2013
 */
/** @internal */
export class StandardAttributes {
  /** The standard "color" attribute */
  public static readonly COLOR: PointAttribute = new PointAttribute(
    "Color",
    "The RGB color",
    AttributeTypes.TYPE_COLOR,
    AttributeValue.createColor(0)
  );
  /** The standard "intensity" attribute */
  public static readonly INTENSITY: PointAttribute = new PointAttribute(
    "Intensity",
    "The reflection intensity",
    AttributeTypes.TYPE_INT2,
    AttributeValue.createInt2(0)
  );
  /** The standard "gps-time" attribute */
  public static readonly GPS_TIME: PointAttribute = new PointAttribute(
    "GPSTime",
    "The registration time of the point",
    AttributeTypes.TYPE_FLOAT8,
    AttributeValue.createFloat8(0.0)
  );
  /** The standard "weight" attribute */
  public static readonly WEIGHT: PointAttribute = new PointAttribute(
    "Weight",
    "The weight of a multi-resolution point",
    AttributeTypes.TYPE_INT4,
    AttributeValue.createInt4(0)
  );
  /** The standard "clearance" attribute */
  public static readonly CLEARANCE: PointAttribute = new PointAttribute(
    "Clearance",
    "The vertical clearance of a bridge or road",
    AttributeTypes.TYPE_FLOAT4,
    AttributeValue.createFloat4(0.0)
  );
  /** The standard "rutting" attribute */
  public static readonly RUTTING: PointAttribute = new PointAttribute(
    "Rutting",
    "The road deformation angle",
    AttributeTypes.TYPE_FLOAT4,
    AttributeValue.createFloat4(0.0)
  ); // range 0..90 deg
  /** The standard "color-by" attribute */
  public static readonly COLOR_BY: PointAttribute = new PointAttribute(
    "ColorBy",
    "The attribute to modulate the point colors",
    AttributeTypes.TYPE_FLOAT4,
    AttributeValue.createFloat4(0.0)
  );

  /** The default "gps-time" attribute value */
  public static readonly DEFAULT_GPS_TIME: AttributeValue =
    AttributeValue.createFloat8(0.0);

  /** The "adjusted" gps time offset (The offset moves the time back to near zero to improve floating point resolution).
        See the "GPS Time Type" field in "LAS SPECIFICATION VERSION 1.3" */
  public static readonly GPS_TIME_OFFSET: float64 = 1.0e9;
  /** The number of seconds in a week (7*24*3600) */
  public static readonly GPS_WEEK_SECONDS: float64 = 604800.0;

  /**
   * No instances.
   */
  private constructor() {}
}
