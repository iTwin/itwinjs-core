/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { initialize, terminate } from "../IntegrationTests";
import { OpenMode } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { Presentation } from "@bentley/presentation-frontend";

describe("Localization", async () => {

  let imodel: IModelConnection;

  before(async () => {
    initialize();
    const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
    imodel = await IModelConnection.openStandalone(testIModelName, OpenMode.Readonly);
    expect(imodel).is.not.null;
  });

  after(async () => {
    await imodel.closeStandalone();
    terminate();
  });

  it("localizes using app/test supplied localized strings", async () => {
    const nodes = await Presentation.presentation.getRootNodes({ imodel, rulesetId: "LocalizationTest" });
    expect(nodes.length).to.eq(1);
    expect(nodes[0].label).to.eq("test value");
    expect(nodes[0].description).to.eq("test nested value");
  });

});
