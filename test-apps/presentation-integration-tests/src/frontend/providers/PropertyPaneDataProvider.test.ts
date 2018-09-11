/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { initialize, terminate } from "../../IntegrationTests";
import { OpenMode } from "@bentley/bentleyjs-core";
import { ModelProps } from "@bentley/imodeljs-common";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { KeySet } from "@bentley/presentation-common";
import PresentationPropertyDataProvider from "@bentley/presentation-components/lib/propertygrid/DataProvider";

describe("PropertyDataProvider", async () => {

  let imodel: IModelConnection;
  let provider: PresentationPropertyDataProvider;
  let physicalModelProps: ModelProps;

  before(async () => {
    initialize();
    const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
    imodel = await IModelConnection.openStandalone(testIModelName, OpenMode.Readonly);
    physicalModelProps = (await imodel.models.queryProps({ from: "bis.PhysicalModel" }))[0];
    provider = new PresentationPropertyDataProvider(imodel, "SimpleContent");
  });

  after(async () => {
    await imodel.closeStandalone();
    terminate();
  });

  it.skip("creates property data", async () => {
    provider.keys = new KeySet([physicalModelProps]);
    const properties = await provider.getData();
    expect(properties).to.matchSnapshot();
  });

  it.skip("favorites properties", async () => {
    (provider as any).isFieldFavorite = () => true;
    provider.keys = new KeySet([physicalModelProps]);
    const properties = await provider.getData();
    expect(properties).to.matchSnapshot();
  });

});
