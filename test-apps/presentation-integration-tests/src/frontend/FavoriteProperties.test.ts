/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import { IModelConnection, PropertyRecord } from "@bentley/imodeljs-frontend";
import { PresentationPropertyDataProvider } from "@bentley/presentation-components";
import { KeySet, Ruleset, RuleTypes, ContentSpecificationTypes, RegisteredRuleset } from "@bentley/presentation-common";
import { Presentation, FavoriteProperties, IModelAppFavoritePropertiesStorage } from "@bentley/presentation-frontend";
import { PropertyData } from "@bentley/ui-components";
import { initialize, terminate } from "../IntegrationTests";

const favoritesCategoryName = "Favorite";
describe("Favorite Properties", () => {

  let imodel: IModelConnection;

  before(async () => {
    await initialize();
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
  let ruleset: Ruleset;

  beforeEach(async () => {
    Presentation.terminate();
    Presentation.initialize();

    ruleset = {
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

  afterEach(async () => {
    await Presentation.favoriteProperties.clear();
  });

  const getPropertyRecordByLabel = (props: PropertyData, label: string): PropertyRecord | undefined => {
    for (const category of props.categories) {
      const record = props.records[category.name].find((r) => r.property.displayLabel === label);
      if (record)
        return record;
    }
    return undefined;
  };

  it("creates Property Data with favorite properties category", async () => {
    propertiesDataProvider.keys = new KeySet([{ className: "PCJ_TestSchema:TestClass", id: "0x38" }]);
    let propertyData = await propertiesDataProvider.getData();
    expect(propertyData.categories.length).to.be.eq(5);
    expect(propertyData.categories.some((category) => category.name === favoritesCategoryName)).to.be.false;

    // find the property record to make the property favorite
    const record = getPropertyRecordByLabel(propertyData, "Country")!;
    const field = await propertiesDataProvider.getFieldByPropertyRecord(record);
    await Presentation.favoriteProperties.add(field!);

    propertyData = await propertiesDataProvider.getData();

    expect(propertyData.categories.length).to.be.eq(6);
    expect(propertyData.categories.some((category) => category.name === favoritesCategoryName)).to.be.true;
  });

  it("favorites all properties under nested content field when merged property record is favorited", async () => {
    propertiesDataProvider.keys = new KeySet([{ className: "PCJ_TestSchema:TestClass", id: "0x38" }, { className: "Generic:PhysicalObject", id: "0x74" }]);
    let propertyData = await propertiesDataProvider.getData();
    expect(propertyData.categories.length).to.be.eq(12);
    expect(propertyData.categories.some((category) => category.name === favoritesCategoryName)).to.be.false;

    // find the property record to make the property favorite
    const record = getPropertyRecordByLabel(propertyData, "area")!;
    const field = await propertiesDataProvider.getFieldByPropertyRecord(record);
    await Presentation.favoriteProperties.add(field!);

    propertiesDataProvider.keys = new KeySet([{ className: "Generic:PhysicalObject", id: "0x74" }]);
    propertyData = await propertiesDataProvider.getData();

    expect(propertyData.categories.length).to.eq(7);
    expect(propertyData.categories.some((category) => category.name === favoritesCategoryName)).to.be.true;
    expect(propertyData.records[favoritesCategoryName].length).to.eq(17);
  });

  it("favorites common properties of different element types", async () => {
    propertiesDataProvider.keys = new KeySet([{ className: "Generic:PhysicalObject", id: "0x74" }]);
    let propertyData = await propertiesDataProvider.getData();
    expect(propertyData.categories.length).to.be.eq(5);
    expect(propertyData.categories.some((category) => category.name === favoritesCategoryName)).to.be.false;

    // find the property record to make the property favorite
    const record = getPropertyRecordByLabel(propertyData, "Model")!;
    const field = await propertiesDataProvider.getFieldByPropertyRecord(record);
    await Presentation.favoriteProperties.add(field!);

    // verify the property is now in favorites group
    propertyData = await propertiesDataProvider.getData();
    expect(propertyData.categories.length).to.eq(6);
    expect(propertyData.categories.some((category) => category.name === favoritesCategoryName)).to.be.true;
    expect(propertyData.records[favoritesCategoryName].length).to.eq(1);
    expect(propertyData.records[favoritesCategoryName][0].property.displayLabel).to.eq("Model");

    // verify the same property is now in favorites group when requesting content for another type of element
    propertiesDataProvider.keys = new KeySet([{ className: "PCJ_TestSchema:TestClass", id: "0x38" }]);
    propertyData = await propertiesDataProvider.getData();
    expect(propertyData.categories.length).to.eq(6);
    expect(propertyData.categories.some((category) => category.name === favoritesCategoryName)).to.be.true;
    expect(propertyData.records[favoritesCategoryName].length).to.eq(1);
    expect(propertyData.records[favoritesCategoryName][0].property.displayLabel).to.eq("Model");
  });

  it("favorites nested content property with the same name as a property on primary instance", async () => {
    propertiesDataProvider.keys = new KeySet([{ className: "Generic:PhysicalObject", id: "0x74" }]);
    let propertyData = await propertiesDataProvider.getData();
    expect(propertyData.categories.length).to.be.eq(5);
    expect(propertyData.categories.some((category) => category.name === favoritesCategoryName)).to.be.false;

    // find the property record to make the property favorite
    const sourceFileInfoCategory = propertyData.categories.find((c) => c.name === "source_file_information")!;
    const sourceFileNameRecord = propertyData.records[sourceFileInfoCategory.name][0];
    const field = await propertiesDataProvider.getFieldByPropertyRecord(sourceFileNameRecord);
    await Presentation.favoriteProperties.add(field!);

    // verify the property is now in favorites group
    propertyData = await propertiesDataProvider.getData();
    expect(propertyData.categories.length).to.eq(6);
    expect(propertyData.categories.some((category) => category.name === favoritesCategoryName)).to.be.true;
    expect(propertyData.records[favoritesCategoryName].length).to.eq(1);
    expect(propertyData.records[favoritesCategoryName][0].property.displayLabel).to.eq(sourceFileNameRecord.property.displayLabel);
  });

  it("favorite properties survive Presentation re-initialization", async () => {
    propertiesDataProvider.keys = new KeySet([{ className: "Generic:PhysicalObject", id: "0x74" }]);
    let propertyData = await propertiesDataProvider.getData();
    expect(propertyData.categories.length).to.be.eq(5);
    expect(propertyData.categories.some((category) => category.name === favoritesCategoryName)).to.be.false;

    // find the property record to make the property favorite
    const record = getPropertyRecordByLabel(propertyData, "Model")!;
    const field = await propertiesDataProvider.getFieldByPropertyRecord(record);
    await Presentation.favoriteProperties.add(field!);

    // verify the property is now in favorites group
    propertyData = await propertiesDataProvider.getData();
    expect(propertyData.categories.length).to.eq(6);
    expect(propertyData.categories.some((category) => category.name === favoritesCategoryName)).to.be.true;
    expect(propertyData.records[favoritesCategoryName].length).to.eq(1);
    expect(propertyData.records[favoritesCategoryName][0].property.displayLabel).to.eq("Model");

    // refresh Presentation
    Presentation.terminate();
    Presentation.initialize();
    propertiesRuleset = await Presentation.presentation.rulesets().add(ruleset);
    propertiesDataProvider = new PresentationPropertyDataProvider(imodel, propertiesRuleset.id);
    propertiesDataProvider.keys = new KeySet([{ className: "Generic:PhysicalObject", id: "0x74" }]);

    // verify the property is still in favorites group
    propertyData = await propertiesDataProvider.getData();
    expect(propertyData.categories.length).to.eq(6);
    expect(propertyData.categories.some((category) => category.name === favoritesCategoryName)).to.be.true;
    expect(propertyData.records[favoritesCategoryName].length).to.eq(1);
    expect(propertyData.records[favoritesCategoryName][0].property.displayLabel).to.eq("Model");
  });

  it("does not reject when multiple data providers at the same time get data from an iModel for the first time", async () => {
    ruleset = {
      id: faker.random.uuid(),
      rules: [{
        ruleType: RuleTypes.Content,
        specifications: [{
          specType: ContentSpecificationTypes.SelectedNodeInstances,
        }],
      }],
    };
    propertiesRuleset = await Presentation.presentation.rulesets().add(ruleset);
    const secondDataProvider = new PresentationPropertyDataProvider(imodel, propertiesRuleset.id);

    const firstDataProviderPromise = (async () => {
      propertiesDataProvider.keys = new KeySet([{ className: "PCJ_TestSchema:TestClass", id: "0x38" }]);
      await propertiesDataProvider.getData();
    })();

    const secondDataProviderPromise = (async () => {
      secondDataProvider.keys = new KeySet([{ className: "Generic:PhysicalObject", id: "0x74" }]);
      await secondDataProvider.getData();
    })();

    await expect(Promise.all([firstDataProviderPromise, secondDataProviderPromise])).to.not.be.rejected;
  });

});

describe("Favorite Properties storage", () => {

  let storage: IModelAppFavoritePropertiesStorage;

  before(async () => {
    await initialize();
  });

  after(async () => {
    terminate();
  });

  beforeEach(async () => {
    storage = new IModelAppFavoritePropertiesStorage();
    await storage.saveProperties(getEmptyFavoriteProperties());
  });

  afterEach(async () => {
    await storage.saveProperties(getEmptyFavoriteProperties());
  });

  const getEmptyFavoriteProperties = () => ({
    nestedContentInfos: new Set<string>(),
    propertyInfos: new Set<string>(),
    baseFieldInfos: new Set<string>(),
  });

  it("loads saved favorite properties from global scope", async () => {
    const properties: FavoriteProperties = {
      nestedContentInfos: new Set<string>(["nestedContentInfo-global"]),
      propertyInfos: new Set<string>(["propertyInfo-global"]),
      baseFieldInfos: new Set<string>(["baseFieldInfos-global"]),
    };
    await storage.saveProperties(properties);

    const returnedStorage = await storage.loadProperties();
    expect(returnedStorage).is.not.null;
    expect(returnedStorage!.propertyInfos.size).to.eq(1);
    expect(returnedStorage!.propertyInfos.has("propertyInfo-global")).to.be.true;
    expect(returnedStorage!.baseFieldInfos.size).to.eq(1);
    expect(returnedStorage!.baseFieldInfos.has("baseFieldInfos-global")).to.be.true;
    expect(returnedStorage!.nestedContentInfos.size).to.eq(1);
    expect(returnedStorage!.nestedContentInfos.has("nestedContentInfo-global")).to.be.true;
  });

});
