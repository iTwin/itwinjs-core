/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect, assert } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import TestUtils from "../../TestUtils";
import { PrimitivePropertyValueRenderer } from "../../../src";

describe("PrimitivePropertyValueRenderer", () => {
  describe("render", () => {
    it("renders primitive property", async () => {
      const renderer = new PrimitivePropertyValueRenderer();
      const stringProperty = TestUtils.createPrimitiveStringProperty("Label", "Test property");

      const element = await renderer.render(stringProperty);
      const elementMount = mount(<div>{element}</div>);

      expect(elementMount.text()).to.be.eq("Test property");
    });

    it("throws when trying to render array property", async () => {
      const renderer = new PrimitivePropertyValueRenderer();
      const arrayProperty = TestUtils.createArrayProperty("LabelArray");

      await renderer.render(arrayProperty)
        .then(() => { assert.fail(undefined, undefined, "Function did not throw"); })
        .catch(() => Promise.resolve());
    });
  });

  describe("canRender", () => {
    it("returns true for a primitive property", () => {
      const renderer = new PrimitivePropertyValueRenderer();
      const stringProperty = TestUtils.createPrimitiveStringProperty("Label", "Test property");

      expect(renderer.canRender(stringProperty)).to.be.true;
    });

    it("returns false for array and struct property", () => {
      const renderer = new PrimitivePropertyValueRenderer();
      const arrayProperty = TestUtils.createArrayProperty("LabelArray");
      const structProperty = TestUtils.createStructProperty("NameStruct");

      expect(renderer.canRender(arrayProperty)).to.be.false;
      expect(renderer.canRender(structProperty)).to.be.false;
    });
  });
});
