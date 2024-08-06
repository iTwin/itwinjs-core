/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Guid } from "@itwin/core-bentley";
import { SnapshotConnection } from "@itwin/core-frontend";
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

  it.only("returns correct value for calculated property with HasRelatedInstance ECExpression", async () => {
    const imodel = await SnapshotConnection.openFile(process.env.TEST_IMODEL!);

    const ruleset: Ruleset = {
      id: Guid.createValue(),
      rules: [
        {
          ruleType: RuleTypes.Content,
          specifications: [
            {
              specType: "SelectedNodeInstances",
            },
          ],
        },
        {
          ruleType: RuleTypes.ContentModifier,
          class: { schemaName: "BisCore", className: "Element" },
          calculatedProperties: [
            {
              label: "Test",
              value: `this.HasRelatedInstance("BisCore:ElementOwnsUniqueAspect", "Forward", "Booster:EdgeOnSideParkingAspect")`,
            },
          ],
        },
      ],
    };

    const content = await Presentation.presentation
      .getContentIterator({
        imodel,
        rulesetOrId: ruleset,
        descriptor: {},
        keys: new KeySet([
          { className: "BisCore:Subject", id: "0x1" }, // false
          { className: "Booster:LayoutParkingLotEdge", id: "0x60" }, // true
        ]),
      })
      .then(async (x) => x && new Content(x.descriptor, await collect(x.items)));
    const field = getFieldByLabel(content!.descriptor.fields, "Test");

    expect(content!.contentSet.length).to.eq(2);
    expect(content!.contentSet[0].values[field.name]).to.eq("False");
    expect(content!.contentSet[1].values[field.name]).to.eq("True");
  });
});
