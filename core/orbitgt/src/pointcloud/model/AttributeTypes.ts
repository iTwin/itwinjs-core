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

/**
 * Class AttributeTypes defines the possible types of pointcloud attributes.
 */
/** @internal */
export class AttributeTypes {
  /** The 1-bit boolean type */
  public static readonly TYPE_BOOLEAN: int32 = 1;
  /** The 1-byte integer type */
  public static readonly TYPE_INT1: int32 = 2;
  /** The 2-byte integer type */
  public static readonly TYPE_INT2: int32 = 3;
  /** The 4-byte integer type */
  public static readonly TYPE_INT4: int32 = 4;
  /** The 8-byte integer type */
  public static readonly TYPE_INT8: int32 = 5;
  /** The 4-byte float type */
  public static readonly TYPE_FLOAT4: int32 = 6;
  /** The 8-byte float type */
  public static readonly TYPE_FLOAT8: int32 = 7;
  /** The 3-byte color type */
  public static readonly TYPE_COLOR: int32 = 8;

  /**
   * No instances.
   */
  private constructor() {}

  /**
   * Get the name of a type.
   * @param type the type of attributes.
   * @return the name.
   */
  public static getTypeName(type: int32): string {
    if (type <= 0) return "none";
    if (type == AttributeTypes.TYPE_BOOLEAN) return "boolean";
    if (type == AttributeTypes.TYPE_INT1) return "int1";
    if (type == AttributeTypes.TYPE_INT2) return "int2";
    if (type == AttributeTypes.TYPE_INT4) return "int4";
    if (type == AttributeTypes.TYPE_INT8) return "int8";
    if (type == AttributeTypes.TYPE_FLOAT4) return "float4";
    if (type == AttributeTypes.TYPE_FLOAT8) return "float8";
    if (type == AttributeTypes.TYPE_COLOR) return "color";
    return "" + type;
  }
}
