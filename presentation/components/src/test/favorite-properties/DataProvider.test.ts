/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "@itwin/presentation-frontend/lib/cjs/test/_helpers/MockFrontendEnvironment";
import { expect } from "chai";
import * as faker from "faker";
import * as path from "path";
import * as moq from "typemoq";
import type { Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import { ITwinLocalization } from "@itwin/core-i18n";
import type { Ruleset } from "@itwin/presentation-common";
import { KeySet } from "@itwin/presentation-common";
import type {
  FavoritePropertiesManager, PresentationManager, RulesetManager, SelectionManager, SelectionScopesManager} from "@itwin/presentation-frontend";
import { Presentation,
} from "@itwin/presentation-frontend";
import { PropertyRecord, PropertyValueFormat } from "@itwin/appui-abstract";
import type { PropertyData } from "@itwin/components-react";
import { FavoritePropertiesDataProvider, getFavoritesCategory } from "../../presentation-components/favorite-properties/DataProvider";
import type { PresentationPropertyDataProvider } from "../../presentation-components/propertygrid/DataProvider";

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

  before(async () => {
    elementId = faker.random.uuid();
    Presentation.setPresentationManager(presentationManagerMock.object);
    Presentation.setSelectionManager(selectionManagerMock.object);
    Presentation.setFavoritePropertiesManager(favoritePropertiesManagerMock.object);
    const localize = new ITwinLocalization({
      urlTemplate: `file://${path.resolve("public/locales")}/{{lng}}/{{ns}}.json`,
    });
    await localize.initialize(["iModelJS"]);
    Presentation.setLocalization(localize);
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
      selectionScopesManager.setup(async (x) => x.computeSelection(moq.It.isAny(), elementId, moq.It.isAny())).returns(async () => new KeySet());
      selectionManagerMock.setup((x) => x.scopes).returns(() => selectionScopesManager.object);
    });

    it("passes `customRulesetId` to PropertyDataProvider if set", async () => {
      presentationPropertyDataProviderMock.setup(async (x) => x.getData()).returns(async () => ({
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
      presentationPropertyDataProviderMock.setup(async (x) => x.getData()).returns(async () => dataToReturn);

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
      presentationPropertyDataProviderMock.setup(async (x) => x.getData()).returns(async () => dataToReturn);

      const data = await provider.getData(imodelMock.object, elementId);
      expect(data.categories.length).to.eq(1);
      expect(data.records[favoritesCategory.name]).to.be.not.undefined;
      expect(data.records[favoritesCategory.name].length).to.eq(1);
      expect(data.records[favoritesCategory.name][0].property.name).to.eq(favoritePropertyName);
    });

  });

});
