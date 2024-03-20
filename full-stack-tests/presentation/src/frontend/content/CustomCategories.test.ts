/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Guid } from "@itwin/core-bentley";
import { Content, ContentSpecificationTypes, InstanceKey, KeySet, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { collect } from "../../Utils";
import { buildTestIModelConnection, insertDocumentPartition } from "../../IModelSetupUtils";
import { describeContentTestSuite } from "./Utils";

describeContentTestSuite("Custom categories", () => {
  it("creates child class category", async function () {
    let instanceKey: InstanceKey;
    const imodelConnection = await buildTestIModelConnection(this.test!.fullTitle(), async (db) => {
      instanceKey = insertDocumentPartition(db, "Test");
    });

    const ruleset: Ruleset = {
      id: Guid.createValue(),
      rules: [
        {
          ruleType: RuleTypes.Content,
          specifications: [
            {
              specType: ContentSpecificationTypes.SelectedNodeInstances,
              propertyCategories: [
                {
                  id: "custom-category",
                  label: "Custom Category",
                },
              ],
              propertyOverrides: [
                {
                  name: "*",
                  categoryId: { type: "Id", categoryId: "custom-category", createClassCategory: true },
                },
              ],
            },
          ],
        },
      ],
    };
    const content = await Presentation.presentation
      .getContentIterator({
        imodel: imodelConnection,
        rulesetOrId: ruleset,
        keys: new KeySet([instanceKey!]),
        descriptor: {},
      })
      .then(async (x) => x && new Content(x.descriptor, await collect(x.items)));

    expect(content!.descriptor.categories).to.containSubset([{ label: "Document Partition" }, { label: "Custom Category" }]);

    expect(content!.descriptor.fields).to.containSubset([
      {
        category: {
          label: "Document Partition",
          parent: {
            label: "Custom Category",
          },
        },
      },
    ]);
  });
});
