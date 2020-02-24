/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* tslint:disable:no-direct-imports */

import "@bentley/presentation-frontend/lib/test/_helpers/MockFrontendEnvironment";
import { expect } from "chai";
import * as path from "path";
import * as faker from "faker";
import * as moq from "@bentley/presentation-common/lib/test/_helpers/Mocks";
import { Id64String } from "@bentley/bentleyjs-core";
import { I18N } from "@bentley/imodeljs-i18n";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { PropertyRecord, PropertyValueFormat } from "@bentley/ui-abstract";
import { PropertyData } from "@bentley/ui-components";
import { KeySet, Ruleset } from "@bentley/presentation-common";
import { FavoritePropertiesManager, Presentation, PresentationManager, RulesetManager, SelectionManager, SelectionScopesManager } from "@bentley/presentation-frontend";
import { FavoritePropertiesDataProvider, getFavoritesCategory } from "../../presentation-components/favorite-properties/DataProvider";
import { PresentationPropertyDataProvider } from "../../presentation-components/propertygrid/DataProvider";

describe("FavoritePropertiesDataProvider", () => {

  let provider: FavoritePropertiesDataProvider;
  let elementId: Id64String;
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const presentationManagerMock = moq.Mock.ofType<PresentationManager>();
  const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
  const rulesetsManagerMock = moq.Mock.ofType<RulesetManager>();
  const presentationPropertyDataProviderMock = moq.Mock.ofType<PresentationPropertyDataProvider>();
  const favoritePropertiesManagerMock = moq.Mock.ofType<FavoritePropertiesManager>();
  const factoryMock = moq.Mock.ofType<(imodel: IModelConnection, ruleset?: Ruleset | string) => PresentationPropertyDataProvider>();

  before(() => {
    elementId = faker.random.uuid();
    Presentation.presentation = presentationManagerMock.object;
    Presentation.selection = selectionManagerMock.object;
    Presentation.favoriteProperties = favoritePropertiesManagerMock.object;
    Presentation.i18n = new I18N("", {
      urlTemplate: `file://${path.resolve("public/locales")}/{{lng}}/{{ns}}.json`,
    });
  });

  after(() => {
    Presentation.terminate();
  });

  beforeEach(() => {
    presentationManagerMock.reset();
    selectionManagerMock.reset();
    rulesetsManagerMock.reset();
    presentationPropertyDataProviderMock.reset();
    favoritePropertiesManagerMock.reset();

    presentationManagerMock.setup((x) => x.rulesets()).returns(() => rulesetsManagerMock.object);
    factoryMock.setup((x) => x(moq.It.isAny(), moq.It.isAny())).returns(() => presentationPropertyDataProviderMock.object);
    provider = new FavoritePropertiesDataProvider({ propertyDataProviderFactory: factoryMock.object });
  });

  describe("constructor", () => {

    it("sets `includeFieldsWithNoValues` to true", () => {
      expect(provider.includeFieldsWithNoValues).to.be.true;
    });

    it("sets `includeFieldsWithCompositeValues` to true", () => {
      expect(provider.includeFieldsWithCompositeValues).to.be.true;
    });

  });

  describe("getData", () => {

    beforeEach(() => {
      const selectionScopesManager = moq.Mock.ofType<SelectionScopesManager>();
      selectionScopesManager.setup((x) => x.computeSelection(moq.It.isAny(), [elementId], moq.It.isAny())).returns(async () => new KeySet());
      selectionManagerMock.setup((x) => x.scopes).returns(() => selectionScopesManager.object);
    });

    it("passes `customRulesetId` to PropertyDataProvider if set", async () => {
      presentationPropertyDataProviderMock.setup((x) => x.getData()).returns(async () => ({
        label: PropertyRecord.fromString(faker.random.word()),
        categories: [],
        records: {},
      }));

      const customRulesetId = faker.random.word();
      provider = new FavoritePropertiesDataProvider({ propertyDataProviderFactory: factoryMock.object, ruleset: customRulesetId });

      await provider.getData(imodelMock.object, elementId);
      factoryMock.verify((x) => x(imodelMock.object, customRulesetId), moq.Times.once());
    });

    it("returns empty property data when there is no favorite category", async () => {
      const dataToReturn: PropertyData = {
        label: PropertyRecord.fromString(faker.random.word()),
        categories: [{ label: faker.random.word(), name: "test", expand: true }],
        records: {
          test: [
            new PropertyRecord(
              { valueFormat: PropertyValueFormat.Primitive, displayValue: faker.random.word() },
              { typename: faker.database.type(), name: faker.random.word(), displayLabel: faker.random.word() }),
          ],
        },
      };
      presentationPropertyDataProviderMock.setup((x) => x.getData()).returns(async () => dataToReturn);

      const data = await provider.getData(imodelMock.object, elementId);
      expect(data.categories.length).to.eq(0);
      expect(Object.keys(data.records).length).to.eq(0);
    });

    it("filters out only favorite category", async () => {
      const favoritesCategory = getFavoritesCategory();
      const favoritePropertyName = faker.random.word();
      const regularPropertyName = faker.random.word();

      const dataToReturn: PropertyData = {
        label: PropertyRecord.fromString(faker.random.word()),
        categories: [favoritesCategory, { label: faker.random.word(), name: "test", expand: true }],
        records: {
          [favoritesCategory.name]: [
            new PropertyRecord(
              { valueFormat: PropertyValueFormat.Primitive, displayValue: faker.random.word() },
              { typename: faker.database.type(), name: favoritePropertyName, displayLabel: faker.random.word() }),
          ],
          test: [
            new PropertyRecord(
              { valueFormat: PropertyValueFormat.Primitive, displayValue: faker.random.word() },
              { typename: faker.database.type(), name: regularPropertyName, displayLabel: faker.random.word() }),
          ],
        },
      };
      presentationPropertyDataProviderMock.setup((x) => x.getData()).returns(async () => dataToReturn);

      const data = await provider.getData(imodelMock.object, elementId);
      expect(data.categories.length).to.eq(1);
      expect(data.records[favoritesCategory.name]).to.be.not.undefined;
      expect(data.records[favoritesCategory.name].length).to.eq(1);
      expect(data.records[favoritesCategory.name][0].property.name).to.eq(favoritePropertyName);
    });

  });

});
