/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import { Id64 } from "@bentley/bentleyjs-core";
import TestUtils from "../../../TestUtils";
import { NavigationPropertyValueRenderer } from "../../../../ui-components/properties/renderers/value/NavigationPropertyValueRenderer";
import { PrimitiveValue, Primitives } from "@bentley/imodeljs-frontend";

function createNavigationProperty(value: Primitives.Hexadecimal, displayValue?: string) {
  const property = TestUtils.createPrimitiveStringProperty("Category", "", displayValue);
  property.property.typename = "navigation";
  (property.value as PrimitiveValue).value = value;
  return property;
}

describe("NavigationPropertyValueRenderer", () => {
  describe("render", () => {
    it("renders navigation property from display value", () => {
      const renderer = new NavigationPropertyValueRenderer();
      const property = createNavigationProperty(Id64.fromUint32Pair(1, 0), "Rod");
      const element = renderer.render(property);
      const elementMount = mount(<div>{element}</div>);
      expect(elementMount.text()).to.eq("Rod");
    });

    it("renders navigation property from raw value", () => {
      const renderer = new NavigationPropertyValueRenderer();
      const property = createNavigationProperty(Id64.fromUint32Pair(1, 0), "");
      const element = renderer.render(property);
      const elementMount = mount(<div>{element}</div>);
      expect(elementMount.text()).to.eq("Category");
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
      const property = createNavigationProperty(Id64.fromUint32Pair(1, 0));
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
