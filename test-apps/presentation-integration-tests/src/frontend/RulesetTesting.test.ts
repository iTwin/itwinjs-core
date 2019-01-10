/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { HierarchyBuilder } from "@bentley/presentation-testing";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { initialize, terminate } from "../IntegrationTests";

// __PUBLISH_EXTRACT_START__ Presentation.Testing.Rulesets
describe("RulesetTesting", () => {

  let imodel: IModelConnection;
  let builder: HierarchyBuilder;
  const imodelPath = "assets/datasets/Properties_60InstancesWithUrl2.ibim";

  before(() => {
    // initialize presentation-testing
    initialize();
  });

  after(() => {
    // terminate presentation-testing
    terminate();
  });

  beforeEach(async () => {
    // set up for testing imodel presentation data
    imodel = await IModelConnection.openStandalone(imodelPath);
    builder = new HierarchyBuilder(imodel);
  });

  afterEach(async () => {
    await imodel.closeStandalone();
  });

  it("generates correct hierarchy for 'Items' ruleset", async () => {
    // generate the hierarchy using a ruleset id
    const hierarchy = await builder.createHierarchy("Items");
    // verify through snapshot
    expect(hierarchy).to.matchSnapshot();
  });

  it("generates correct hierarchy for 'default' ruleset", async () => {
    // import ruleset from file
    const ruleset = require("../../test-rulesets/Rulesets/default.json");
    // generate the hierarchy
    const hierarchy = await builder.createHierarchy(ruleset);
    // verify through snapshot
    expect(hierarchy).to.matchSnapshot();
  });

});
// __PUBLISH_EXTRACT_END__
