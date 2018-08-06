/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { initialize, terminate } from "../../IntegrationTests";
import { OpenMode } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import ECPresentationTreeDataProvider from "@bentley/ecpresentation-controls/lib/tree/DataProvider";

before(() => {
  initialize();
});

after(() => {
  terminate();
});

describe("TreeDataProvider", async () => {

  let imodel: IModelConnection;
  let provider: ECPresentationTreeDataProvider;
  before(async () => {
    const testIModelName: string = "assets/datasets/1K.bim";
    imodel = await IModelConnection.openStandalone(testIModelName, OpenMode.Readonly);
    expect(imodel).is.not.null;
    provider = new ECPresentationTreeDataProvider(imodel, "SimpleHierarchy");
  });
  after(async () => {
    await imodel.closeStandalone();
  });

  it("returns root nodes count", async () => {
    const count = await provider.getRootNodesCount();
    expect(count).to.eq(1);
  });

  it("returns root nodes", async () => {
    const nodes = await provider.getRootNodes();
    expect(nodes).to.matchSnapshot();
  });

  it("returns child nodes count", async () => {
    const rootNodes = await provider.getRootNodes();
    const count = await provider.getChildNodesCount(rootNodes[0]);
    expect(count).to.eq(1);
  });

  it("returns child nodes", async () => {
    const rootNodes = await provider.getRootNodes();
    const childNodes = await provider.getChildNodes(rootNodes[0]);
    expect(childNodes).to.matchSnapshot();
  });

});
