/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { UnitConversions, Units } from "@itwin/core-quantity";

// __PUBLISH_EXTRACT_START__ Quantity_UnitConversion.Convert
/** Convert a built-in canonical unit value synchronously. */
export function convertMetersToFeet() {
  return UnitConversions.convert(
    Units.LENGTH.M,
    Units.LENGTH.FT,
    1,
  );
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ Quantity_UnitConversion.Repeated_Convert
/** Resolve a built-in conversion once and reuse it. */
export function convertMetersToFeetRepeatedly() {
  const conversion = UnitConversions.getConversion(
    Units.LENGTH.M,
    Units.LENGTH.FT,
  );

  return {
    feet1: UnitConversions.convertValue(1, conversion),
    feet2: UnitConversions.convertValue(2, conversion),
  };
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ Quantity_UnitConversion.IsCompatible
/** Check whether two built-in canonical units are compatible. */
export function isLengthConversionCompatible() {
  return UnitConversions.isCompatible(
    Units.LENGTH.M,
    Units.LENGTH.FT,
  );
}
// __PUBLISH_EXTRACT_END__
