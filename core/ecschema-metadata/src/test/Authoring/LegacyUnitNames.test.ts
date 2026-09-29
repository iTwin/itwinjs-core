/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { ecUnitNameFromLegacyName, legacyUnitNameFromECName } from "../../Authoring/LegacyUnitNames";

describe("legacy unit names", () => {
  it("maps a legacy name to its EC unit through both hops", () => {
    expect(ecUnitNameFromLegacyName("FOOT")).toBe("Units:FT");
    expect(ecUnitNameFromLegacyName("METRE")).toBe("Units:M");
    expect(ecUnitNameFromLegacyName("METRE_SQUARED")).toBe("Units:SQ_M");
    expect(ecUnitNameFromLegacyName("PASCAL")).toBe("Units:PA");
    expect(ecUnitNameFromLegacyName("DEGREE_CELSIUS")).toBe("Units:CELSIUS");
    expect(ecUnitNameFromLegacyName("DOLLAR")).toBe("Units:US_DOLLAR");
  });

  it("matches the legacy name case-insensitively", () => {
    expect(ecUnitNameFromLegacyName("foot")).toBe("Units:FT");
  });

  it("comes back the other way", () => {
    expect(legacyUnitNameFromECName("Units:FT")).toBe("FOOT");
    expect(legacyUnitNameFromECName("Units.FT")).toBe("FOOT");
    expect(legacyUnitNameFromECName("UNITS:FT")).toBe("FOOT");
    expect(legacyUnitNameFromECName("Units:M")).toBe("METRE");
  });

  it("returns undefined for a name it does not know", () => {
    expect(ecUnitNameFromLegacyName("BANANA")).toBeUndefined();
    expect(legacyUnitNameFromECName("Units:BANANA")).toBeUndefined();
  });
});
