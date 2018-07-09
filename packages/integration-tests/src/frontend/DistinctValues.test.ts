/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { OpenMode, Id64 } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { ECPresentation } from "@bentley/ecpresentation-frontend";
import {
  KeySet, SelectionInfo, InstanceKey,
  PresentationRuleSet, PresentationRuleSpecificationTypes, PresentationRuleTypes,
} from "@bentley/ecpresentation-common";
import { initialize, terminate } from "../IntegrationTests";

before(async () => {
  initialize();
});

after(() => {
  terminate();
});

describe("DistinctValues", async () => {
  let imodel: IModelConnection;

  before(async () => {
    const testIModelName: string = "assets/datasets/1K.bim";
    imodel = await IModelConnection.openStandalone(testIModelName, OpenMode.Readonly);
    expect(imodel).is.not.null;
  });

  after(async () => {
    await imodel.closeStandalone();
  });

  const contentRuleset: PresentationRuleSet = {
    ruleSetId: "distinctValuesTest",
    rules: [{
      type: PresentationRuleTypes.ContentRule,
      specifications: [{
        type: PresentationRuleSpecificationTypes.ContentRelatedInstancesSpecification,
        relatedClassNames: "BisCore:SubCategory, LinkPartition, DefinitionPartition, PhysicalPartition",
      }],
    }],
  };

  it.skip("gets distinct content values", async () => {
    ECPresentation.presentation.addRuleSet(contentRuleset);
    const key1: InstanceKey = { id: new Id64("0x1"), className: "BisCore:Subject" };
    const key2: InstanceKey = { id: new Id64("0x17"), className: "BisCore:SpatialCategory" };
    const selection: SelectionInfo = { providerName: "Some provider", level: 0 };
    const keys = new KeySet([key1, key2]);
    const options = { imodel, rulesetId: contentRuleset.ruleSetId };
    const descriptor = await ECPresentation.presentation.getContentDescriptor(options, "Grid", keys, selection);
    expect(descriptor).to.not.be.undefined;
    if (descriptor) {
      const distinctValues = await ECPresentation.presentation.getDistinctValues(options, descriptor, keys,
        "SubCategory_DefinitionPartition_LinkPartition_PhysicalPartition_Model");
      expect(distinctValues).to.be.deep.equal(["Dictionary Model-0-G", "Repository Model-0-1"]);
    }
  });

});
