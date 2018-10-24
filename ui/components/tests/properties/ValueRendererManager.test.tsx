/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import { PropertyValueRendererManager, IPropertyValueRenderer } from "../../src/properties/ValueRendererManager";
import TestUtils from "../TestUtils";

describe("PropertyValueRendererManager", () => {
  const fakeRenderer: IPropertyValueRenderer = {
    canRender: () => true,
    render: async () => undefined,
  };

  const fakeRenderer2: IPropertyValueRenderer = {
    canRender: () => true,
    render: async () => undefined,
  };

  let manager: PropertyValueRendererManager;
  beforeEach(() => {
    manager = new PropertyValueRendererManager();
  });

  describe("registerRenderer", () => {
    it("adds renderer to the renderer list", () => {
      expect(manager.getRegisteredRenderer("string")).to.be.undefined;

      manager.registerRenderer("string", fakeRenderer);

      expect(manager.getRegisteredRenderer("string")).to.be.eq(fakeRenderer);

      manager.unregisterRenderer("string");

      expect(manager.getRegisteredRenderer("string")).to.be.undefined;
    });

    it("throws when trying to add a renderer to a type that already has it", () => {
      manager.registerRenderer("string", fakeRenderer);

      expect(manager.getRegisteredRenderer("string")).to.be.eq(fakeRenderer);
      expect(() => manager.registerRenderer("string", fakeRenderer)).to.throw();
    });

    it("overwrites old value when trying to add a renderer to a type that already has it and overwrite is set to true", () => {
      expect(manager.getRegisteredRenderer("string")).to.be.undefined;

      manager.registerRenderer("string", fakeRenderer);

      expect(manager.getRegisteredRenderer("string")).to.be.eq(fakeRenderer);

      manager.registerRenderer("string", fakeRenderer2, true);

      expect(manager.getRegisteredRenderer("string")).to.be.eq(fakeRenderer2);
    });
  });

  describe("render", () => {
    it("renders using a custom renderer if it's registered", async () => {
      const rendererManager = new PropertyValueRendererManager();
      rendererManager.registerRenderer("string", fakeRenderer);

      const value = await rendererManager.render(TestUtils.createPrimitiveStringProperty("Label", "Test prop"));

      const valueMount = mount(<div>{value}</div>);

      expect(valueMount.text()).to.be.empty;
      expect(value).to.be.undefined;
    });

    it("renders a primitive type", async () => {
      const value = await manager.render(TestUtils.createPrimitiveStringProperty("Label", "Test prop"));

      const valueMount = mount(<div>{value}</div>);

      expect(valueMount.text()).to.not.be.empty;
    });

    it("renders an array type", async () => {
      const value = await manager.render(TestUtils.createArrayProperty("LabelArray"));

      const valueMount = mount(<div>{value}</div>);

      expect(valueMount.text()).to.not.be.empty;
    });

    it("renders a struct type", async () => {
      const value = await manager.render(TestUtils.createStructProperty("TestStruct"));

      const valueMount = mount(<div>{value}</div>);

      expect(valueMount.text()).to.not.be.empty;
    });

    it("does not render unknown type", async () => {
      const property = TestUtils.createStructProperty("TestStruct");
      property.value.valueFormat = 10;

      const value = await manager.render(property);

      const valueMount = mount(<div>{value}</div>);

      expect(valueMount.text()).to.be.empty;
    });
  });
});
