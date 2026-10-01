/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";

// __PUBLISH_EXTRACT_START__ Quantity_Formatting.Synchronous_Formatter
import { BasicUnitsProvider, Format, FormatterSpec, Units } from "@itwin/core-quantity";

export function createSynchronousLengthFormatter(): string {
  const unitsProvider = new BasicUnitsProvider();
  const format = Format.createFromJSONSync("Length", unitsProvider, {
    type: "Decimal",
    precision: 2,
    formatTraits: ["showUnitLabel", "trailZeroes"],
    composite: { units: [{ name: Units.LENGTH.M }] },
  });
  const persistenceUnit = unitsProvider.findUnitByNameSync(Units.LENGTH.M);
  const formatterSpec = FormatterSpec.createSync("Length", format, unitsProvider, persistenceUnit);
  return formatterSpec.applyFormatting(12.5);
}
// __PUBLISH_EXTRACT_END__

describe("Synchronous quantity formatting examples", () => {
  it("constructs and applies a formatter without awaiting", () => {
    assert.strictEqual(createSynchronousLengthFormatter(), "12.50 m");
  });
});
