/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { Format } from "../Formatter/Format";
import { Formatter } from "../Formatter/Formatter";
import { FormatterSpec } from "../Formatter/FormatterSpec";
import { TestUnitsProvider } from "./TestUtils/TestHelper";

describe("StationBaseFactor formatting behavior tests:", () => {
  const unitsProvider = new TestUnitsProvider();

  /**
   * Helper function to test station formatting with specific parameters
   */
  async function testStationFormatting(
    magnitude: number,
    stationBaseFactor: number | undefined,
    stationOffsetSize: number,
    expectedOutput: string
  ): Promise<void> {
    const formatProps = {
      formatTraits: ["trailZeroes", "keepSingleZero", "keepDecimalPoint"],
      precision: 2,
      stationOffsetSize,
      stationBaseFactor,
      stationSeparator: "+",
      type: "Station" as const,
    };

    const format = new Format("testStation");
    await format.fromJSON(unitsProvider, formatProps);

    // Create a basic unit for the persistence unit (assuming meters for consistency with existing tests)
    const persistenceUnit = await unitsProvider.findUnitByName("Units.M");
    if (!persistenceUnit)
      throw new Error("Could not find persistence unit");

    const spec = await FormatterSpec.create("testStation", format, unitsProvider, persistenceUnit);

    const result = Formatter.formatQuantity(magnitude, spec);
    expect(result).toEqual(expectedOutput);
  }

  it("Default stationBaseFactor (1) with different stationOffsetSize values", async () => {
    // With stationOffsetSize = 2, denominator = 1 * 10^2 = 100
    await testStationFormatting(12345.67, undefined, 2, "123+45.67");

    // With stationOffsetSize = 3, denominator = 1 * 10^3 = 1000
    await testStationFormatting(12345.67, undefined, 3, "12+345.67");

    // With stationOffsetSize = 4, denominator = 1 * 10^4 = 10000
    await testStationFormatting(12345.67, undefined, 4, "1+2345.67");
  });

  it("stationBaseFactor = 1 (explicitly set) behaves same as default", async () => {
    // Should behave identically to undefined (default)
    await testStationFormatting(12345.67, 1, 2, "123+45.67");
    await testStationFormatting(12345.67, 1, 3, "12+345.67");
    await testStationFormatting(12345.67, 1, 4, "1+2345.67");
  });

  it("stationBaseFactor = 2 doubles the denominator", async () => {
    // With stationOffsetSize = 2, denominator = 2 * 10^2 = 200
    await testStationFormatting(12345.67, 2, 2, "61+145.67");

    // With stationOffsetSize = 3, denominator = 2 * 10^3 = 2000
    await testStationFormatting(12345.67, 2, 3, "6+345.67");
  });

  it("stationBaseFactor = 5 multiplies denominator by 5", async () => {
    // With stationOffsetSize = 2, denominator = 5 * 10^2 = 500
    await testStationFormatting(12345.67, 5, 2, "24+345.67");

    // With stationOffsetSize = 3, denominator = 5 * 10^3 = 5000
    await testStationFormatting(12345.67, 5, 3, "2+2345.67");
  });

  it("stationBaseFactor = 10 increases scale by factor of 10", async () => {
    // With stationOffsetSize = 2, denominator = 10 * 10^2 = 1000
    await testStationFormatting(12345.67, 10, 2, "12+345.67");

    // With stationOffsetSize = 3, denominator = 10 * 10^3 = 10000
    await testStationFormatting(12345.67, 10, 3, "1+2345.67");
  });

  it("Small magnitude values with different stationBaseFactor", async () => {
    // Test with magnitude smaller than denominator
    await testStationFormatting(50.25, undefined, 2, "0+50.25"); // denominator = 100
    await testStationFormatting(50.25, 2, 2, "0+50.25"); // denominator = 200
    await testStationFormatting(250.25, 5, 2, "0+250.25"); // denominator = 500
  });

  it("Zero magnitude formatting", async () => {
    await testStationFormatting(0, undefined, 2, "0+00.00");
    await testStationFormatting(0, 5, 3, "0+000.00");
    await testStationFormatting(0, 2, 2, "0+00.00");
  });

  it("Large magnitude values with stationBaseFactor", async () => {
    // Test with very large values
    await testStationFormatting(1234567.89, undefined, 3, "1234+567.89"); // denominator = 1000
    await testStationFormatting(1234567.89, 2, 3, "617+567.89"); // denominator = 2000
    await testStationFormatting(1234567.89, 10, 3, "123+4567.89"); // denominator = 10000
  });

  it("Different precision values with stationBaseFactor", async () => {
    const formatProps = {
      formatTraits: ["trailZeroes", "keepSingleZero", "keepDecimalPoint"],
      precision: 0, // No decimal places
      stationOffsetSize: 2,
      stationBaseFactor: 2,
      stationSeparator: "+",
      type: "Station" as const,
    };

    const format = new Format("testStation");
    await format.fromJSON(unitsProvider, formatProps);

    const persistenceUnit = await unitsProvider.findUnitByName("Units.M");
    if (!persistenceUnit)
      throw new Error("Could not find persistence unit");

    const spec = await FormatterSpec.create("testStation", format, unitsProvider, persistenceUnit);

    const result = Formatter.formatQuantity(12345.67, spec);
    expect(result).toEqual("61+146."); // No decimal places, rounded, but decimal point kept due to keepDecimalPoint trait
  });

  it("Different stationSeparator with stationBaseFactor", async () => {
    const formatProps = {
      formatTraits: ["trailZeroes", "keepSingleZero", "keepDecimalPoint"],
      precision: 2,
      stationOffsetSize: 2,
      stationBaseFactor: 5,
      stationSeparator: "-",
      type: "Station" as const,
    };

    const format = new Format("testStation");
    await format.fromJSON(unitsProvider, formatProps);

    const persistenceUnit = await unitsProvider.findUnitByName("Units.M");
    if (!persistenceUnit)
      throw new Error("Could not find persistence unit");

    const spec = await FormatterSpec.create("testStation", format, unitsProvider, persistenceUnit);

    const result = Formatter.formatQuantity(12345.67, spec);
    expect(result).toEqual("24-345.67");
  });

  it("Edge case: stationBaseFactor with very small offset size", async () => {
    // stationOffsetSize = 1, denominator = 5 * 10^1 = 50
    // hiPart = floor(12345/50) = 246, lowPart = 12345 - 246*50 = 45
    // lowPart padded to 1 digit is still "45" since it's longer than 1
    await testStationFormatting(12345.67, 5, 1, "246+45.67");
  });

  it("Edge case: very large stationBaseFactor", async () => {
    // stationBaseFactor = 1000, stationOffsetSize = 2, denominator = 1000 * 100 = 100000
    await testStationFormatting(123456.78, 1000, 2, "1+23456.78");
  });

  it("Mathematical consistency: changing stationBaseFactor affects hiPart calculation", async () => {
    const magnitude = 5000;

    // Default: denominator = 1 * 10^2 = 100, hiPart = floor(5000/100) = 50
    await testStationFormatting(magnitude, undefined, 2, "50+00.00");

    // stationBaseFactor = 2: denominator = 2 * 10^2 = 200, hiPart = floor(5000/200) = 25
    await testStationFormatting(magnitude, 2, 2, "25+00.00");

    // stationBaseFactor = 5: denominator = 5 * 10^2 = 500, hiPart = floor(5000/500) = 10
    await testStationFormatting(magnitude, 5, 2, "10+00.00");

    // stationBaseFactor = 10: denominator = 10 * 10^2 = 1000, hiPart = floor(5000/1000) = 5
    await testStationFormatting(magnitude, 10, 2, "5+00.00");
  });
});
