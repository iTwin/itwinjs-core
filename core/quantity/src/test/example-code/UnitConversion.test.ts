/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { UnitSchemaNames } from "../../generated/Units.generated";
import { UnitConversions } from "../../UnitConversions";

describe("Quantity unit conversion examples", () => {
  it("One-off conversion", () => {
    // __PUBLISH_EXTRACT_START__ Quantity_UnitConversion.Convert
    const feet = UnitConversions.convert(
      UnitSchemaNames.Units.M,
      UnitSchemaNames.Units.FT,
      1,
    );
    // __PUBLISH_EXTRACT_END__

    expect(feet).toBeCloseTo(3.28084, 5);
  });

  it("Repeated conversion", () => {
    // __PUBLISH_EXTRACT_START__ Quantity_UnitConversion.Repeated_Convert
    const conversion = UnitConversions.getConversion(
      UnitSchemaNames.Units.M,
      UnitSchemaNames.Units.FT,
    );

    const feet1 = UnitConversions.convertValue(1, conversion);
    const feet2 = UnitConversions.convertValue(2, conversion);
    // __PUBLISH_EXTRACT_END__

    expect(feet1).toBeCloseTo(3.28084, 5);
    expect(feet2).toBeCloseTo(6.56168, 5);
  });

  it("Compatibility check", () => {
    // __PUBLISH_EXTRACT_START__ Quantity_UnitConversion.IsCompatible
    const isLengthConversion = UnitConversions.isCompatible(
      UnitSchemaNames.Units.M,
      UnitSchemaNames.Units.FT,
    );
    // __PUBLISH_EXTRACT_END__

    expect(isLengthConversion).toBe(true);
  });
});
