/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// tslint:disable: no-direct-imports
import { SnapshotConnection } from "@bentley/imodeljs-frontend";
import { Field, KeySet } from "@bentley/presentation-common";
import { PresentationPropertyDataProvider } from "@bentley/presentation-components";
import { DEFAULT_PROPERTY_GRID_RULESET } from "@bentley/presentation-components/lib/presentation-components/propertygrid/DataProvider";
import { FavoritePropertiesScope, Presentation, PropertyFullName } from "@bentley/presentation-frontend";
import { IModelAppFavoritePropertiesStorage } from "@bentley/presentation-frontend/lib/presentation-frontend/favorite-properties/FavoritePropertiesStorage";
import { PropertyRecord } from "@bentley/ui-abstract";
import { PropertyData } from "@bentley/ui-components";
import { expect } from "chai";
import { initialize, initializeWithClientServices, terminate } from "../IntegrationTests";

const favoritesCategoryName = "Favorite";
describe("Favorite properties", () => {

  let imodel: SnapshotConnection;

  before(async () => {
    await initialize();
    imodel = await SnapshotConnection.openSnapshot("assets/datasets/Properties_60InstancesWithUrl2.ibim");
    expect(imodel).is.not.null;
  });

  after(async () => {
    terminate();
  });

  let propertiesDataProvider: PresentationPropertyDataProvider;

  beforeEach(async () => {
    propertiesDataProvider = new PresentationPropertyDataProvider({ imodel, ruleset: DEFAULT_PROPERTY_GRID_RULESET });
    await Presentation.favoriteProperties.initializeConnection(imodel);
    await Presentation.favoriteProperties.clear(imodel, FavoritePropertiesScope.Global);
    await Presentation.favoriteProperties.clear(imodel, FavoritePropertiesScope.Project);
    await Presentation.favoriteProperties.clear(imodel, FavoritePropertiesScope.IModel);
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
    const categoriesCountBefore = propertyData.categories.length;
    expect(propertyData.categories.some((category) => category.name === favoritesCategoryName)).to.be.false;

    // find the property record to make the property favorite
    const record = getPropertyRecordByLabel(propertyData, "Country")!;
    const field = await propertiesDataProvider.getFieldByPropertyRecord(record);
    await Presentation.favoriteProperties.add(field!);

    // verify we have a new favorites category
    propertyData = await propertiesDataProvider.getData();
    expect(propertyData.categories.length).to.be.eq(categoriesCountBefore + 1);
    expect(propertyData.categories.some((category) => category.name === favoritesCategoryName)).to.be.true;
  });

  it("favorites all properties under nested content field", async () => {
    // request properties for 1 element
    propertiesDataProvider.keys = new KeySet([{ className: "Generic:PhysicalObject", id: "0x74" }]);
    let propertyData = await propertiesDataProvider.getData();
    const categoriesCountBefore = propertyData.categories.length;
    expect(propertyData.categories.some((category) => category.name === favoritesCategoryName)).to.be.false;

    // request properties for 2 elements
    propertiesDataProvider.keys = new KeySet([{ className: "PCJ_TestSchema:TestClass", id: "0x38" }, { className: "Generic:PhysicalObject", id: "0x74" }]);
    propertyData = await propertiesDataProvider.getData();
    expect(propertyData.categories.some((category) => category.name === favoritesCategoryName)).to.be.false;

    // find the property record to make the property favorite
    const record = getPropertyRecordByLabel(propertyData, "area")!;
    const field = await propertiesDataProvider.getFieldByPropertyRecord(record);
    await Presentation.favoriteProperties.add(field!);

    // request properties for 1 element again
    propertiesDataProvider.keys = new KeySet([{ className: "Generic:PhysicalObject", id: "0x74" }]);
    propertyData = await propertiesDataProvider.getData();
    expect(propertyData.categories.length).to.eq(categoriesCountBefore + 1);
    expect(propertyData.categories.some((category) => category.name === favoritesCategoryName)).to.be.true;
  });

  it("favorites common properties of different element types", async () => {
    propertiesDataProvider.keys = new KeySet([{ className: "Generic:PhysicalObject", id: "0x74" }]);
    let propertyData = await propertiesDataProvider.getData();
    const categoriesCountBefore = propertyData.categories.length;
    expect(propertyData.categories.some((category) => category.name === favoritesCategoryName)).to.be.false;

    // find the property record to make the property favorite
    const record = getPropertyRecordByLabel(propertyData, "Model")!;
    const field = await propertiesDataProvider.getFieldByPropertyRecord(record);
    await Presentation.favoriteProperties.add(field!);

    // verify the property is now in favorites group
    propertyData = await propertiesDataProvider.getData();
    expect(propertyData.categories.length).to.eq(categoriesCountBefore + 1);
    expect(propertyData.categories.some((category) => category.name === favoritesCategoryName)).to.be.true;
    expect(propertyData.records[favoritesCategoryName][0].property.displayLabel).to.eq("Model");

    // verify the same property is now in favorites group when requesting content for another type of element
    propertiesDataProvider.keys = new KeySet([{ className: "PCJ_TestSchema:TestClass", id: "0x38" }]);
    propertyData = await propertiesDataProvider.getData();
    expect(propertyData.categories.some((category) => category.name === favoritesCategoryName)).to.be.true;
    expect(propertyData.records[favoritesCategoryName][0].property.displayLabel).to.eq("Model");
  });

  it("favorites nested content property with the same name as a property on primary instance", async () => {
    propertiesDataProvider.keys = new KeySet([{ className: "Generic:PhysicalObject", id: "0x74" }]);
    let propertyData = await propertiesDataProvider.getData();
    const categoriesCountBefore = propertyData.categories.length;
    expect(propertyData.categories.some((category) => category.name === favoritesCategoryName)).to.be.false;

    // find the property record to make the property favorite
    const sourceFileInfoCategory = propertyData.categories.find((c) => c.name === "source_file_information")!;
    const sourceFileNameRecord = propertyData.records[sourceFileInfoCategory.name][0];
    const field = await propertiesDataProvider.getFieldByPropertyRecord(sourceFileNameRecord);
    await Presentation.favoriteProperties.add(field!);

    // verify the property is now in favorites group
    propertyData = await propertiesDataProvider.getData();
    expect(propertyData.categories.length).to.eq(categoriesCountBefore + 1);
    expect(propertyData.categories.some((category) => category.name === favoritesCategoryName)).to.be.true;
    expect(propertyData.records[favoritesCategoryName][0].property.displayLabel).to.eq(sourceFileNameRecord.property.displayLabel);
  });

  describe("#with-services", () => {

    before(async () => {
      terminate();
      await initializeWithClientServices();
      imodel = await SnapshotConnection.openSnapshot("assets/datasets/Properties_60InstancesWithUrl2.ibim");
      expect(imodel).is.not.null;
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
      await Presentation.initialize();
      propertiesDataProvider = new PresentationPropertyDataProvider({ imodel, ruleset: DEFAULT_PROPERTY_GRID_RULESET });
      propertiesDataProvider.keys = new KeySet([{ className: "Generic:PhysicalObject", id: "0x74" }]);

      // verify the property is still in favorites group
      propertyData = await propertiesDataProvider.getData();
      expect(propertyData.categories.length).to.eq(6);
      expect(propertyData.categories.some((category) => category.name === favoritesCategoryName)).to.be.true;
      expect(propertyData.records[favoritesCategoryName].length).to.eq(1);
      expect(propertyData.records[favoritesCategoryName][0].property.displayLabel).to.eq("Model");
    });

  });

  describe("ordering", () => {

    const makeFieldFavorite = async (propertyData: PropertyData, fieldLabel: string) => {
      const record = getPropertyRecordByLabel(propertyData, fieldLabel)!;
      const field = await propertiesDataProvider.getFieldByPropertyRecord(record);
      await Presentation.favoriteProperties.add(field!, imodel, FavoritePropertiesScope.Global);
    };

    it("moves a field to the top", async () => {
      propertiesDataProvider.keys = new KeySet([{ className: "PCJ_TestSchema:TestClass", id: "0x65" }]);

      let propertyData = await propertiesDataProvider.getData();
      await makeFieldFavorite(propertyData, "Model");
      await makeFieldFavorite(propertyData, "Category");

      propertyData = await propertiesDataProvider.getData();
      expect(propertyData.records[favoritesCategoryName].length).to.eq(2);
      expect(propertyData.records[favoritesCategoryName][0].property.displayLabel).to.eq("Model");
      expect(propertyData.records[favoritesCategoryName][1].property.displayLabel).to.eq("Category");

      const visibleFavoriteFields = await Promise.all(
        propertyData.records[favoritesCategoryName].map(async (property) => propertiesDataProvider.getFieldByPropertyRecord(property)),
      );
      expect(visibleFavoriteFields.every((f) => f !== undefined)).to.be.true;

      const record = getPropertyRecordByLabel(propertyData, "Category")!;
      const field = await propertiesDataProvider.getFieldByPropertyRecord(record);
      await Presentation.favoriteProperties.changeFieldPriority(imodel, field!, undefined, visibleFavoriteFields as Field[]);

      propertyData = await propertiesDataProvider.getData();
      expect(propertyData.records[favoritesCategoryName][0].property.displayLabel).to.eq("Category");
      expect(propertyData.records[favoritesCategoryName][1].property.displayLabel).to.eq("Model");
    });

    it("keeps the logical order of non-visible fields when there are relevant fields", async () => {
      propertiesDataProvider.keys = new KeySet([{ className: "PCJ_TestSchema:TestClass", id: "0x65" }, { className: "Generic:PhysicalObject", id: "0x74" }]);

      let propertyData = await propertiesDataProvider.getData();
      await makeFieldFavorite(propertyData, "Code");
      await makeFieldFavorite(propertyData, "area");
      await makeFieldFavorite(propertyData, "Model"); // `Model` is relevant for property `area`

      propertyData = await propertiesDataProvider.getData();
      expect(propertyData.records[favoritesCategoryName].length).to.eq(3);
      expect(propertyData.records[favoritesCategoryName][0].property.displayLabel).to.eq("Code");
      expect(propertyData.records[favoritesCategoryName][1].property.displayLabel).to.eq("area");
      expect(propertyData.records[favoritesCategoryName][2].property.displayLabel).to.eq("Model");

      propertiesDataProvider.keys = new KeySet([{ className: "PCJ_TestSchema:TestClass", id: "0x65" }]); // element without `area` property
      propertyData = await propertiesDataProvider.getData();

      const visibleFavoriteFields = await Promise.all(
        propertyData.records[favoritesCategoryName].map(async (property) => propertiesDataProvider.getFieldByPropertyRecord(property)),
      );
      expect(visibleFavoriteFields.every((f) => f !== undefined)).to.be.true;

      let record = getPropertyRecordByLabel(propertyData, "Code")!;
      const codeField = (await propertiesDataProvider.getFieldByPropertyRecord(record))!;
      record = getPropertyRecordByLabel(propertyData, "Model")!;
      const modelField = (await propertiesDataProvider.getFieldByPropertyRecord(record))!;
      await Presentation.favoriteProperties.changeFieldPriority(imodel, codeField, modelField, visibleFavoriteFields as Field[]);

      propertiesDataProvider.keys = new KeySet([{ className: "PCJ_TestSchema:TestClass", id: "0x65" }, { className: "Generic:PhysicalObject", id: "0x74" }]);
      propertyData = await propertiesDataProvider.getData();
      expect(propertyData.records[favoritesCategoryName][0].property.displayLabel).to.eq("area");
      expect(propertyData.records[favoritesCategoryName][1].property.displayLabel).to.eq("Model");
      expect(propertyData.records[favoritesCategoryName][2].property.displayLabel).to.eq("Code");
    });

    it("keeps the logical order of non-visible fields when there are no relevant fields", async () => {
      propertiesDataProvider.keys = new KeySet([{ className: "PCJ_TestSchema:TestClass", id: "0x65" }, { className: "Generic:PhysicalObject", id: "0x74" }]);

      let propertyData = await propertiesDataProvider.getData();
      await makeFieldFavorite(propertyData, "Code");
      await makeFieldFavorite(propertyData, "area");
      await makeFieldFavorite(propertyData, "Country"); // `Country` is irrelevant for property `area`

      propertyData = await propertiesDataProvider.getData();
      expect(propertyData.records[favoritesCategoryName].length).to.eq(3);
      expect(propertyData.records[favoritesCategoryName][0].property.displayLabel).to.eq("Code");
      expect(propertyData.records[favoritesCategoryName][1].property.displayLabel).to.eq("area");
      expect(propertyData.records[favoritesCategoryName][2].property.displayLabel).to.eq("Country");

      propertiesDataProvider.keys = new KeySet([{ className: "PCJ_TestSchema:TestClass", id: "0x65" }]); // element withtout `area` property
      propertyData = await propertiesDataProvider.getData();

      const visibleFavoriteFields = await Promise.all(
        propertyData.records[favoritesCategoryName].map(async (property) => propertiesDataProvider.getFieldByPropertyRecord(property)),
      );
      expect(visibleFavoriteFields.every((f) => f !== undefined)).to.be.true;

      let record = getPropertyRecordByLabel(propertyData, "Code")!;
      const codeField = (await propertiesDataProvider.getFieldByPropertyRecord(record))!;
      record = getPropertyRecordByLabel(propertyData, "Country")!;
      const modelField = (await propertiesDataProvider.getFieldByPropertyRecord(record))!;
      await Presentation.favoriteProperties.changeFieldPriority(imodel, codeField, modelField, visibleFavoriteFields as Field[]);

      propertiesDataProvider.keys = new KeySet([{ className: "PCJ_TestSchema:TestClass", id: "0x65" }, { className: "Generic:PhysicalObject", id: "0x74" }]);
      propertyData = await propertiesDataProvider.getData();
      expect(propertyData.records[favoritesCategoryName][0].property.displayLabel).to.eq("Country");
      expect(propertyData.records[favoritesCategoryName][1].property.displayLabel).to.eq("Code");
      expect(propertyData.records[favoritesCategoryName][2].property.displayLabel).to.eq("area");
    });

  });

});

describe("IModelAppFavoritePropertiesStorage", () => {

  let storage: IModelAppFavoritePropertiesStorage;

  describe("#with-services", () => {

    before(async () => {
      await initializeWithClientServices();
    });

    after(async () => {
      terminate();
    });

    beforeEach(async () => {
      storage = new IModelAppFavoritePropertiesStorage();
      // call this to clean up the settings service before the test (just in case there're any trash)
      await storage.saveProperties(new Set<PropertyFullName>());
    });

    afterEach(async () => {
      // call this after test to clean up the stuff stored in the settings service
      await storage.saveProperties(new Set<PropertyFullName>());
    });

    it("loads saved favorite properties from global scope", async () => {
      const properties = new Set<PropertyFullName>(["propertyInfo-global", "baseFieldInfos-global"]);
      await storage.saveProperties(properties);

      const returnedStorage = await storage.loadProperties();
      expect(returnedStorage).is.not.null;
      expect(returnedStorage!.size).to.eq(2);
      expect(returnedStorage!.has("propertyInfo-global")).to.be.true;
      expect(returnedStorage!.has("baseFieldInfos-global")).to.be.true;
    });

  });

});
