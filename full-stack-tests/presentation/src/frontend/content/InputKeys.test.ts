/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Guid } from "@itwin/core-bentley";
import { Content, ContentFlags, ContentSpecificationTypes, KeySet, RelationshipDirection, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { collect } from "../../Utils";
import { describeContentTestSuite } from "./Utils";

describeContentTestSuite("Input Keys", ({ getDefaultSuiteIModel }) => {
  it("associates content items with given input keys", async () => {
    const ruleset: Ruleset = {
      id: Guid.createValue(),
      rules: [
        {
          ruleType: RuleTypes.Content,
          specifications: [
            {
              specType: ContentSpecificationTypes.ContentRelatedInstances,
              relationshipPaths: [
                {
                  relationship: { schemaName: "BisCore", className: "ElementOwnsChildElements" },
                  direction: RelationshipDirection.Forward,
                  count: "*",
                },
              ],
            },
          ],
        },
      ],
    };
    const content = await Presentation.presentation
      .getContentIterator({
        imodel: await getDefaultSuiteIModel(),
        rulesetOrId: ruleset,
        descriptor: {
          contentFlags: ContentFlags.IncludeInputKeys,
        },

        keys: new KeySet([
          {
            className: "BisCore:Element",
            id: "0x1",
          },
          {
            className: "BisCore:Element",
            id: "0x12",
          },
        ]),
      })
      .then(async (x) => x && new Content(x.descriptor, await collect(x.items)));
    expect(content?.contentSet.length).to.eq(9);
    expect(content!.contentSet.map((item) => ({ itemId: item.primaryKeys[0].id, inputIds: item.inputKeys!.map((ik) => ik.id) }))).to.containSubset([
      {
        itemId: "0xe",
        inputIds: ["0x1"],
      },
      {
        itemId: "0x10",
        inputIds: ["0x1"],
      },
      {
        itemId: "0x12",
        inputIds: ["0x1"],
      },
      {
        itemId: "0x13",
        inputIds: ["0x1", "0x12"],
      },
      {
        itemId: "0x14",
        inputIds: ["0x1", "0x12"],
      },
      {
        itemId: "0x15",
        inputIds: ["0x1", "0x12"],
      },
      {
        itemId: "0x16",
        inputIds: ["0x1", "0x12"],
      },
      {
        itemId: "0x1b",
        inputIds: ["0x1", "0x12"],
      },
      {
        itemId: "0x1c",
        inputIds: ["0x1", "0x12"],
      },
    ]);
  });
});
