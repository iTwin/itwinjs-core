/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import TestUtils from "../../../TestUtils";
import { NavigationPropertyValueRenderer } from "../../../../properties/renderers/value/NavigationPropertyValueRenderer";
import { PrimitiveValue } from "../../../../properties/Value";

function createNavigationProperty() {
  const property = TestUtils.createPrimitiveStringProperty("Category", "Rod");
  property.property.typename = "navigation";
  (property.value as PrimitiveValue).value = 1654354;
  return property;
}

describe("NavigationPropertyValueRenderer", () => {
  describe("render", () => {
    it("renders navigation property", () => {
      const renderer = new NavigationPropertyValueRenderer();
      const property = createNavigationProperty();

      const element = renderer.render(property);
      const elementMount = mount(<div>{element}</div>);

      expect(elementMount.text()).to.be.eq("Rod");
    });

    it("throws when trying to render array property", () => {
      const renderer = new NavigationPropertyValueRenderer();
      const arrayProperty = TestUtils.createArrayProperty("LabelArray");
      expect(() => renderer.render(arrayProperty)).to.throw;
    });
  });

  describe("canRender", () => {
    it("returns true for a navigation property", () => {
      const renderer = new NavigationPropertyValueRenderer();
      const property = createNavigationProperty();
      expect(renderer.canRender(property)).to.be.true;
    });

    it("returns false for properties that are not navigation", () => {
      const renderer = new NavigationPropertyValueRenderer();
      const arrayProperty = TestUtils.createArrayProperty("LabelArray");
      const structProperty = TestUtils.createStructProperty("NameStruct");
      const stringProperty = TestUtils.createPrimitiveStringProperty("Label", "Model");
      expect(renderer.canRender(arrayProperty)).to.be.false;
      expect(renderer.canRender(structProperty)).to.be.false;
      expect(renderer.canRender(stringProperty)).to.be.false;
    });
  });
});
