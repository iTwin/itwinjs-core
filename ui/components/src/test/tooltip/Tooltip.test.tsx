/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount } from "enzyme";
import * as faker from "faker";
import * as React from "react";
import { PropertyCategory, PropertyData } from "../../ui-components/propertygrid/PropertyDataProvider";
import { PropertyRecord } from "@bentley/imodeljs-frontend";
import TestUtils from "../TestUtils";
import { Tooltip } from "../../ui-components/tooltip/Tooltip";

describe("Tooltip", () => {

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
      label: faker.random.word(),
      description: faker.random.words(),
      categories,
      records: {
        Favorite: records,
      },
    };
  });

  describe("rendering", () => {

    it("renders correctly", async () => {
      const wrapper = mount(<Tooltip propertyData={data} />);

      await TestUtils.flushAsyncOperations();
      wrapper.update();

      expect(wrapper.find(".components-element-tooltip").first().exists()).to.be.true;

      let record = wrapper.find(".components-property-record--horizontal").at(0);
      expect(record.exists(), "First record does not exist").to.be.true;

      record = wrapper.find(".components-property-record--horizontal").at(1);
      expect(record.exists(), "Second record does not exist").to.be.true;
    });

  });

});
