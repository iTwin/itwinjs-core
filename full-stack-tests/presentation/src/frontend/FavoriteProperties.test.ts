/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import sinon from "sinon";
import { IModelApp, IModelConnection, SnapshotConnection } from "@bentley/imodeljs-frontend";
import { Field, KeySet } from "@bentley/presentation-common";
import { PresentationPropertyDataProvider } from "@bentley/presentation-components";
import { FAVORITES_CATEGORY_NAME } from "@bentley/presentation-components/lib/presentation-components/favorite-properties/DataProvider";
import { DEFAULT_PROPERTY_GRID_RULESET } from "@bentley/presentation-components/lib/presentation-components/propertygrid/DataProvider";
import { FavoritePropertiesScope, Presentation } from "@bentley/presentation-frontend";
import { SettingsResult, SettingsStatus } from "@bentley/product-settings-client";
import { PropertyRecord } from "@bentley/ui-abstract";
import { PropertyData } from "@bentley/ui-components";
import { initialize, initializeWithClientServices, terminate } from "../IntegrationTests";

describe("Favorite properties", () => {

  let imodel: IModelConnection;
  async function openIModel() {
    imodel = await SnapshotConnection.openFile("assets/datasets/Properties_60InstancesWithUrl2.ibim");
    expect(imodel).is.not.null;
  }

  before(async () => {
    await initialize();
    await openIModel();
  });

  after(async () => {
    await imodel.close();
    await terminate();
  });

  let propertiesDataProvider: PresentationPropertyDataProvider;

  beforeEach(async () => {
    propertiesDataProvider = new PresentationPropertyDataProvider({ imodel, ruleset: DEFAULT_PROPERTY_GRID_RULESET });
    await Presentation.favoriteProperties.initializeConnection(imodel);
  });

  const getPropertyRecordByLabel = (props: PropertyData, label: string): PropertyRecord | undefined => {
    for (const category of props.categories) {
      const record = props.records[category.name].find((r) => r.property.displayLabel === label);
      if (record)
        return record;
    }
    return undefined;
  };

  describe("favoriting different types of properties", () => {

    beforeEach(async () => {
      // note: Presentation is initialized without client services, so favorite properties are stored locally - clearing
      // them doesn't affect what's stored in user settings service
      await Presentation.favoriteProperties.clear(imodel, FavoritePropertiesScope.Global);
      await Presentation.favoriteProperties.clear(imodel, FavoritePropertiesScope.Project);
      await Presentation.favoriteProperties.clear(imodel, FavoritePropertiesScope.IModel);
    });

    it("creates Property Data with favorite properties category", async () => {
      propertiesDataProvider.keys = new KeySet([{ className: "PCJ_TestSchema:TestClass", id: "0x38" }]);
      let propertyData = await propertiesDataProvider.getData();
      const categoriesCountBefore = propertyData.categories.length;
      expect(propertyData.categories.some((category) => category.name === FAVORITES_CATEGORY_NAME)).to.be.false;

      // find the property record to make the property favorite
      const record = getPropertyRecordByLabel(propertyData, "Country")!;
      const field = await propertiesDataProvider.getFieldByPropertyRecord(record);
      await Presentation.favoriteProperties.add(field!, imodel, FavoritePropertiesScope.Global);

      // verify we have a new favorites category
      propertyData = await propertiesDataProvider.getData();
      expect(propertyData.categories.length).to.be.eq(categoriesCountBefore + 1);
      expect(propertyData.categories.some((category) => category.name === FAVORITES_CATEGORY_NAME)).to.be.true;
    });

    it("favorites all properties under nested content field", async () => {
      // request properties for 1 element
      propertiesDataProvider.keys = new KeySet([{ className: "Generic:PhysicalObject", id: "0x74" }]);
      let propertyData = await propertiesDataProvider.getData();
      const categoriesCountBefore = propertyData.categories.length;
      expect(propertyData.categories.some((category) => category.name === FAVORITES_CATEGORY_NAME)).to.be.false;

      // request properties for 2 elements
      propertiesDataProvider.keys = new KeySet([{ className: "PCJ_TestSchema:TestClass", id: "0x38" }, { className: "Generic:PhysicalObject", id: "0x74" }]);
      propertyData = await propertiesDataProvider.getData();
      expect(propertyData.categories.some((category) => category.name === FAVORITES_CATEGORY_NAME)).to.be.false;

      // find the property record to make the property favorite
      const record = getPropertyRecordByLabel(propertyData, "area")!;
      const field = await propertiesDataProvider.getFieldByPropertyRecord(record);
      await Presentation.favoriteProperties.add(field!, imodel, FavoritePropertiesScope.Global);

      // request properties for 1 element again
      propertiesDataProvider.keys = new KeySet([{ className: "Generic:PhysicalObject", id: "0x74" }]);
      propertyData = await propertiesDataProvider.getData();
      expect(propertyData.categories.length).to.eq(categoriesCountBefore + 1);
      expect(propertyData.categories.some((category) => category.name === FAVORITES_CATEGORY_NAME)).to.be.true;
    });

    it("favorites common properties of different element types", async () => {
      propertiesDataProvider.keys = new KeySet([{ className: "Generic:PhysicalObject", id: "0x74" }]);
      let propertyData = await propertiesDataProvider.getData();
      const categoriesCountBefore = propertyData.categories.length;
      expect(propertyData.categories.some((category) => category.name === FAVORITES_CATEGORY_NAME)).to.be.false;

      // find the property record to make the property favorite
      const record = getPropertyRecordByLabel(propertyData, "Model")!;
      const field = await propertiesDataProvider.getFieldByPropertyRecord(record);
      await Presentation.favoriteProperties.add(field!, imodel, FavoritePropertiesScope.Global);

      // verify the property is now in favorites group
      propertyData = await propertiesDataProvider.getData();
      expect(propertyData.categories.length).to.eq(categoriesCountBefore + 1);
      expect(propertyData.categories.some((category) => category.name === FAVORITES_CATEGORY_NAME)).to.be.true;
      expect(propertyData.records[FAVORITES_CATEGORY_NAME][0].property.displayLabel).to.eq("Model");

      // verify the same property is now in favorites group when requesting content for another type of element
      propertiesDataProvider.keys = new KeySet([{ className: "PCJ_TestSchema:TestClass", id: "0x38" }]);
      propertyData = await propertiesDataProvider.getData();
      expect(propertyData.categories.some((category) => category.name === FAVORITES_CATEGORY_NAME)).to.be.true;
      expect(propertyData.records[FAVORITES_CATEGORY_NAME][0].property.displayLabel).to.eq("Model");
    });

    it("favorites nested content property with the same name as a property on primary instance", async () => {
      propertiesDataProvider.keys = new KeySet([{ className: "Generic:PhysicalObject", id: "0x74" }]);
      let propertyData = await propertiesDataProvider.getData();
      const categoriesCountBefore = propertyData.categories.length;
      expect(propertyData.categories.some((category) => category.name === FAVORITES_CATEGORY_NAME)).to.be.false;

      // find the property record to make the property favorite
      const sourceInfoModelSourceCategory = propertyData.categories.find((c) => c.name.endsWith("model_source"))!;
      const sourceFileNameRecord = propertyData.records[sourceInfoModelSourceCategory.name][0];
      const field = await propertiesDataProvider.getFieldByPropertyRecord(sourceFileNameRecord);
      await Presentation.favoriteProperties.add(field!, imodel, FavoritePropertiesScope.Global);

      // verify the property is now in favorites group
      propertyData = await propertiesDataProvider.getData();
      expect(propertyData.categories.length).to.eq(categoriesCountBefore + 1);
      expect(propertyData.categories.some((category) => category.name === FAVORITES_CATEGORY_NAME)).to.be.true;
      expect(propertyData.records[FAVORITES_CATEGORY_NAME][0].property.displayLabel).to.eq(sourceFileNameRecord.property.displayLabel);
    });

  });

  describe("ordering", () => {

    beforeEach(async () => {
      // note: Presentation is initialized without client services, so favorite properties are stored locally - clearing
      // them doesn't affect what's stored in user settings service
      await Presentation.favoriteProperties.clear(imodel, FavoritePropertiesScope.Global);
      await Presentation.favoriteProperties.clear(imodel, FavoritePropertiesScope.Project);
      await Presentation.favoriteProperties.clear(imodel, FavoritePropertiesScope.IModel);
    });

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
      expect(propertyData.records[FAVORITES_CATEGORY_NAME].length).to.eq(2);
      expect(propertyData.records[FAVORITES_CATEGORY_NAME][0].property.displayLabel).to.eq("Model");
      expect(propertyData.records[FAVORITES_CATEGORY_NAME][1].property.displayLabel).to.eq("Category");

      const visibleFavoriteFields = await Promise.all(
        propertyData.records[FAVORITES_CATEGORY_NAME].map(async (property) => propertiesDataProvider.getFieldByPropertyRecord(property)),
      );
      expect(visibleFavoriteFields.every((f) => f !== undefined)).to.be.true;

      const record = getPropertyRecordByLabel(propertyData, "Category")!;
      const field = await propertiesDataProvider.getFieldByPropertyRecord(record);
      await Presentation.favoriteProperties.changeFieldPriority(imodel, field!, undefined, visibleFavoriteFields as Field[]);

      propertyData = await propertiesDataProvider.getData();
      expect(propertyData.records[FAVORITES_CATEGORY_NAME][0].property.displayLabel).to.eq("Category");
      expect(propertyData.records[FAVORITES_CATEGORY_NAME][1].property.displayLabel).to.eq("Model");
    });

    it("keeps the logical order of non-visible fields when there are relevant fields", async () => {
      propertiesDataProvider.keys = new KeySet([{ className: "PCJ_TestSchema:TestClass", id: "0x65" }, { className: "Generic:PhysicalObject", id: "0x74" }]);

      let propertyData = await propertiesDataProvider.getData();
      await makeFieldFavorite(propertyData, "Code");
      await makeFieldFavorite(propertyData, "area");
      await makeFieldFavorite(propertyData, "Model"); // `Model` is relevant for property `area`

      propertyData = await propertiesDataProvider.getData();
      expect(propertyData.records[FAVORITES_CATEGORY_NAME].length).to.eq(3);
      expect(propertyData.records[FAVORITES_CATEGORY_NAME][0].property.displayLabel).to.eq("Code");
      expect(propertyData.records[FAVORITES_CATEGORY_NAME][1].property.displayLabel).to.eq("area");
      expect(propertyData.records[FAVORITES_CATEGORY_NAME][2].property.displayLabel).to.eq("Model");

      propertiesDataProvider.keys = new KeySet([{ className: "PCJ_TestSchema:TestClass", id: "0x65" }]); // element without `area` property
      propertyData = await propertiesDataProvider.getData();

      const visibleFavoriteFields = await Promise.all(
        propertyData.records[FAVORITES_CATEGORY_NAME].map(async (property) => propertiesDataProvider.getFieldByPropertyRecord(property)),
      );
      expect(visibleFavoriteFields.every((f) => f !== undefined)).to.be.true;

      let record = getPropertyRecordByLabel(propertyData, "Code")!;
      const codeField = (await propertiesDataProvider.getFieldByPropertyRecord(record))!;
      record = getPropertyRecordByLabel(propertyData, "Model")!;
      const modelField = (await propertiesDataProvider.getFieldByPropertyRecord(record))!;
      await Presentation.favoriteProperties.changeFieldPriority(imodel, codeField, modelField, visibleFavoriteFields as Field[]);

      propertiesDataProvider.keys = new KeySet([{ className: "PCJ_TestSchema:TestClass", id: "0x65" }, { className: "Generic:PhysicalObject", id: "0x74" }]);
      propertyData = await propertiesDataProvider.getData();
      expect(propertyData.records[FAVORITES_CATEGORY_NAME][0].property.displayLabel).to.eq("area");
      expect(propertyData.records[FAVORITES_CATEGORY_NAME][1].property.displayLabel).to.eq("Model");
      expect(propertyData.records[FAVORITES_CATEGORY_NAME][2].property.displayLabel).to.eq("Code");
    });

    it("keeps the logical order of non-visible fields when there are no relevant fields", async () => {
      propertiesDataProvider.keys = new KeySet([{ className: "PCJ_TestSchema:TestClass", id: "0x65" }, { className: "Generic:PhysicalObject", id: "0x74" }]);

      let propertyData = await propertiesDataProvider.getData();
      await makeFieldFavorite(propertyData, "Code");
      await makeFieldFavorite(propertyData, "area");
      await makeFieldFavorite(propertyData, "Country"); // `Country` is irrelevant for property `area`

      propertyData = await propertiesDataProvider.getData();
      expect(propertyData.records[FAVORITES_CATEGORY_NAME].length).to.eq(3);
      expect(propertyData.records[FAVORITES_CATEGORY_NAME][0].property.displayLabel).to.eq("Code");
      expect(propertyData.records[FAVORITES_CATEGORY_NAME][1].property.displayLabel).to.eq("area");
      expect(propertyData.records[FAVORITES_CATEGORY_NAME][2].property.displayLabel).to.eq("Country");

      propertiesDataProvider.keys = new KeySet([{ className: "PCJ_TestSchema:TestClass", id: "0x65" }]); // element withtout `area` property
      propertyData = await propertiesDataProvider.getData();

      const visibleFavoriteFields = await Promise.all(
        propertyData.records[FAVORITES_CATEGORY_NAME].map(async (property) => propertiesDataProvider.getFieldByPropertyRecord(property)),
      );
      expect(visibleFavoriteFields.every((f) => f !== undefined)).to.be.true;

      let record = getPropertyRecordByLabel(propertyData, "Code")!;
      const codeField = (await propertiesDataProvider.getFieldByPropertyRecord(record))!;
      record = getPropertyRecordByLabel(propertyData, "Country")!;
      const modelField = (await propertiesDataProvider.getFieldByPropertyRecord(record))!;
      await Presentation.favoriteProperties.changeFieldPriority(imodel, codeField, modelField, visibleFavoriteFields as Field[]);

      propertiesDataProvider.keys = new KeySet([{ className: "PCJ_TestSchema:TestClass", id: "0x65" }, { className: "Generic:PhysicalObject", id: "0x74" }]);
      propertyData = await propertiesDataProvider.getData();
      expect(propertyData.records[FAVORITES_CATEGORY_NAME][0].property.displayLabel).to.eq("Country");
      expect(propertyData.records[FAVORITES_CATEGORY_NAME][1].property.displayLabel).to.eq("Code");
      expect(propertyData.records[FAVORITES_CATEGORY_NAME][2].property.displayLabel).to.eq("area");
    });

  });

  describe("#with-services", () => {

    before(async () => {
      await imodel.close();
      await terminate();
      await initializeWithClientServices();
      await openIModel();
    });

    it("favorite properties survive Presentation re-initialization", async () => {
      const storage = new Map<string, any>();
      sinon.stub(IModelApp.settings, "saveUserSetting").callsFake(async (_, value, _settingNs, settingId) => {
        storage.set(settingId, value);
        return new SettingsResult(SettingsStatus.Success);
      });
      sinon.stub(IModelApp.settings, "getUserSetting").callsFake(async (_, _settingNs, settingId) => {
        return new SettingsResult(SettingsStatus.Success, undefined, storage.get(settingId));
      });

      propertiesDataProvider.keys = new KeySet([{ className: "Generic:PhysicalObject", id: "0x74" }]);
      let propertyData = await propertiesDataProvider.getData();
      expect(propertyData.categories.length).to.be.eq(5);
      expect(propertyData.categories.some((category) => category.name === FAVORITES_CATEGORY_NAME)).to.be.false;

      // find the property record to make the property favorite
      const record = getPropertyRecordByLabel(propertyData, "Model")!;
      const field = await propertiesDataProvider.getFieldByPropertyRecord(record);
      await Presentation.favoriteProperties.add(field!, imodel, FavoritePropertiesScope.Global);

      // verify the property is now in favorites group
      propertyData = await propertiesDataProvider.getData();
      expect(propertyData.categories.length).to.eq(6);
      expect(propertyData.categories.some((category) => category.name === FAVORITES_CATEGORY_NAME)).to.be.true;
      expect(propertyData.records[FAVORITES_CATEGORY_NAME].length).to.eq(1);
      expect(propertyData.records[FAVORITES_CATEGORY_NAME][0].property.displayLabel).to.eq("Model");

      // refresh Presentation
      Presentation.terminate();
      await Presentation.initialize();
      propertiesDataProvider = new PresentationPropertyDataProvider({ imodel, ruleset: DEFAULT_PROPERTY_GRID_RULESET });
      propertiesDataProvider.keys = new KeySet([{ className: "Generic:PhysicalObject", id: "0x74" }]);

      // verify the property is still in favorites group
      propertyData = await propertiesDataProvider.getData();
      expect(propertyData.categories.length).to.eq(6);
      expect(propertyData.categories.some((category) => category.name === FAVORITES_CATEGORY_NAME)).to.be.true;
      expect(propertyData.records[FAVORITES_CATEGORY_NAME].length).to.eq(1);
      expect(propertyData.records[FAVORITES_CATEGORY_NAME][0].property.displayLabel).to.eq("Model");
    });

  });

});
