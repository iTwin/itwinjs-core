/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Guid } from "@itwin/core-bentley";
import { Content, ContentSpecificationTypes, KeySet, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { collect, getFieldByLabel } from "../../Utils";
import { describeContentTestSuite } from "./Utils";

describeContentTestSuite("Calculated Properties", ({ getDefaultSuiteIModel }) => {
  it("creates calculated fields", async () => {
    const ruleset: Ruleset = {
      id: Guid.createValue(),
      rules: [
        {
          ruleType: RuleTypes.Content,
          specifications: [
            {
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["Element"], arePolymorphic: true },
              instanceFilter: `this.ECInstanceId = 1`,
            },
          ],
        },
        {
          ruleType: RuleTypes.ContentModifier,
          class: { schemaName: "BisCore", className: "Element" },
          calculatedProperties: [
            {
              label: "Test",
              value: `"Value"`,
            },
          ],
        },
      ],
    };

    const content = await Presentation.presentation
      .getContentIterator({
        imodel: await getDefaultSuiteIModel(),
        rulesetOrId: ruleset,
        descriptor: {},
        keys: new KeySet(),
      })
      .then(async (x) => x && new Content(x.descriptor, await collect(x.items)));
    const field = getFieldByLabel(content!.descriptor.fields, "Test");

    expect(content?.contentSet.length).to.eq(1);
    expect(content?.contentSet[0].values[field.name]).to.eq("Value");
    expect(content?.contentSet[0].displayValues[field.name]).to.eq("Value");
  });
});
