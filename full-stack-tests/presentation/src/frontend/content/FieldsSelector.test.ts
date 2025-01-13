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

describeContentTestSuite("Fields Selector", ({ getDefaultSuiteIModel }) => {
  it("excludes fields from content", async () => {
    const imodel = await getDefaultSuiteIModel();
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
      ],
    };

    const content1 = await Presentation.presentation
      .getContentIterator({
        imodel,
        rulesetOrId: ruleset,
        descriptor: {},
        keys: new KeySet(),
      })
      .then(async (x) => x && new Content(x.descriptor, await collect(x.items)));
    expect(content1?.contentSet.length).to.eq(1);
    const fieldsCount = content1!.descriptor.fields.length;

    const content2 = await Presentation.presentation
      .getContentIterator({
        imodel,
        rulesetOrId: ruleset,
        descriptor: {
          fieldsSelector: {
            type: "exclude",
            fields: [content1!.descriptor.fields[0].getFieldDescriptor()],
          },
        },
        keys: new KeySet(),
      })
      .then(async (x) => x && new Content(x.descriptor, await collect(x.items)));
    expect(content2?.contentSet.length).to.eq(1);
    expect(content2!.descriptor.fields.length).to.eq(fieldsCount - 1);
  });

  it("exclusively includes fields in content", async () => {
    const imodel = await getDefaultSuiteIModel();
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
      ],
    };

    const content1 = await Presentation.presentation
      .getContentIterator({
        imodel,
        rulesetOrId: ruleset,
        descriptor: {},
        keys: new KeySet(),
      })
      .then(async (x) => x && new Content(x.descriptor, await collect(x.items)));
    expect(content1?.contentSet.length).to.eq(1);
    expect(content1!.descriptor.fields.length).to.be.greaterThan(1);

    const content2 = await Presentation.presentation
      .getContentIterator({
        imodel,
        rulesetOrId: ruleset,
        descriptor: {
          fieldsSelector: {
            type: "include",
            fields: [content1!.descriptor.fields[0].getFieldDescriptor()],
          },
        },
        keys: new KeySet(),
      })
      .then(async (x) => x && new Content(x.descriptor, await collect(x.items)));
    expect(content2?.contentSet.length).to.eq(1);
    expect(content2!.descriptor.fields.length).to.eq(1);
  });
});
