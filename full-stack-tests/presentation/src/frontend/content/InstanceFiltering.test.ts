/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Guid } from "@itwin/core-bentley";
import { Content, ContentSpecificationTypes, KeySet, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { collect } from "../../Utils";
import { describeContentTestSuite } from "./Utils";

describeContentTestSuite("Instance filtering", ({ getDefaultSuiteIModel }) => {
  it("filters content instances using direct property", async () => {
    const ruleset: Ruleset = {
      id: Guid.createValue(),
      rules: [
        {
          ruleType: RuleTypes.Content,
          specifications: [
            {
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: [{ schemaName: "PCJ_TestSchema", classNames: ["TestClass"] }],
            },
          ],
        },
      ],
    };

    const content = await Presentation.presentation
      .getContentIterator({
        imodel: await getDefaultSuiteIModel(),
        rulesetOrId: ruleset,
        keys: new KeySet(),
        descriptor: {
          instanceFilter: {
            selectClassName: "PCJ_TestSchema:TestClass",
            expression: 'this.String_Property_4 = "Yoda"',
          },
        },
      })
      .then(async (x) => x && new Content(x.descriptor, await collect(x.items)));

    expect(content?.contentSet.length).to.be.eq(6);
  });

  it("filters content instances using related property", async () => {
    const ruleset: Ruleset = {
      id: Guid.createValue(),
      rules: [
        {
          ruleType: RuleTypes.Content,
          specifications: [
            {
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: [{ schemaName: "BisCore", classNames: ["GeometricElement3d"], arePolymorphic: true }],
            },
          ],
        },
      ],
    };

    const content = await Presentation.presentation
      .getContentIterator({
        imodel: await getDefaultSuiteIModel(),
        rulesetOrId: ruleset,
        keys: new KeySet(),
        descriptor: {
          instanceFilter: {
            selectClassName: "Generic:PhysicalObject",
            expression: "related.Btu__x002F__lb__x0020____x005B__Btu__x0020__per__x0020__pound__x0020__mass__x005D__ = 1475.699",
            relatedInstances: [
              {
                pathFromSelectToPropertyClass: [
                  {
                    sourceClassName: "Generic:PhysicalObject",
                    targetClassName: "DgnCustomItemTypes_MyProp:area__x0020__per__x0020__time__x0020__squaredElementAspect",
                    relationshipName: "BisCore:ElementOwnsMultiAspects",
                    isForwardRelationship: true,
                  },
                ],
                alias: "related",
              },
            ],
          },
        },
      })
      .then(async (x) => x && new Content(x.descriptor, await collect(x.items)));

    expect(content?.contentSet.length).to.be.eq(1);
  });
});
