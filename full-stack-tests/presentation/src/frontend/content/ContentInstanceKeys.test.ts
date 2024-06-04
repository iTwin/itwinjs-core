/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ContentSpecificationTypes, KeySet, RelationshipDirection, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { describeContentTestSuite } from "./Utils";

describeContentTestSuite("Content instance keys", ({ getDefaultSuiteIModel }) => {
  it("retrieves content instance keys for given input", async () => {
    const ruleset: Ruleset = {
      id: "model elements",
      rules: [
        {
          ruleType: RuleTypes.Content,
          specifications: [
            {
              specType: ContentSpecificationTypes.ContentRelatedInstances,
              relationshipPaths: [
                {
                  relationship: { schemaName: "BisCore", className: "ModelContainsElements" },
                  direction: RelationshipDirection.Forward,
                },
              ],
            },
          ],
        },
      ],
    };
    const modelKeys = new KeySet([{ className: "BisCore:DictionaryModel", id: "0x10" }]);
    const result = await Presentation.presentation.getContentInstanceKeys({
      imodel: await getDefaultSuiteIModel(),
      rulesetOrId: ruleset,
      keys: modelKeys,
    });
    expect(result.total).to.eq(7);

    const resultKeys = [];
    for await (const key of result.items()) {
      resultKeys.push(key);
    }
    expect(resultKeys).to.deep.eq([
      {
        className: "BisCore:LineStyle",
        id: "0x1d",
      },
      {
        className: "BisCore:LineStyle",
        id: "0x1e",
      },
      {
        className: "BisCore:LineStyle",
        id: "0x1f",
      },
      {
        className: "BisCore:LineStyle",
        id: "0x20",
      },
      {
        className: "BisCore:LineStyle",
        id: "0x21",
      },
      {
        className: "BisCore:LineStyle",
        id: "0x22",
      },
      {
        className: "BisCore:LineStyle",
        id: "0x23",
      },
    ]);
  });
});
