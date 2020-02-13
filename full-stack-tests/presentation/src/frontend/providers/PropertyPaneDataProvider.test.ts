/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ModelProps } from "@bentley/imodeljs-common";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { KeySet } from "@bentley/presentation-common";
import { PresentationPropertyDataProvider } from "@bentley/presentation-components";
import { initialize, terminate } from "../../IntegrationTests";

describe("PropertyDataProvider", async () => {

  let imodel: IModelConnection;
  let provider: PresentationPropertyDataProvider;
  let physicalModelProps: ModelProps;

  before(async () => {
    await initialize();

    const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
    imodel = await IModelConnection.openSnapshot(testIModelName);
    physicalModelProps = (await imodel.models.queryProps({ from: "bis.PhysicalModel" }))[0];
    provider = new PresentationPropertyDataProvider(imodel, "SimpleContent");
  });

  after(async () => {
    await imodel.closeSnapshot();
    terminate();
  });

  it("creates empty result when properties requested for 0 instances", async () => {
    provider.keys = new KeySet();
    const properties = await provider.getData();
    expect(properties).to.matchSnapshot();
  });

  it("creates property data when given key with concrete class", async () => {
    provider.keys = new KeySet([physicalModelProps]);
    const properties = await provider.getData();
    expect(properties).to.matchSnapshot();
  });

  it("creates property data when given key with base class", async () => {
    provider.keys = new KeySet([{ className: "BisCore:Element", id: "0x75" }]);
    const properties = await provider.getData();
    expect(properties).to.matchSnapshot();
  });

  it("favorites properties", async () => {
    (provider as any).isFieldFavorite = () => true;
    provider.keys = new KeySet([physicalModelProps]);
    const properties = await provider.getData();
    expect(properties).to.matchSnapshot();
  });

});
