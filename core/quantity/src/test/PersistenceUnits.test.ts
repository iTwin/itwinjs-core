/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { findPersistenceUnitForPhenomenon } from "../PersistenceUnits";

describe("findPersistenceUnitForPhenomenon", () => {
  it("returns correct SI unit for all standard phenomena", () => {
    expect(findPersistenceUnitForPhenomenon("LENGTH")).toBe("Units.M");
    expect(findPersistenceUnitForPhenomenon("AREA")).toBe("Units.SQ_M");
    expect(findPersistenceUnitForPhenomenon("VOLUME")).toBe("Units.CUB_M");
    expect(findPersistenceUnitForPhenomenon("PLANE_ANGLE")).toBe("Units.RAD");
    expect(findPersistenceUnitForPhenomenon("ANGLE")).toBe("Units.RAD");
    expect(findPersistenceUnitForPhenomenon("TIME")).toBe("Units.S");
    expect(findPersistenceUnitForPhenomenon("TEMPERATURE")).toBe("Units.K");
    expect(findPersistenceUnitForPhenomenon("MASS")).toBe("Units.KG");
  });

  it("normalizes schema-qualified phenomenon names", () => {
    expect(findPersistenceUnitForPhenomenon("Units.LENGTH")).toBe("Units.M");
    expect(findPersistenceUnitForPhenomenon("Units.AREA")).toBe("Units.SQ_M");
    expect(findPersistenceUnitForPhenomenon("Units.PLANE_ANGLE")).toBe("Units.RAD");
    expect(findPersistenceUnitForPhenomenon("Units.TIME")).toBe("Units.S");
  });

  it("returns undefined for unknown phenomena", () => {
    expect(findPersistenceUnitForPhenomenon("UNKNOWN")).toBeUndefined();
    expect(findPersistenceUnitForPhenomenon("Units.UNKNOWN")).toBeUndefined();
    expect(findPersistenceUnitForPhenomenon("")).toBeUndefined();
  });
});
