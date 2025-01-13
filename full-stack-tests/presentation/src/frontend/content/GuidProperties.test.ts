/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Guid } from "@itwin/core-bentley";
import { Content, ContentSpecificationTypes, InstanceKey, KeySet, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { collect, getFieldByLabel } from "../../Utils";
import { buildTestIModelConnection, insertDocumentPartition } from "../../IModelSetupUtils";
import { describeContentTestSuite } from "./Utils";

describeContentTestSuite("Guid properties", () => {
  it("creates guid fields", async function () {
    const guid = Guid.createValue();
    let instanceKey: InstanceKey;
    const imodelConnection = await buildTestIModelConnection(this.test!.fullTitle(), async (db) => {
      instanceKey = insertDocumentPartition(db, "Test", undefined, guid);
    });

    const ruleset: Ruleset = {
      id: Guid.createValue(),
      rules: [
        {
          ruleType: RuleTypes.Content,
          specifications: [
            {
              specType: ContentSpecificationTypes.SelectedNodeInstances,
              propertyOverrides: [
                {
                  name: "FederationGuid",
                  isDisplayed: true,
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
    const field = getFieldByLabel(content!.descriptor.fields, "Federation GUID");

    expect(content?.contentSet.length).to.eq(1);
    expect(content?.contentSet[0].values[field.name]).to.eq(guid);
    expect(content?.contentSet[0].displayValues[field.name]).to.eq(guid);
  });
});
