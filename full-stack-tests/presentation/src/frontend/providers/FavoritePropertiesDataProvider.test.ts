/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import type { IModelConnection} from "@itwin/core-frontend";
import { SnapshotConnection } from "@itwin/core-frontend";
import { KeySet } from "@itwin/presentation-common";
import { DEFAULT_PROPERTY_GRID_RULESET, FavoritePropertiesDataProvider, PresentationPropertyDataProvider } from "@itwin/presentation-components";
import { FavoritePropertiesScope, Presentation } from "@itwin/presentation-frontend";
import type { PropertyRecord } from "@itwin/appui-abstract";
import type { PropertyData } from "@itwin/components-react";
import { initialize, terminate } from "../../IntegrationTests";

describe("FavoritePropertiesDataProvider", async () => {

  let imodel: IModelConnection;
  let provider: FavoritePropertiesDataProvider;
  const scope = FavoritePropertiesScope.IModel;

  before(async () => {
    await initialize();
    const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
    imodel = await SnapshotConnection.openFile(testIModelName);
  });

  beforeEach(() => {
    provider = new FavoritePropertiesDataProvider({ ruleset: DEFAULT_PROPERTY_GRID_RULESET });
  });

  after(async () => {
    await imodel.close();
    await terminate();
  });

  afterEach(async () => {
    await Presentation.favoriteProperties.clear(imodel, scope);
  });

  describe("getData", () => {

    it("returns favorite properties", async () => {
      // make a couple of properties favorited
      const propertyProvider = new PresentationPropertyDataProvider({ imodel, ruleset: DEFAULT_PROPERTY_GRID_RULESET });
      propertyProvider.isNestedPropertyCategoryGroupingEnabled = false;
      propertyProvider.keys = new KeySet([{ className: "PCJ_TestSchema:TestClass", id: "0x38" }]);
      const propertyData = await propertyProvider.getData();

      let record = getPropertyRecordByLabel(propertyData, "Country")!;
      let field = await propertyProvider.getFieldByPropertyRecord(record);
      await Presentation.favoriteProperties.add(field!, imodel, scope);
      record = getPropertyRecordByLabel(propertyData, "Model")!;
      field = await propertyProvider.getFieldByPropertyRecord(record);
      await Presentation.favoriteProperties.add(field!, imodel, scope);

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
