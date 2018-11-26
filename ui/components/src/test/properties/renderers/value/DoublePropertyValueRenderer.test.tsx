/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect, assert } from "chai";
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
    it("renders double property", async () => {
      const renderer = new DoublePropertyValueRenderer();
      const property = createDoubleProperty();

      const element = await renderer.render(property);
      const elementMount = mount(<div>{element}</div>);

      expect(elementMount.text()).to.be.eq("0.45 m");
    });

    it("throws when trying to render array property", async () => {
      const renderer = new DoublePropertyValueRenderer();
      const arrayProperty = TestUtils.createArrayProperty("LabelArray");

      await renderer.render(arrayProperty)
        .then(() => { assert.fail(undefined, undefined, "Function did not throw"); })
        .catch(async () => Promise.resolve());
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
