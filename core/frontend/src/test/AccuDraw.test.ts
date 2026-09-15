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

// Regression test for itwinjs-core#9465: bearing formatting must be measured from north
// exactly once, whether that conversion happens in AccuDraw or in core-quantity.
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
