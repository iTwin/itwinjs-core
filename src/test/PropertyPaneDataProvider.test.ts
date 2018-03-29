/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { initialize, terminate } from "./IntegrationTests";
import { OpenMode } from "@bentley/bentleyjs-core";
import { ModelProps, ElementProps } from "@bentley/imodeljs-common";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { KeySet } from "@bentley/ecpresentation-common";
import { PropertyPaneDataProvider } from "@bentley/ecpresentation-controls";
import "../test-helpers/Snapshots";

before(() => {
  initialize();
});

after(() => {
  terminate();
});

interface MeaningfulInstances {
  repositoryModel: ModelProps;
  functionalModel: ModelProps;
  physicalModel: ModelProps;
  functionalElement: ElementProps;
  physicalElement: ElementProps;
}
const createMeaningfulInstances = async (imodel: IModelConnection): Promise<MeaningfulInstances> => {
  return {
    repositoryModel: (await imodel.models.queryProps({ from: "bis.RepositoryModel" }))[0],
    functionalModel: (await imodel.models.queryProps({ from: "func.FunctionalModel" }))[0],
    physicalModel: (await imodel.models.queryProps({ from: "bis.PhysicalModel" }))[0],
    functionalElement: (await imodel.elements.queryProps({ from: "func.FunctionalElement" }))[0],
    physicalElement: (await imodel.elements.queryProps({ from: "bis.PhysicalElement" }))[0],
  };
};

// wip: all fail because of serialization format mismatch between js and native
describe.skip("PropertyPaneDataProvider", async () => {

  let imodel: IModelConnection;
  let instances: MeaningfulInstances;
  let provider: PropertyPaneDataProvider;
  before(async () => {
    const testIModelName: string = "assets/datasets/1K.bim";
    imodel = await IModelConnection.openStandalone(testIModelName, OpenMode.Readonly);
    expect(imodel).is.not.null;
    instances = await createMeaningfulInstances(imodel);
    provider = new PropertyPaneDataProvider(imodel.iModelToken, "Simple");
  });
  after(async () => {
    await imodel.closeStandalone();
  });

  it("creates property data", async () => {
    provider.keys = new KeySet([instances.functionalElement]);
    const properties = await provider.getData();
    expect(properties).to.matchSnapshot();
  });

});
