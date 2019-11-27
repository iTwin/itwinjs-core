/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { initialize, terminate } from "../../IntegrationTests";
import { IModelConnection, PropertyRecord } from "@bentley/imodeljs-frontend";
import { FavoritePropertiesDataProvider, PresentationPropertyDataProvider } from "@bentley/presentation-components";
import { KeySet } from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";
import { PropertyData } from "@bentley/ui-components";

describe("FavoritePropertiesDataProvider", async () => {

  let imodel: IModelConnection;
  let provider: FavoritePropertiesDataProvider;

  before(async () => {
    await initialize();
    const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
    imodel = await IModelConnection.openSnapshot(testIModelName);
  });

  beforeEach(() => {
    provider = new FavoritePropertiesDataProvider();
  });

  after(async () => {
    await imodel.closeSnapshot();
    terminate();
  });

  afterEach(async () => {
    await Presentation.favoriteProperties.clear();
  });

  describe("getData", async () => {

    it("returns favorite properties", async () => {
      // make a couple of properties favorited
      const propertyProvider = new PresentationPropertyDataProvider(imodel, "SimpleContent");
      propertyProvider.keys = new KeySet([{ className: "PCJ_TestSchema:TestClass", id: "0x38" }]);
      const propertyData = await propertyProvider.getData();

      let record = getPropertyRecordByLabel(propertyData, "Country")!;
      let field = await propertyProvider.getFieldByPropertyRecord(record);
      await Presentation.favoriteProperties.add(field!);
      record = getPropertyRecordByLabel(propertyData, "Model")!;
      field = await propertyProvider.getFieldByPropertyRecord(record);
      await Presentation.favoriteProperties.add(field!);

      Presentation.selection.scopes.activeScope = "element";
      const tooltipData = await provider.getData(imodel, "0x38");

      expect(tooltipData.categories.length).to.eq(1);
      const favoritesCategory = tooltipData.categories[0];
      expect(tooltipData.records[favoritesCategory.name].length).to.eq(2);
      expect(tooltipData.records[favoritesCategory.name].some((r) => r.property.displayLabel === "Model")).to.be.true;
      expect(tooltipData.records[favoritesCategory.name].some((r) => r.property.displayLabel === "Country")).to.be.true;
    });

  });

});

const getPropertyRecordByLabel = (props: PropertyData, label: string): PropertyRecord | undefined => {
  for (const category of props.categories) {
    const record = props.records[category.name].find((r) => r.property.displayLabel === label);
    if (record)
      return record;
  }
  return undefined;
};
