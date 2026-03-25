/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { Units } from "../Units";

describe("Units namespace", () => {
  it("length units have correct string values", () => {
    expect(Units.M).toBe("Units.M");
    expect(Units.FT).toBe("Units.FT");
    expect(Units.US_SURVEY_FT).toBe("Units.US_SURVEY_FT");
    expect(Units.IN).toBe("Units.IN");
    expect(Units.MILE).toBe("Units.MILE");
    expect(Units.YRD).toBe("Units.YRD");
    expect(Units.MM).toBe("Units.MM");
    expect(Units.CM).toBe("Units.CM");
    expect(Units.KM).toBe("Units.KM");
  });

  it("area units have correct string values", () => {
    expect(Units.SQ_M).toBe("Units.SQ_M");
    expect(Units.SQ_FT).toBe("Units.SQ_FT");
  });

  it("volume units have correct string values", () => {
    expect(Units.CUB_M).toBe("Units.CUB_M");
    expect(Units.CUB_FT).toBe("Units.CUB_FT");
  });

  it("angle units have correct string values", () => {
    expect(Units.RAD).toBe("Units.RAD");
    expect(Units.DEG).toBe("Units.DEG");
    expect(Units.ARC_MINUTE).toBe("Units.ARC_MINUTE");
    expect(Units.ARC_SECOND).toBe("Units.ARC_SECOND");
  });

  it("time units have correct string values", () => {
    expect(Units.S).toBe("Units.S");
    expect(Units.MIN).toBe("Units.MIN");
    expect(Units.HR).toBe("Units.HR");
  });

  it("temperature units have correct string values", () => {
    expect(Units.K).toBe("Units.K");
    expect(Units.CELSIUS).toBe("Units.CELSIUS");
    expect(Units.FAHRENHEIT).toBe("Units.FAHRENHEIT");
  });

  it("mass units have correct string values", () => {
    expect(Units.KG).toBe("Units.KG");
  });

  it("constants are string type at compile time", () => {
    // Verify const assertions produce literal types
    const m: "Units.M" = Units.M;
    const ft: "Units.FT" = Units.FT;
    expect(m).toBe("Units.M");
    expect(ft).toBe("Units.FT");
  });
});
