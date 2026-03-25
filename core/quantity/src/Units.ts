/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Quantity
 */

/** Typed constants for commonly used unit names from the Units schema.
 * These constants correspond to units used by the built-in quantity types and
 * eliminate the need for magic strings when referencing units programmatically.
 *
 * Usage:
 * ```typescript
 * import { Units } from "@itwin/core-quantity";
 * const unitName = Units.M;  // "Units.M"
 * ```
 * @beta
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Units {
  // Length
  /** Meter — SI base unit of length */
  export const M = "Units.M" as const;
  /** Foot */
  export const FT = "Units.FT" as const;
  /** US Survey Foot */
  export const US_SURVEY_FT = "Units.US_SURVEY_FT" as const;
  /** Inch */
  export const IN = "Units.IN" as const;
  /** Mile */
  export const MILE = "Units.MILE" as const;
  /** Yard */
  export const YRD = "Units.YRD" as const;
  /** Millimeter */
  export const MM = "Units.MM" as const;
  /** Centimeter */
  export const CM = "Units.CM" as const;
  /** Kilometer */
  export const KM = "Units.KM" as const;

  // Area
  /** Square meter — SI derived unit of area */
  export const SQ_M = "Units.SQ_M" as const;
  /** Square foot */
  export const SQ_FT = "Units.SQ_FT" as const;

  // Volume
  /** Cubic meter — SI derived unit of volume */
  export const CUB_M = "Units.CUB_M" as const;
  /** Cubic foot */
  export const CUB_FT = "Units.CUB_FT" as const;

  // Angle
  /** Radian — SI unit of plane angle */
  export const RAD = "Units.RAD" as const;
  /** Degree */
  export const DEG = "Units.DEG" as const;
  /** Arc minute */
  export const ARC_MINUTE = "Units.ARC_MINUTE" as const;
  /** Arc second */
  export const ARC_SECOND = "Units.ARC_SECOND" as const;

  // Time
  /** Second — SI base unit of time */
  export const S = "Units.S" as const;
  /** Minute */
  export const MIN = "Units.MIN" as const;
  /** Hour */
  export const HR = "Units.HR" as const;

  // Temperature
  /** Kelvin — SI base unit of temperature */
  export const K = "Units.K" as const;
  /** Celsius */
  export const CELSIUS = "Units.CELSIUS" as const;
  /** Fahrenheit */
  export const FAHRENHEIT = "Units.FAHRENHEIT" as const;

  // Mass
  /** Kilogram — SI base unit of mass */
  export const KG = "Units.KG" as const;
}
