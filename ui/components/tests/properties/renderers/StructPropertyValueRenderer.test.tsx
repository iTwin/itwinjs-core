/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect, assert } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import TestUtils from "../../TestUtils";
import { StructPropertyValueRenderer } from "../../../src";
import { PropertyContainerType } from "../../../src/properties/ValueRendererManager";
import { PropertyList } from "../../../src/propertygrid/component/PropertyList";
import { Orientation } from "@bentley/ui-core";
import { PropertyRenderer } from "../../../src/propertygrid/component/PropertyRenderer";

describe("StructPropertyValueRenderer", () => {
  before(() => {
    TestUtils.initializeUiComponents();
  });

  describe("render", () => {
    it("renders struct property", async () => {
      const renderer = new StructPropertyValueRenderer();
      const structProperty = TestUtils.createStructProperty("NameStruct");

      const element = await renderer.render(structProperty);
      const elementMount = mount(<div>{element}</div>);

      expect(elementMount.text()).to.be.eq("{struct}");
    });

    it("renders default way when provided with empty context", async () => {
      const renderer = new StructPropertyValueRenderer();
      const structProperty = TestUtils.createStructProperty("NameStruct");

      const element = await renderer.render(structProperty, {});
      const elementMount = mount(<div>{element}</div>);

      expect(elementMount.text()).to.be.eq("{struct}");
    });

    it("renders struct as PropertyList when container type is PropertyPane", async () => {
      const renderer = new StructPropertyValueRenderer();

      const baseStruct = { value: TestUtils.createPrimitiveStringProperty("Size", "Huge") };
      const struct = Object.create(baseStruct);
      struct.label = TestUtils.createPrimitiveStringProperty("Title", "Model");

      const structProperty = TestUtils.createStructProperty("NameStruct", struct);

      const element = await renderer.render(structProperty, { containerType: PropertyContainerType.PropertyPane });
      const elementMount = mount(<div>{element}</div>);

      await TestUtils.flushAsyncOperations();

      expect(elementMount.find(PropertyList).exists()).to.be.true;
      const propertyRenderer = elementMount.find(PropertyRenderer);
      expect(propertyRenderer.length).to.be.eq(1);
      expect(propertyRenderer.find(".components-property-record-label").text()).to.be.eq("Title");
      expect(propertyRenderer.find(".components-property-record-value").text()).to.be.eq("Model");
    });

    it("renders struct as a vertical PropertyList when container type is PropertyPane and orientation is vertical", async () => {
      const renderer = new StructPropertyValueRenderer();
      const structProperty = TestUtils.createStructProperty("NameStruct");

      const element = await renderer.render(structProperty, { containerType: PropertyContainerType.PropertyPane, orientation: Orientation.Vertical });
      const elementMount = mount(<div>{element}</div>);

      expect(elementMount.find(".components-property-list--vertical").exists()).to.be.true;
    });

    it("throws when trying to render primitive property", async () => {
      const renderer = new StructPropertyValueRenderer();
      const stringProperty = TestUtils.createPrimitiveStringProperty("Label", "Test property");

      await renderer.render(stringProperty)
        .then(() => { assert.fail(undefined, undefined, "Function did not throw"); })
        .catch(() => Promise.resolve());
    });
  });

  describe("canRender", () => {
    it("returns true for an struct property", () => {
      const renderer = new StructPropertyValueRenderer();
      const structProperty = TestUtils.createStructProperty("NameStruct");

      expect(renderer.canRender(structProperty)).to.be.true;
    });

    it("returns false for array and struct property", () => {
      const renderer = new StructPropertyValueRenderer();
      const stringProperty = TestUtils.createPrimitiveStringProperty("Label", "Test property");
      const arrayProperty = TestUtils.createArrayProperty("LabelArray");

      expect(renderer.canRender(stringProperty)).to.be.false;
      expect(renderer.canRender(arrayProperty)).to.be.false;
    });
  });
});
