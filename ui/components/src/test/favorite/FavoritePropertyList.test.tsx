/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount } from "enzyme";
import * as faker from "faker";
import * as React from "react";
import { PropertyRecord } from "@bentley/ui-abstract";
import { PropertyCategory, PropertyData } from "../../ui-components/propertygrid/PropertyDataProvider";
import { FavoritePropertyList } from "../../ui-components/favorite/FavoritePropertyList";
import TestUtils from "../TestUtils";
import { Orientation } from "@bentley/ui-core";
import { PropertyValueRendererManager } from "../../ui-components/properties/ValueRendererManager";

describe("FavoritePropertyList", () => {

  let data: PropertyData;

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  beforeEach(() => {
    const categories: PropertyCategory[] = [
      { name: "Favorite", label: "Group 1", expand: true },
    ];
    const records: PropertyRecord[] = [
      TestUtils.createPrimitiveStringProperty("CADID1", "0000 0005 00E0 02D8"),
      TestUtils.createPrimitiveStringProperty("CADID2", "0000 0005 00E0 02D8"),
    ];

    data = {
      label: PropertyRecord.fromString(faker.random.word()),
      description: faker.random.words(),
      categories,
      records: {
        Favorite: records,
      },
    };
  });

  describe("rendering", () => {

    it("renders correctly with label as string", async () => {
      const wrapper = mount(<FavoritePropertyList propertyData={data} />);

      await TestUtils.flushAsyncOperations();
      wrapper.update();

      expect(wrapper.find(".components-favorite-property-list").first().exists()).to.be.true;

      let record = wrapper.find(".components-property-record--horizontal").at(0);
      expect(record.exists(), "First record does not exist").to.be.true;

      record = wrapper.find(".components-property-record--horizontal").at(1);
      expect(record.exists(), "Second record does not exist").to.be.true;
    });

    it("renders correctly in vertical orientation", async () => {
      const propertyValueRendererManager = new PropertyValueRendererManager();
      const wrapper = mount(
        <FavoritePropertyList propertyData={data} orientation={Orientation.Vertical} propertyValueRendererManager={propertyValueRendererManager} />
      );

      await TestUtils.flushAsyncOperations();
      wrapper.update();

      expect(wrapper.find(".components-favorite-property-list").first().exists()).to.be.true;

      let record = wrapper.find(".components-property-record--vertical").at(0);
      expect(record.exists(), "First record does not exist").to.be.true;

      record = wrapper.find(".components-property-record--vertical").at(1);
      expect(record.exists(), "Second record does not exist").to.be.true;
    });

    it("renders null if no Favorites", async () => {
      delete data.records.Favorite;
      const wrapper = mount(<FavoritePropertyList propertyData={data} />);

      await TestUtils.flushAsyncOperations();
      wrapper.update();

      expect(wrapper.find(".components-favorite-property-list").first().exists()).to.be.false;
    });

  });

});
