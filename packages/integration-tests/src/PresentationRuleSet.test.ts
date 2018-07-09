/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { initialize, terminate } from "./IntegrationTests";
import { OpenMode } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { ECPresentation } from "@bentley/ecpresentation-frontend";
import { PresentationRuleSet, PresentationRuleTypes, PresentationRuleSpecificationTypes, RootNodeRule, CustomNodeSpecification } from "@bentley/ecpresentation-common";

before(() => {
  initialize();
});

after(() => {
  terminate();
});

describe("PresentationRuleSet", async () => {

  let imodel: IModelConnection;

  const customNodeSpecification: CustomNodeSpecification = {
    type: PresentationRuleSpecificationTypes.CustomNodeSpecification,
    label: "label",
    nodeType: "nodeType",
    imageId: "imageId",
    description: "description",
  };

  const rootNodeRule: RootNodeRule = {
    type: PresentationRuleTypes.RootNodeRule,
    specifications: [customNodeSpecification],
  };

  const presentationRuleSet: PresentationRuleSet = {
    ruleSetId: "JsonRuleSet",
    rules: [rootNodeRule],
  };

  before(async () => {
    const testIModelName: string = "assets/datasets/1K.bim";
    imodel = await IModelConnection.openStandalone(testIModelName, OpenMode.Readonly);
    expect(imodel).is.not.null;
  });

  after(async () => {
    await imodel.closeStandalone();
  });

  it("creates ruleset from Json and gets rootNode from frontend", async () => {
    await ECPresentation.presentation.addRuleSet(presentationRuleSet);
    const rootNodes = await ECPresentation.presentation.getRootNodes({ imodel, rulesetId: presentationRuleSet.ruleSetId });

    expect(rootNodes.length).to.be.equal(1);
    expect(rootNodes[0].label).to.be.equal(customNodeSpecification.label);
    expect(rootNodes[0].imageId).to.be.equal(customNodeSpecification.imageId);
    expect(rootNodes[0].description).to.be.equal(customNodeSpecification.description);
  });

  it("removes ruleset from frontend", async () => {
    await ECPresentation.presentation.addRuleSet(presentationRuleSet);
    let rootNodes = await ECPresentation.presentation.getRootNodes({ imodel, rulesetId: presentationRuleSet.ruleSetId });
    expect(rootNodes.length).to.be.equal(1);

    await ECPresentation.presentation.removeRuleSet(presentationRuleSet.ruleSetId);
    rootNodes = await ECPresentation.presentation.getRootNodes({ imodel, rulesetId: presentationRuleSet.ruleSetId });
    expect(rootNodes.length).to.be.equal(0);
  });

  it("clears rulesets from frontend", async () => {
    await ECPresentation.presentation.addRuleSet(presentationRuleSet);
    let rootNodes = await ECPresentation.presentation.getRootNodes({ imodel, rulesetId: presentationRuleSet.ruleSetId });
    expect(rootNodes.length).to.be.equal(1);

    await ECPresentation.presentation.clearRuleSets();
    rootNodes = await ECPresentation.presentation.getRootNodes({ imodel, rulesetId: presentationRuleSet.ruleSetId });
    expect(rootNodes.length).to.be.equal(0);
  });

});
