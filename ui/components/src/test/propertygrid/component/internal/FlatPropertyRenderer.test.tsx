/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import sinon from "sinon";
import { PropertyRecord } from "@bentley/ui-abstract";
import TestUtils from "../../../TestUtils";
import { Orientation } from "@bentley/ui-core";
import { LinksRenderer } from "../../../../ui-components/properties/LinkHandler";
import { PropertyValueRendererManager } from "../../../../ui-components/properties/ValueRendererManager";
import { FlatPropertyRenderer } from "../../../../ui-components/propertygrid/internal/flat-properties/FlatPropertyRenderer";
import { PrimitivePropertyRenderer } from "../../../../ui-components/properties/renderers/PrimitivePropertyRenderer";
import { FlatNonPrimitivePropertyRenderer } from "../../../../ui-components/propertygrid/internal/flat-properties/FlatNonPrimitivePropertyRenderer";

describe("FlatPropertyRenderer", () => {
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
      <FlatPropertyRenderer
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
        isExpanded={false}
        onExpansionToggled={() => { }}
      />);

    await TestUtils.flushAsyncOperations();
    propertyRenderer.update();

    expect(propertyRenderer.find(LinksRenderer).prop("value")).to.be.equal(originalValue);

    propertyRenderer.setProps({ propertyRecord: TestUtils.createPrimitiveStringProperty("Label", recordValue) });

    await TestUtils.flushAsyncOperations();
    propertyRenderer.update();

    expect(propertyRenderer.find(LinksRenderer).prop("value")).to.be.equal(recordValue);
  });

  it("renders value differently if provided with custom propertyValueRendererManager", async () => {
    class RendererManager extends PropertyValueRendererManager {
      public render({ }) {
        return ("Test");
      }
    }

    const propertyRenderer = mount(
      <FlatPropertyRenderer
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
        propertyValueRendererManager={new RendererManager()}
        isExpanded={false}
        onExpansionToggled={() => { }}
      />);

    await TestUtils.flushAsyncOperations();
    propertyRenderer.update();

    expect(propertyRenderer.find(PrimitivePropertyRenderer).prop("valueElement")).to.be.eq("Test");
  });

  it("renders as primitive value if property is an empty array", () => {
    propertyRecord = TestUtils.createArrayProperty("EmptyArray");

    const propertyRenderer = mount(
      <FlatPropertyRenderer
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
        isExpanded={false}
        onExpansionToggled={() => { }}
      />);

    expect(propertyRenderer.find(PrimitivePropertyRenderer).exists()).to.be.true;
  });

  it("renders struct as a non primitive value", () => {
    propertyRecord = TestUtils.createArrayProperty("StringArray", [TestUtils.createPrimitiveStringProperty("Label", "Model")]);

    const propertyRenderer = mount(
      <FlatPropertyRenderer
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
        isExpanded={false}
        onExpansionToggled={() => { }}
      />);

    expect(propertyRenderer.find(FlatNonPrimitivePropertyRenderer).exists()).to.be.true;
  });

  it("renders array as a non primitive value", () => {
    propertyRecord = TestUtils.createStructProperty("Struct");

    const propertyRenderer = mount(
      <FlatPropertyRenderer
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
        isExpanded={false}
        onExpansionToggled={() => { }}
      />);

    expect(propertyRenderer.find(FlatNonPrimitivePropertyRenderer).exists()).to.be.true;
  });
  it("renders an editor correctly", () => {
    const propertyRenderer = mount(
      <FlatPropertyRenderer
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
        isEditing={true}
        isExpanded={false}
        onExpansionToggled={() => { }}
      />);

    expect(propertyRenderer.find("input.components-text-editor").length).to.eq(1);
  });

  it("calls onEditCommit on Enter key when editing", async () => {
    const spyMethod = sinon.spy();
    const propertyRenderer = mount(
      <FlatPropertyRenderer
        category={{ name: "Cat1", label: "Category 1", expand: true }}
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
        isEditing={true}
        onEditCommit={spyMethod}
        isExpanded={false}
        onExpansionToggled={() => { }}
      />);

    const inputNode = propertyRenderer.find("input");
    expect(inputNode.length).to.eq(1);

    inputNode.simulate("keyDown", { key: "Enter" });
    await TestUtils.flushAsyncOperations();
    expect(spyMethod.calledOnce).to.be.true;
  });

  it("calls onEditCancel on Escape key when editing", () => {
    const spyMethod = sinon.spy();
    const propertyRenderer = mount(
      <FlatPropertyRenderer
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
        isEditing={true}
        onEditCancel={spyMethod}
        isExpanded={false}
        onExpansionToggled={() => { }}
      />);

    const inputNode = propertyRenderer.find("input");
    expect(inputNode.length).to.eq(1);

    inputNode.simulate("keyDown", { key: "Escape" });
    expect(spyMethod.calledOnce).to.be.true;
  });

  it("does not remove Editor on Enter if callback is not provided", () => {
    const propertyRenderer = mount(
      <FlatPropertyRenderer
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
        isEditing={true}
        isExpanded={false}
        onExpansionToggled={() => { }}
      />);

    const inputNode = propertyRenderer.find("input");
    expect(inputNode.exists()).to.be.true;

    inputNode.simulate("keyDown", { key: "Enter" });
    expect(propertyRenderer.find("input").exists()).to.be.true;
  });

  it("does not remove Editor on Escape if callback is not provided", () => {
    const propertyRenderer = mount(
      <FlatPropertyRenderer
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
        isEditing={true}
        isExpanded={false}
        onExpansionToggled={() => { }}
      />);

    const inputNode = propertyRenderer.find("input");
    expect(inputNode.exists()).to.be.true;

    inputNode.simulate("keyDown", { key: "Escape" });
    expect(propertyRenderer.find("input").exists()).to.be.true;
  });

  it("does not wrap valueElement in span if it's not a string", async () => {
    propertyRecord.property.typename = "mycustomRenderer";

    const myCustomRenderer = {
      canRender: () => true,
      // eslint-disable-next-line react/display-name
      render: () => <div>My value</div>,
    };

    PropertyValueRendererManager.defaultManager.registerRenderer("mycustomRenderer", myCustomRenderer);
    const propertyRenderer = mount(
      <FlatPropertyRenderer
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
        isExpanded={false}
        onExpansionToggled={() => { }}
      />);

    await TestUtils.flushAsyncOperations();
    propertyRenderer.update();

    const originalRender = mount(<div>My value</div>).html();
    const propsRender = mount(<>{propertyRenderer.find(PrimitivePropertyRenderer).prop("valueElement")}</>).html();
    expect(originalRender).to.be.eq(propsRender);
  });
});
