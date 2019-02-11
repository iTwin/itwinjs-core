/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as Rules from "../../../src/Validation/BisRules";
import { assert } from "@bentley/bentleyjs-core";

describe("BisRules Tests", () => {

  beforeEach(async () => {
  });

  it("DiagnosticCodes must be unique.", () => {
    const seenCodes: string[] = [];
    for (const [, value] of Object.entries(Rules.DiagnosticCodes)) {
      if (seenCodes.includes(value))
        assert(false, `Diagnostic code ${value} already exists. Codes must be unique`);
      seenCodes.push(value);
    }
  });

  it("All rules should be in the rule set.", async () => {
    const missingRules: string[] = [];
    for (const [key] of Object.entries(Rules.Diagnostics)) {
      if (Rules.BisRuleSet.classRules && Rules.BisRuleSet.classRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.BisRuleSet.constantRules && Rules.BisRuleSet.constantRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.BisRuleSet.customAttributeClassRules && Rules.BisRuleSet.customAttributeClassRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.BisRuleSet.customAttributeContainerRules && Rules.BisRuleSet.customAttributeContainerRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.BisRuleSet.customAttributeInstanceRules && Rules.BisRuleSet.customAttributeInstanceRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.BisRuleSet.entityClassRules && Rules.BisRuleSet.entityClassRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.BisRuleSet.enumerationRules && Rules.BisRuleSet.enumerationRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.BisRuleSet.formatRules && Rules.BisRuleSet.formatRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.BisRuleSet.formatRules && Rules.BisRuleSet.formatRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.BisRuleSet.invertedUnitRules && Rules.BisRuleSet.invertedUnitRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.BisRuleSet.kindOfQuantityRules && Rules.BisRuleSet.kindOfQuantityRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.BisRuleSet.mixinRules && Rules.BisRuleSet.mixinRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.BisRuleSet.phenomenonRules && Rules.BisRuleSet.phenomenonRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.BisRuleSet.propertyCategoryRules && Rules.BisRuleSet.propertyCategoryRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.BisRuleSet.propertyRules && Rules.BisRuleSet.propertyRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.BisRuleSet.relationshipConstraintRules && Rules.BisRuleSet.relationshipConstraintRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.BisRuleSet.relationshipRules && Rules.BisRuleSet.relationshipRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.BisRuleSet.schemaItemRules && Rules.BisRuleSet.schemaItemRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.BisRuleSet.schemaRules && Rules.BisRuleSet.schemaRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.BisRuleSet.structClassRules && Rules.BisRuleSet.structClassRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.BisRuleSet.unitRules && Rules.BisRuleSet.unitRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.BisRuleSet.unitSystemRules && Rules.BisRuleSet.unitSystemRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      missingRules.push(key);
    }

    if (missingRules.length === 0)
      return;

    assert(false, "Rules not found in rule set: " + missingRules.toString());
  });
});
