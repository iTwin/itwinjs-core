/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { collectFieldQuantityPairs } from "../../internal/annotations/fieldSpecs";

describe("collectFieldQuantityPairs candidate priority", () => {
  const PROPERTY_PAIR = { name: "P.KOQ", persistenceUnitName: "Units.M" };

  it("keeps the property-side fallback for a kindOfQuantity-only override", () => {
    expect(collectFieldQuantityPairs({
      overrideName: "A.KOQ", propertyName: "P.KOQ", propertyPersistence: "Units.M",
    })).to.deep.equal([{ name: "A.KOQ", persistenceUnitName: "Units.M" }, PROPERTY_PAIR]);
  });

  it("keeps the property-side fallback when the persistence override restates the property's unit", () => {
    expect(collectFieldQuantityPairs({
      overrideName: "A.KOQ", overridePersistence: "Units.M", propertyName: "P.KOQ", propertyPersistence: "Units.M",
    })).to.deep.equal([{ name: "A.KOQ", persistenceUnitName: "Units.M" }, PROPERTY_PAIR]);
  });

  it("drops the property-side fallback when the persistence override names a different unit", () => {
    expect(collectFieldQuantityPairs({
      overridePersistence: "Units.FT", propertyName: "P.KOQ", propertyPersistence: "Units.M",
    })).to.deep.equal([{ name: "P.KOQ", persistenceUnitName: "Units.FT" }]);
  });

  it("emits a single pair when the overrides only restate the property's own pair", () => {
    expect(collectFieldQuantityPairs({
      overrideName: "P.KOQ", overridePersistence: "Units.M", propertyName: "P.KOQ", propertyPersistence: "Units.M",
    })).to.deep.equal([PROPERTY_PAIR]);
  });

  it("compares names exactly; callers normalize spellings to the schema's before building pairs", () => {
    // `lookupFieldSpec` resolves `units:m` to `Units.M` first. Anything that reaches here unnormalized
    // is a name no schema defines, and those really are different keys.
    expect(collectFieldQuantityPairs({
      overridePersistence: "units:m", propertyName: "P.KOQ", propertyPersistence: "Units.M",
    })).to.deep.equal([{ name: "P.KOQ", persistenceUnitName: "units:m" }]);
  });

  it("emits no property-side pair at all when the property has no persistence unit", () => {
    expect(collectFieldQuantityPairs({
      overrideName: "A.KOQ", overridePersistence: "Units.ARC_DEG", propertyName: undefined, propertyPersistence: undefined,
    })).to.deep.equal([{ name: "A.KOQ", persistenceUnitName: "Units.ARC_DEG" }]);

    for (const overridePersistence of [undefined, "", "Units.ARC_DEG"]) {
      expect(collectFieldQuantityPairs({ overridePersistence, propertyName: undefined, propertyPersistence: undefined })).to.deep.equal([]);
    }
  });
});
