/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { assert, Guid } from "@itwin/core-bentley";
import { ContentSpecificationTypes, KeySet, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { getFieldByLabel } from "../../Utils";
import { describeContentTestSuite } from "./Utils";

describeContentTestSuite("Navigation Properties", ({ getDefaultSuiteIModel }) => {
  it("creates navigation fields", async () => {
    const ruleset: Ruleset = {
      id: Guid.createValue(),
      rules: [
        {
          ruleType: RuleTypes.Content,
          specifications: [
            {
              specType: ContentSpecificationTypes.SelectedNodeInstances,
            },
          ],
        },
      ],
    };

    const keys = new KeySet([{ className: "PCJ_TestSchema:TestClass", id: "0x70" }]);
    const descriptor = (await Presentation.presentation.getContentDescriptor({
      imodel: await getDefaultSuiteIModel(),
      rulesetOrId: ruleset,
      keys,
      displayType: "",
    }))!;
    const field = getFieldByLabel(descriptor.fields, "Model");

    assert(field.isPropertiesField());

    expect(field.properties.length).to.eq(1);
    expect(field.properties[0].property.navigationPropertyInfo).is.not.null;
    expect(field.properties[0].property.navigationPropertyInfo?.isForwardRelationship).to.eq(false);
    expect(field.properties[0].property.navigationPropertyInfo?.classInfo.id).to.eq("0x40");
    expect(field.properties[0].property.navigationPropertyInfo?.targetClassInfo.id).to.eq("0x41");
  });
});
