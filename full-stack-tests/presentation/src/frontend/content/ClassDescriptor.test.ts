/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Guid } from "@itwin/core-bentley";
import { ContentSpecificationTypes, DefaultContentDisplayTypes, KeySet, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { ECClassHierarchy } from "../../ECClasHierarchy";
import { describeContentTestSuite, filterFieldsByClass, getFieldLabels } from "./Utils";

describeContentTestSuite("Class descriptor", ({ getDefaultSuiteIModel }) => {
  it("creates base class descriptor usable for subclasses", async () => {
    const imodel = await getDefaultSuiteIModel();
    const classHierarchy = await ECClassHierarchy.create(imodel);
    const createRuleset = (schemaName: string, className: string): Ruleset => ({
      id: Guid.createValue(),
      rules: [
        {
          ruleType: RuleTypes.Content,
          specifications: [
            {
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: {
                schemaName,
                classNames: [className],
                arePolymorphic: true,
              },
              handlePropertiesPolymorphically: true,
            },
          ],
        },
      ],
    });

    const descriptorGeometricElement = await Presentation.presentation.getContentDescriptor({
      imodel,
      rulesetOrId: createRuleset("BisCore", "GeometricElement"),
      displayType: DefaultContentDisplayTypes.PropertyPane,
      keys: new KeySet(),
    });
    // sanity check - ensure filtering the fields by the class we used for request doesn't filter out anything
    const fieldsGeometricElement = filterFieldsByClass(descriptorGeometricElement!.fields, await classHierarchy.getClassInfo("BisCore", "GeometricElement"));
    expect(getFieldLabels(fieldsGeometricElement)).to.deep.eq(getFieldLabels(descriptorGeometricElement!));

    // request properties of Generic.PhysicalObject and ensure it's matches our filtered result of `descriptorGeometricElement`
    const descriptorPhysicalObject = await Presentation.presentation.getContentDescriptor({
      imodel,
      rulesetOrId: createRuleset("Generic", "PhysicalObject"),
      displayType: DefaultContentDisplayTypes.PropertyPane,
      keys: new KeySet(),
    });
    const fieldsPhysicalObject = filterFieldsByClass(descriptorGeometricElement!.fields, await classHierarchy.getClassInfo("Generic", "PhysicalObject"));
    expect(getFieldLabels(fieldsPhysicalObject)).to.deep.eq(getFieldLabels(descriptorPhysicalObject!));

    // request properties of PCJ_TestSchema.TestClass and ensure it's matches our filtered result of `descriptorGeometricElement`
    const descriptorTestClass = await Presentation.presentation.getContentDescriptor({
      imodel,
      rulesetOrId: createRuleset("PCJ_TestSchema", "TestClass"),
      displayType: DefaultContentDisplayTypes.PropertyPane,
      keys: new KeySet(),
    });
    const fieldsTestClass = filterFieldsByClass(descriptorGeometricElement!.fields, await classHierarchy.getClassInfo("PCJ_TestSchema", "TestClass"));
    expect(getFieldLabels(fieldsTestClass)).to.deep.eq(getFieldLabels(descriptorTestClass!));
  });
});
