/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import { MergedPropertyValueRenderer } from "../../../../components-react/properties/renderers/value/MergedPropertyValueRenderer";
import { UiComponents } from "../../../../components-react/UiComponents";
import TestUtils from "../../../TestUtils";

describe("MergedPropertyValueRenderer", () => {
  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  after(() => {
    TestUtils.terminateUiComponents();
  });

  describe("render", () => {
    it("renders merged property as localized string '*** Varies ***'", async () => {
      const renderer = new MergedPropertyValueRenderer();
      const property = TestUtils.createPrimitiveStringProperty("a", "b");
      property.isMerged = true;
      const element = renderer.render(property);
      const elementMount = mount(<div>{element}</div>);
      expect(elementMount.text()).to.be.eq(UiComponents.translate("property.varies"));
    });
  });

  describe("canRender", () => {
    it("returns true for a merged primitive property", () => {
      const renderer = new MergedPropertyValueRenderer();
      const property = TestUtils.createPrimitiveStringProperty("a", "b");
      property.isMerged = true;

      expect(renderer.canRender(property)).to.be.true;
    });

    it("returns false for merged non primitive properties", () => {
      const renderer = new MergedPropertyValueRenderer();
      const arrayProperty = TestUtils.createArrayProperty("LabelArray");
      arrayProperty.isMerged = true;
      const structProperty = TestUtils.createStructProperty("NameStruct");
      structProperty.isMerged = true;

      expect(renderer.canRender(arrayProperty)).to.be.false;
      expect(renderer.canRender(structProperty)).to.be.false;
    });

    it("returns false for non merged properties", () => {
      const renderer = new MergedPropertyValueRenderer();
      const property = TestUtils.createPrimitiveStringProperty("a", "b");

      expect(renderer.canRender(property)).to.be.false;
    });
  });
});
