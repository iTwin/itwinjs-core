/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { HierarchyBuilder, initialize, terminate } from "@bentley/presentation-testing";
import { IModelConnection } from "@bentley/imodeljs-frontend";

describe("Rulesets", () => {
  let imodel: IModelConnection;
  const testIModelPath = "src/test/test-data/Properties_60InstancesWithUrl2.ibim";

  before(() => {
    initialize();
  });

  after(() => {
    terminate();
  });

  beforeEach(async () => {
    imodel = await IModelConnection.openStandalone(testIModelPath);
  });

  afterEach(async () => {
    await imodel.closeStandalone();
  });

  describe("Model", () => {
    it("generated iModel hierarchy matches snapshot", async () => {
      const builder = new HierarchyBuilder(imodel);
      const hierarchy = await builder.createHierarchy(require("../../../rulesets/Models"));

      expect(hierarchy).to.not.be.undefined;
      expect(hierarchy).to.matchSnapshot();
    });
  });

  describe("Category", () => {
    it("generated iModel hierarchy matches snapshot", async () => {
      const builder = new HierarchyBuilder(imodel);
      const hierarchy = await builder.createHierarchy(require("../../../rulesets/Categories"));

      expect(hierarchy).to.not.be.undefined;
      expect(hierarchy).to.matchSnapshot();
    });
  });
});
