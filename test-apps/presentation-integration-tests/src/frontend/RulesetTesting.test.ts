/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { HierarchyBuilder, ContentBuilder, ContentBuilderResult } from "@bentley/presentation-testing";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { initialize, terminate } from "../IntegrationTests";
import * as ChaiJestSnapshot from "chai-jest-snapshot";
import path from "path";

function configureSnapshotLocation(test: Mocha.Runnable, subdirectory: string, instance: ContentBuilderResult) {
  let fileName = path.join(
    path.dirname(test.file!).replace(/(?!\\|\/)(lib)(?=\\|\/)/g, "src"),
    subdirectory,
    `${instance.className.replace(":", ".")}.snap`);

  fileName = fileName.replace(/__x0020__/g, "_");
  ChaiJestSnapshot.setFilename(fileName);
  ChaiJestSnapshot.setTestName(`${test.fullTitle()}. ClassName: '${instance.className}'`);
}

// __PUBLISH_EXTRACT_START__ Presentation.Testing.Rulesets
describe("RulesetTesting", () => {
  let imodel: IModelConnection;
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
    imodel = await IModelConnection.openSnapshot(imodelPath);
  });

  afterEach(async () => {
    await imodel.closeSnapshot();
  });

  it("generates correct hierarchy for 'Items' ruleset", async () => {
    const builder = new HierarchyBuilder(imodel);
    // generate the hierarchy using a ruleset id
    const hierarchy = await builder.createHierarchy("Items");
    // verify through snapshot
    expect(hierarchy).to.matchSnapshot();
  });

  // tslint:disable-next-line:only-arrow-functions
  it("generates correct content for 'Items' ruleset", async function () {
    const builder = new ContentBuilder(imodel);
    // generate content using ruleset id
    const instances = await builder.createContentForInstancePerClass("Items");

    // verify through snapshot
    // we loop through each instance and create a separate snapshot file
    // because snapshot engine has difficulties parsing big files
    for (const instance of instances) {
      // not providing filename and snapshot name to the 'matchSnapshot', because it seems
      // to ignore them when ChaiJestSnapshot.setFilename and setTestName is used
      configureSnapshotLocation(this.test!, "ruleset-testing-content-snaps", instance);
      expect(instance.records).to.matchSnapshot();
    }
  });

  it("generates correct hierarchy for 'default' ruleset", async () => {
    const builder = new HierarchyBuilder(imodel);
    // import ruleset from file
    const ruleset = require("../../test-rulesets/Rulesets/default.json");
    // generate the hierarchy
    const hierarchy = await builder.createHierarchy(ruleset);
    // verify through snapshot
    expect(hierarchy).to.matchSnapshot();
  });

});
// __PUBLISH_EXTRACT_END__
