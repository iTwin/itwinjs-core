/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import TestUtils from "../../../TestUtils";
import { DoublePropertyValueRenderer } from "../../../../ui-components/properties/renderers/value/DoublePropertyValueRenderer";
import { PrimitiveValue } from "@bentley/imodeljs-frontend";

function createDoubleProperty(value: number, displayValue?: string) {
  const property = TestUtils.createPrimitiveStringProperty("Length", "", displayValue);
  property.property.typename = "double";
  (property.value as PrimitiveValue).value = value;
  return property;
}

describe("DoublePropertyValueRenderer", () => {
  describe("render", () => {
    it("renders double property from display value", () => {
      const renderer = new DoublePropertyValueRenderer();
      const property = createDoubleProperty(0.45, "zero point forty five meters");
      const element = renderer.render(property);
      const elementMount = mount(<div>{element}</div>);
      expect(elementMount.text()).to.eq("zero point forty five meters");
    });

    it("renders double property from raw value", () => {
      const renderer = new DoublePropertyValueRenderer();
      const property = createDoubleProperty(0.45, "");
      const element = renderer.render(property);
      const elementMount = mount(<div>{element}</div>);
      expect(elementMount.text()).to.eq("0.45");
    });

    it("throws when trying to render array property", () => {
      const renderer = new DoublePropertyValueRenderer();
      const arrayProperty = TestUtils.createArrayProperty("LabelArray");
      expect(() => renderer.render(arrayProperty)).to.throw;
    });
  });

  describe("canRender", () => {
    it("returns true for a double property", () => {
      const renderer = new DoublePropertyValueRenderer();
      const property = createDoubleProperty(0.45);
      expect(renderer.canRender(property)).to.be.true;
    });

    it("returns false for properties that are not double", () => {
      const renderer = new DoublePropertyValueRenderer();
      const arrayProperty = TestUtils.createArrayProperty("LabelArray");
      const structProperty = TestUtils.createStructProperty("NameStruct");
      const stringProperty = TestUtils.createPrimitiveStringProperty("Label", "Model");
      expect(renderer.canRender(arrayProperty)).to.be.false;
      expect(renderer.canRender(structProperty)).to.be.false;
      expect(renderer.canRender(stringProperty)).to.be.false;
    });
  });
});
