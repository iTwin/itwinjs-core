/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import * as Rules from "../../../Validation/ECRules";

describe("ECRules Tests", () => {

  it("DiagnosticCodes must be unique.", () => {
    const seenCodes: string[] = [];
    for (const [, value] of Object.entries(Rules.DiagnosticCodes)) {
      if (seenCodes.includes(value))
        assert(false, `Diagnostic code ${value} already exists. Codes must be unique`);
      seenCodes.push(value);
    }
  });

  // This test will now fail on rule functions that encompass multiple rules (i.e. validateNavigationProperty), so we must
  // rethink this. This is more of a sanity check test, to make sure a rule function has been added to the rule set.
  it.skip("All rules should be in the rule set.", () => {
    const missingRules: string[] = [];
    for (const [key] of Object.entries(Rules.Diagnostics)) {
      if (Rules.ECRuleSet.classRules && Rules.ECRuleSet.classRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.ECRuleSet.constantRules && Rules.ECRuleSet.constantRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.ECRuleSet.customAttributeClassRules && Rules.ECRuleSet.customAttributeClassRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.ECRuleSet.customAttributeContainerRules && Rules.ECRuleSet.customAttributeContainerRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.ECRuleSet.customAttributeInstanceRules && Rules.ECRuleSet.customAttributeInstanceRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.ECRuleSet.entityClassRules && Rules.ECRuleSet.entityClassRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.ECRuleSet.enumerationRules && Rules.ECRuleSet.enumerationRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.ECRuleSet.formatRules && Rules.ECRuleSet.formatRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.ECRuleSet.formatRules && Rules.ECRuleSet.formatRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.ECRuleSet.invertedUnitRules && Rules.ECRuleSet.invertedUnitRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.ECRuleSet.kindOfQuantityRules && Rules.ECRuleSet.kindOfQuantityRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.ECRuleSet.mixinRules && Rules.ECRuleSet.mixinRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.ECRuleSet.phenomenonRules && Rules.ECRuleSet.phenomenonRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.ECRuleSet.propertyCategoryRules && Rules.ECRuleSet.propertyCategoryRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.ECRuleSet.propertyRules && Rules.ECRuleSet.propertyRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.ECRuleSet.relationshipConstraintRules && Rules.ECRuleSet.relationshipConstraintRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.ECRuleSet.relationshipRules && Rules.ECRuleSet.relationshipRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.ECRuleSet.schemaItemRules && Rules.ECRuleSet.schemaItemRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.ECRuleSet.schemaRules && Rules.ECRuleSet.schemaRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.ECRuleSet.structClassRules && Rules.ECRuleSet.structClassRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.ECRuleSet.unitRules && Rules.ECRuleSet.unitRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      if (Rules.ECRuleSet.unitSystemRules && Rules.ECRuleSet.unitSystemRules.find((x) => x.name.toLowerCase() === key.toLowerCase()))
        continue;

      missingRules.push(key);
    }

    if (missingRules.length === 0)
      return;

    assert(false, `Rules not found in rule set: ${missingRules.toString()}`);
  });
});
