/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { BasicUnitsProvider } from "../../BasicUnitsProvider";
import { UnitSchemaNames } from "../../generated/Units.generated";
import { UnitConversions } from "../../UnitConversions";

describe("Quantity unit conversion examples", () => {
  it("Basic one-off conversion", () => {
    // __PUBLISH_EXTRACT_START__ Quantity_UnitConversion.Basic_Convert
    const feet = UnitConversions.convertBasic(
      UnitSchemaNames.Units.M,
      UnitSchemaNames.Units.FT,
      1,
    );
    // __PUBLISH_EXTRACT_END__

    expect(feet).toBeCloseTo(3.28084, 5);
  });

  it("Basic repeated conversion", () => {
    // __PUBLISH_EXTRACT_START__ Quantity_UnitConversion.Basic_Repeated_Convert
    const conversion = UnitConversions.getBasicConversion(
      UnitSchemaNames.Units.M,
      UnitSchemaNames.Units.FT,
    );

    const feet1 = UnitConversions.convertValue(1, conversion);
    const feet2 = UnitConversions.convertValue(2, conversion);
    // __PUBLISH_EXTRACT_END__

    expect(feet1).toBeCloseTo(3.28084, 5);
    expect(feet2).toBeCloseTo(6.56168, 5);
  });

  it("Provider-backed conversion", async () => {
    // __PUBLISH_EXTRACT_START__ Quantity_UnitConversion.Provider_Convert
    const provider = new BasicUnitsProvider();
    const feet = await UnitConversions.convert(
      provider,
      UnitSchemaNames.Units.M,
      UnitSchemaNames.Units.FT,
      1,
    );
    // __PUBLISH_EXTRACT_END__

    expect(feet).toBeCloseTo(3.28084, 5);
  });
});
