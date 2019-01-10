/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import sinon from "sinon";
import { mount } from "enzyme";
import * as React from "react";
import { Orientation } from "@bentley/ui-core";
import { PropertyRenderer } from "../../../ui-components/properties/renderers/PropertyRenderer";
import TestUtils from "../../TestUtils";
import { PropertyValueRendererManager } from "../../../ui-components/properties/ValueRendererManager";
import { PrimitivePropertyRenderer } from "../../../ui-components/properties/renderers/PrimitivePropertyRenderer";
import { PropertyRecord } from "../../../ui-components";
import { NonPrimitivePropertyRenderer } from "../../../ui-components/properties/renderers/NonPrimitivePropertyRenderer";

describe("PropertyRenderer", () => {
  describe("getLabelOffset", () => {
    it("returns 0 when indentation is undefined or 0", () => {
      expect(PropertyRenderer.getLabelOffset(undefined)).to.be.eq(0);
      expect(PropertyRenderer.getLabelOffset(0)).to.be.eq(0);
    });

    it("returns more than 0 when indentation more than 0", () => {
      expect(PropertyRenderer.getLabelOffset(1)).to.be.greaterThan(0);
    });
  });

  let propertyRecord: PropertyRecord;

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  beforeEach(() => {
    propertyRecord = TestUtils.createPrimitiveStringProperty("Label", "Model");
  });

  it("updates displayed value if propertyRecord changes", async () => {
    const originalValue = "OriginalValue";
    const recordValue = "ChangedValue";

    propertyRecord = TestUtils.createPrimitiveStringProperty("Label", originalValue);

    const propertyRenderer = mount(
      <PropertyRenderer
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
      />);

    await TestUtils.flushAsyncOperations();
    propertyRenderer.update();

    expect(propertyRenderer.find(PrimitivePropertyRenderer).prop("valueElement")).to.be.equal(originalValue);

    propertyRenderer.setProps({ propertyRecord: TestUtils.createPrimitiveStringProperty("Label", recordValue) });

    await TestUtils.flushAsyncOperations();
    propertyRenderer.update();

    expect(propertyRenderer.find(PrimitivePropertyRenderer).prop("valueElement")).to.be.equal(recordValue);
  });

  it("renders value differently if provided with custom propertyValueRendererManager", async () => {
    class RendererManager extends PropertyValueRendererManager {
      public async render({ }) {
        return ("Test");
      }
    }

    const propertyRenderer = mount(
      <PropertyRenderer
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
        propertyValueRendererManager={new RendererManager()}
      />);

    await TestUtils.flushAsyncOperations();
    propertyRenderer.update();

    expect(propertyRenderer.find(PrimitivePropertyRenderer).prop("valueElement")).to.be.eq("Test");
  });

  it("renders as primitive value if property is an empty array", () => {
    propertyRecord = TestUtils.createArrayProperty("EmptyArray");

    const propertyRenderer = mount(
      <PropertyRenderer
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
      />);

    expect(propertyRenderer.find(PrimitivePropertyRenderer).exists()).to.be.true;
  });

  it("renders struct as a non primitive value", () => {
    propertyRecord = TestUtils.createArrayProperty("StringArray", [TestUtils.createPrimitiveStringProperty("Label", "Model")]);

    const propertyRenderer = mount(
      <PropertyRenderer
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
      />);

    expect(propertyRenderer.find(NonPrimitivePropertyRenderer).exists()).to.be.true;
  });

  it("renders array as a non primitive value", () => {
    propertyRecord = TestUtils.createStructProperty("Struct");

    const propertyRenderer = mount(
      <PropertyRenderer
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
      />);

    expect(propertyRenderer.find(NonPrimitivePropertyRenderer).exists()).to.be.true;
  });
  it("renders an editor correctly", () => {
    const propertyRenderer = mount(
      <PropertyRenderer
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
        isEditing={true}
      />);

    expect(propertyRenderer.find(".components-text-editor").length).to.eq(1);
  });

  it("calls onEditCommit on Enter key when editing", () => {
    const spyMethod = sinon.spy();
    const propertyRenderer = mount(
      <PropertyRenderer
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
        isEditing={true}
        onEditCommit={spyMethod}
      />);

    const inputNode = propertyRenderer.find("input");
    expect(inputNode.length).to.eq(1);

    inputNode.simulate("keyDown", { key: "Enter" });
    expect(spyMethod.calledOnce).to.be.true;
  });

  it("calls onEditCancel on Escape key when editing", () => {
    const spyMethod = sinon.spy();
    const propertyRenderer = mount(
      <PropertyRenderer
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
        isEditing={true}
        onEditCancel={spyMethod}
      />);

    const inputNode = propertyRenderer.find("input");
    expect(inputNode.length).to.eq(1);

    inputNode.simulate("keyDown", { key: "Escape" });
    expect(spyMethod.calledOnce).to.be.true;
  });

  it("does not remove Editor on Enter if callback is not provided", () => {
    const propertyRenderer = mount(
      <PropertyRenderer
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
        isEditing={true}
      />);

    const inputNode = propertyRenderer.find("input");
    expect(inputNode.exists()).to.be.true;

    inputNode.simulate("keyDown", { key: "Enter" });
    expect(propertyRenderer.find("input").exists()).to.be.true;
  });

  it("does not remove Editor on Escape if callback is not provided", () => {
    const propertyRenderer = mount(
      <PropertyRenderer
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
        isEditing={true}
      />);

    const inputNode = propertyRenderer.find("input");
    expect(inputNode.exists()).to.be.true;

    inputNode.simulate("keyDown", { key: "Escape" });
    expect(propertyRenderer.find("input").exists()).to.be.true;
  });

  it("does not wrap valueElement in span if it's not a string", async () => {
    propertyRecord.property.typename = "mycustom";

    const myCustomRenderer = {
      canRender: () => true,
      render: async () => Promise.resolve(<div>My value</div>),
    };

    PropertyValueRendererManager.defaultManager.registerRenderer("mycustom", myCustomRenderer);
    const propertyRenderer = mount(
      <PropertyRenderer
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
      />);

    await TestUtils.flushAsyncOperations();
    propertyRenderer.update();

    const originalRender = mount(<div>My value</div>).html();
    const propsRender = mount(<>{propertyRenderer.find(PrimitivePropertyRenderer).prop("valueElement")}</>).html();
    expect(originalRender).to.be.eq(propsRender);
  });
});
