/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { initialize, terminate } from "../../IntegrationTests";
import { OpenMode } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { PresentationTreeDataProvider } from "@bentley/presentation-components";

describe("TreeDataProvider", async () => {

  let imodel: IModelConnection;
  let provider: PresentationTreeDataProvider;

  before(async () => {
    initialize();
    const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
    imodel = await IModelConnection.openStandalone(testIModelName, OpenMode.Readonly);
    expect(imodel).is.not.null;
    provider = new PresentationTreeDataProvider(imodel, "SimpleHierarchy");
  });

  after(async () => {
    await imodel.closeStandalone();
    terminate();
  });

  it("returns root nodes count", async () => {
    const count = await provider.getNodesCount();
    expect(count).to.eq(1);
  });

  it("returns root nodes", async () => {
    const nodes = await provider.getNodes();
    expect(nodes).to.matchSnapshot();
  });

  it("returns child nodes count", async () => {
    const rootNodes = await provider.getNodes();
    const count = await provider.getNodesCount(rootNodes[0]);
    expect(count).to.eq(1);
  });

  it("returns child nodes", async () => {
    const rootNodes = await provider.getNodes();
    const childNodes = await provider.getNodes(rootNodes[0]);
    expect(childNodes).to.matchSnapshot();
  });

});
