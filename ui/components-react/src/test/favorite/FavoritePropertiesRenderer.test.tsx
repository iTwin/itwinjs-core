/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as faker from "faker";
import { PropertyRecord } from "@itwin/appui-abstract";
import { PropertyCategory, PropertyData } from "../../components-react";
import { FavoritePropertiesRenderer } from "../../components-react/favorite/FavoritePropertiesRenderer";
import TestUtils from "../TestUtils";

describe("FavoritePropertiesRenderer", () => {

  let dataProvider: FavoritePropertiesDataProvider;
  let renderer: FavoritePropertiesRenderer;

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  class FavoritePropertiesDataProvider {
    private _categories: PropertyCategory[] = [
      { name: "Favorite", label: "Group 1", expand: true },
    ];
    private _records: PropertyRecord[] = [
      TestUtils.createPrimitiveStringProperty("CADID1", "0000 0005 00E0 02D8"),
      TestUtils.createPrimitiveStringProperty("CADID2", "0000 0005 00E0 02D8"),
    ];

    public getData = async (): Promise<PropertyData> => ({
      label: PropertyRecord.fromString(faker.random.word()),
      description: faker.random.words(),
      categories: this._categories,
      records: {
        Favorite: this._records,
      },
    });
  }

  beforeEach(() => {
    dataProvider = new FavoritePropertiesDataProvider();
    renderer = new FavoritePropertiesRenderer();
  });

  describe("renderFavorites", () => {

    it("should render a tooltip for an element", async () => {
      const propertyData = await dataProvider.getData();
      const tooltip = renderer.renderFavorites(propertyData);
      expect(tooltip).to.not.be.null;
    });

  });

  describe("hasFavorites", () => {

    it("should correctly determine if has favorites", async () => {
      const propertyData = await dataProvider.getData();
      const hasFavorites = renderer.hasFavorites(propertyData);
      expect(hasFavorites).to.be.true;
    });

  });

});
