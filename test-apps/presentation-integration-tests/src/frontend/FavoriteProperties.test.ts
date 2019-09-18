/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import { IModelConnection, PropertyRecord } from "@bentley/imodeljs-frontend";
import { initialize, terminate } from "../IntegrationTests";
import { PresentationPropertyDataProvider } from "@bentley/presentation-components";
import { KeySet, Ruleset, RuleTypes, ContentSpecificationTypes, RegisteredRuleset } from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";
import { PropertyData } from "@bentley/ui-components";

const favoritesCategoryName = "Favorite";
describe("Favorite Properties", () => {

  let imodel: IModelConnection;

  before(async () => {
    initialize();
    const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
    imodel = await IModelConnection.openSnapshot(testIModelName);
    expect(imodel).is.not.null;
  });

  after(async () => {
    await imodel.closeSnapshot();
    terminate();
  });

  let propertiesRuleset: RegisteredRuleset;
  let propertiesDataProvider: PresentationPropertyDataProvider;

  beforeEach(async () => {
    Presentation.terminate();
    Presentation.initialize();
    const ruleset: Ruleset = {
      id: faker.random.uuid(),
      rules: [{
        ruleType: RuleTypes.Content,
        specifications: [{
          specType: ContentSpecificationTypes.SelectedNodeInstances,
        }],
      }],
    };
    propertiesRuleset = await Presentation.presentation.rulesets().add(ruleset);
    propertiesDataProvider = new PresentationPropertyDataProvider(imodel, propertiesRuleset.id);
  });

  it("creates Property Data with favorite properties category", async () => {
    propertiesDataProvider.keys = new KeySet([{ className: "PCJ_TestSchema:TestClass", id: "0x38" }]);
    let propertyData = await propertiesDataProvider.getData();
    expect(propertyData.categories.length).to.be.eq(4);
    expect(propertyData.categories.some((category) => category.name === favoritesCategoryName)).to.be.false;

    // find the property record to make the property favorite
    const record = getPropertyRecordByLabel(propertyData, "Country")!;
    const field = await propertiesDataProvider.getFieldByPropertyRecord(record);
    Presentation.favoriteProperties.add(field!);

    propertyData = await propertiesDataProvider.getData();

    expect(propertyData.categories.length).to.be.eq(5);
    expect(propertyData.categories.some((category) => category.name === favoritesCategoryName)).to.be.true;
  });

  it("favorites all properties under nested content field when merged property record is favorited", async () => {
    propertiesDataProvider.keys = new KeySet([{ className: "PCJ_TestSchema:TestClass", id: "0x38" }, { className: "Generic:PhysicalObject", id: "0x74" }]);
    let propertyData = await propertiesDataProvider.getData();
    expect(propertyData.categories.length).to.be.eq(7);
    expect(propertyData.categories.some((category) => category.name === favoritesCategoryName)).to.be.false;

    // find the property record to make the property favorite
    const record = getPropertyRecordByLabel(propertyData, "area")!;
    const field = await propertiesDataProvider.getFieldByPropertyRecord(record);
    Presentation.favoriteProperties.add(field!);

    propertiesDataProvider.keys = new KeySet([{ className: "Generic:PhysicalObject", id: "0x74" }]);
    propertyData = await propertiesDataProvider.getData();

    expect(propertyData.categories.length).to.eq(5);
    expect(propertyData.categories.some((category) => category.name === favoritesCategoryName)).to.be.true;
    expect(propertyData.records[favoritesCategoryName].length).to.eq(17);
  });

  const getPropertyRecordByLabel = (props: PropertyData, label: string): PropertyRecord | undefined => {
    for (const category of props.categories) {
      const record = props.records[category.name].find((r) => r.property.displayLabel === label);
      if (record)
        return record;
    }
    return undefined;
  };

});
