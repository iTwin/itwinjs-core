/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import sinon from "sinon";
import { IPropertyValueRenderer, PropertyValueRendererManager } from "../../components-react/properties/ValueRendererManager";
import { UiComponents } from "../../components-react/UiComponents";
import TestUtils from "../TestUtils";

describe("PropertyValueRendererManager", () => {
  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  let fakeRenderer: IPropertyValueRenderer;
  let fakeRenderer2: IPropertyValueRenderer;

  let manager: PropertyValueRendererManager;

  beforeEach(() => {
    fakeRenderer = {
      canRender: () => true,
      render: sinon.fake(),
    };

    fakeRenderer2 = {
      canRender: () => true,
      render: sinon.fake(),
    };

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
    it("looks for custom renderer specified in `property.renderer` before looking at `property.typename`", () => {
      const record = TestUtils.createPrimitiveStringProperty("test_property", "Test");
      record.property.renderer = { name: "stub1" };
      record.property.typename = "stub2";

      const rendererManager = new PropertyValueRendererManager();
      rendererManager.registerRenderer("stub1", fakeRenderer);
      rendererManager.registerRenderer("stub2", fakeRenderer2);

      rendererManager.render(record);

      expect(fakeRenderer.render).to.have.been.calledOnceWith(record);
      expect(fakeRenderer2.render).to.have.not.been.called;
    });

    it("looks for custom renderer in property typename", () => {
      const record = TestUtils.createPrimitiveStringProperty("test_property", "Test");
      record.property.typename = "stub";

      const rendererManager = new PropertyValueRendererManager();
      rendererManager.registerRenderer("stub", fakeRenderer);

      rendererManager.render(record);

      expect(fakeRenderer.render).to.have.been.calledOnceWith(record);
    });

    it("renders a primitive type", () => {
      const value = manager.render(TestUtils.createPrimitiveStringProperty("Label", "Test prop"));

      const valueMount = mount(<div>{value}</div>);

      expect(valueMount.text()).to.not.be.empty;
    });

    it("renders an array type", () => {
      const value = manager.render(TestUtils.createArrayProperty("LabelArray"));

      const valueMount = mount(<div>{value}</div>);

      expect(valueMount.text()).to.not.be.empty;
    });

    it("renders a struct type", () => {
      const value = manager.render(TestUtils.createStructProperty("TestStruct"));

      const valueMount = mount(<div>{value}</div>);

      expect(valueMount.text()).to.not.be.empty;
    });

    it("does not render unknown type", () => {
      const property = TestUtils.createStructProperty("TestStruct");
      property.value.valueFormat = 10;

      const value = manager.render(property);

      const valueMount = mount(<div>{value}</div>);

      expect(valueMount.text()).to.be.empty;
    });

    it("renders merged properties", () => {
      const property = TestUtils.createPrimitiveStringProperty("Label", "Test prop");
      property.isMerged = true;

      const value = manager.render(property);

      const valueMount = mount(<div>{value}</div>);

      expect(valueMount.text()).to.be.equal(UiComponents.translate("property.varies"));
    });

    it("renders merged properties before looking for custom renderer in property typename", () => {
      const property = TestUtils.createPrimitiveStringProperty("Label", "Test prop");
      property.property.typename = "stub";
      property.isMerged = true;

      const rendererManager = new PropertyValueRendererManager();
      rendererManager.registerRenderer("stub", fakeRenderer);

      const value = rendererManager.render(property);
      const valueMount = mount(<div>{value}</div>);
      expect(valueMount.text()).to.be.equal(UiComponents.translate("property.varies"));
      expect(fakeRenderer.render).to.not.be.called;
    });
  });
});
