/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import TestUtils from "../../../TestUtils";
import { DoublePropertyValueRenderer } from "../../../../properties/renderers/value/DoublePropertyValueRenderer";

function createDoubleProperty() {
  const property = TestUtils.createPrimitiveStringProperty("Length", "0.45 m");
  property.property.typename = "double";
  return property;
}

describe("DoublePropertyValueRenderer", () => {
  describe("render", () => {
    it("renders double property", () => {
      const renderer = new DoublePropertyValueRenderer();
      const property = createDoubleProperty();

      const element = renderer.render(property);
      const elementMount = mount(<div>{element}</div>);

      expect(elementMount.text()).to.be.eq("0.45 m");
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
      const property = createDoubleProperty();
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
