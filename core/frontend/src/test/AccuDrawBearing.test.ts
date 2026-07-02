/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { EmptyLocalization } from "@itwin/core-common";
import { FormatProps } from "@itwin/core-quantity";
import { ItemField } from "../AccuDraw";
import { IModelApp } from "../IModelApp";
import { QuantityType } from "../quantity-formatting/QuantityFormatter";

// Regression coverage for itwinjs-core#9465: AccuDraw historically applied its own
// "measured from north" (90-theta) conversion in `stringFromAngle` whenever `bearingFixedToPlane2d`
// is enabled, because `@itwin/core-quantity`'s Bearing/Azimuth formatting used to always assume the
// persisted magnitude was a raw mathematical angle (measured counter-clockwise from east). Now that
// core-quantity applies that conversion itself -- but only when `persistenceUnit.phenomenon` is
// `Units.ANGLE`, leaving `Units.HORIZONTAL_DIRECTION`-persisted values untouched -- AccuDraw's manual
// correction is redundant and must be removed to avoid double-applying the transform.
//
// `QuantityType.Angle`'s persistence unit is `Units.RAD` (an `Units.ANGLE` phenomenon unit), so this
// suite asserts the *end-to-end* formatted output for a raw math angle in bearing/plane-fixed mode,
// independent of whether the 90-theta conversion happens inside AccuDraw or inside core-quantity.
describe("AccuDraw bearing formatting (plane-fixed)", () => {
  const bearingFormatProps: FormatProps = {
    type: "Bearing",
    revolutionUnit: "Units.REVOLUTION",
    precision: 0,
    formatTraits: ["showUnitLabel"],
    uomSeparator: "",
    composite: {
      includeZero: true,
      spacer: "",
      units: [
        { label: "°", name: "Units.ARC_DEG" },
        { label: "'", name: "Units.ARC_MINUTE" },
        { label: "\"", name: "Units.ARC_SECOND" },
      ],
    },
  };

  beforeAll(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
    await IModelApp.quantityFormatter.setOverrideFormat(QuantityType.Angle, bearingFormatProps);
  });

  afterAll(async () => {
    await IModelApp.quantityFormatter.clearOverrideFormats(QuantityType.Angle);
    await IModelApp.shutdown();
  });

  beforeEach(() => {
    IModelApp.accuDraw.bearingFixedToPlane2d = true;
  });

  const testCases = [
    // mathAngle (rad, measured counter-clockwise from east) -> expected bearing string
    { mathAngle: 0.0, expected: `N90°0'0"E` },
    { mathAngle: Math.PI / 2, expected: `N0°0'0"E` },
    { mathAngle: Math.PI, expected: `N90°0'0"W` },
    { mathAngle: -Math.PI / 2, expected: `S0°0'0"E` },
    { mathAngle: Math.PI / 4, expected: `N45°0'0"E` },
  ];

  for (const { mathAngle, expected } of testCases) {
    it(`formats raw math angle ${mathAngle.toFixed(4)} rad as bearing ${expected}`, () => {
      IModelApp.accuDraw.setValueByIndex(ItemField.ANGLE_Item, mathAngle);
      const formatted = IModelApp.accuDraw.getFormattedValueByIndex(ItemField.ANGLE_Item);
      expect(formatted).toBe(expected);
    });
  }
});
