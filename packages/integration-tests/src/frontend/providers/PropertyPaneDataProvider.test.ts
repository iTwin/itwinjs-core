/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { initialize, terminate } from "../../IntegrationTests";
import { OpenMode } from "@bentley/bentleyjs-core";
import { ModelProps } from "@bentley/imodeljs-common";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { KeySet } from "@bentley/ecpresentation-common";
import ECPresentationPropertyDataProvider from "@bentley/ecpresentation-controls/lib/propertygrid/DataProvider";

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
}
const createMeaningfulInstances = async (imodel: IModelConnection): Promise<MeaningfulInstances> => {
  return {
    repositoryModel: (await imodel.models.queryProps({ from: "bis.RepositoryModel" }))[0],
    functionalModel: (await imodel.models.queryProps({ from: "func.FunctionalModel" }))[0],
    physicalModel: (await imodel.models.queryProps({ from: "bis.PhysicalModel" }))[0],
  };
};

describe("PropertyDataProvider", async () => {

  let imodel: IModelConnection;
  let instances: MeaningfulInstances;
  let provider: ECPresentationPropertyDataProvider;
  before(async () => {
    const testIModelName: string = "assets/datasets/1K.bim";
    imodel = await IModelConnection.openStandalone(testIModelName, OpenMode.Readonly);
    expect(imodel).is.not.null;
    instances = await createMeaningfulInstances(imodel);
    provider = new ECPresentationPropertyDataProvider(imodel, "SimpleContent");
  });
  after(async () => {
    await imodel.closeStandalone();
  });

  it("creates property data", async () => {
    provider.keys = new KeySet([instances.functionalModel]);
    const properties = await provider.getData();
    expect(properties).to.matchSnapshot();
  });

  it("favorites properties", async () => {
    (provider as any).isFieldFavorite = () => true;
    provider.keys = new KeySet([instances.functionalModel]);
    const properties = await provider.getData();
    expect(properties).to.matchSnapshot();
  });

});
