/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect, assert } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import TestUtils from "../../TestUtils";
import { ArrayPropertyValueRenderer } from "../../../src";
import { PropertyContainerType } from "../../../src/properties/ValueRendererManager";
import { PropertyList } from "../../../src/propertygrid/component/PropertyList";
import { Orientation } from "@bentley/ui-core";

describe("ArrayPropertyValueRenderer", () => {
  describe("render", () => {
    it("renders non empty array property", async () => {
      const renderer = new ArrayPropertyValueRenderer();
      const stringProperty = TestUtils.createPrimitiveStringProperty("Label", "Test property");
      const arrayProperty = TestUtils.createArrayProperty("LabelArray", [stringProperty]);

      const element = await renderer.render(arrayProperty);
      const elementMount = mount(<div>{element}</div>);

      expect(elementMount.text()).to.be.eq("string[1]");
    });

    it("renders empty array property", async () => {
      const renderer = new ArrayPropertyValueRenderer();
      const arrayProperty = TestUtils.createArrayProperty("LabelArray");

      const element = await renderer.render(arrayProperty);
      const elementMount = mount(<div>{element}</div>);

      expect(elementMount.text()).to.be.eq("[]");
    });

    it("renders default way if empty context is provided", async () => {
      const renderer = new ArrayPropertyValueRenderer();
      const arrayProperty = TestUtils.createArrayProperty("LabelArray");

      const element = await renderer.render(arrayProperty, {});
      const elementMount = mount(<div>{element}</div>);

      expect(elementMount.text()).to.be.eq("[]");
    });

    it("renders array as PropertyList if container type is PropertyPane", async () => {
      const renderer = new ArrayPropertyValueRenderer();
      const arrayProperty = TestUtils.createArrayProperty("LabelArray");

      const element = await renderer.render(arrayProperty, { containerType: PropertyContainerType.PropertyPane });
      const elementMount = mount(<div>{element}</div>);

      expect(elementMount.find(PropertyList).exists()).to.be.true;
    });

    it("renders array as a vertical PropertyList if container type is PropertyPane and orientation is set to vertical", async () => {
      const renderer = new ArrayPropertyValueRenderer();
      const arrayProperty = TestUtils.createArrayProperty("LabelArray");

      const element = await renderer.render(arrayProperty, { containerType: PropertyContainerType.PropertyPane, orientation: Orientation.Vertical });
      const elementMount = mount(<div>{element}</div>);

      expect(elementMount.find(".components-property-list--vertical").exists()).to.be.true;
    });

    it("throws when trying to render primitive property", async () => {
      const renderer = new ArrayPropertyValueRenderer();
      const stringProperty = TestUtils.createPrimitiveStringProperty("Label", "Test property");

      await renderer.render(stringProperty)
        .then(() => { assert.fail(undefined, undefined, "Function did not throw"); })
        .catch(() => Promise.resolve());
    });
  });

  describe("canRender", () => {
    it("returns true for an array property", () => {
      const renderer = new ArrayPropertyValueRenderer();
      const arrayProperty = TestUtils.createArrayProperty("LabelArray");

      expect(renderer.canRender(arrayProperty)).to.be.true;
    });

    it("returns false for primitive and struct property", () => {
      const renderer = new ArrayPropertyValueRenderer();
      const stringProperty = TestUtils.createPrimitiveStringProperty("Label", "Test property");
      const structProperty = TestUtils.createStructProperty("NameStruct");

      expect(renderer.canRender(stringProperty)).to.be.false;
      expect(renderer.canRender(structProperty)).to.be.false;
    });
  });
});
