/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import { Orientation } from "@itwin/core-react";
import { FlatNonPrimitivePropertyRenderer } from "../../../../components-react/propertygrid/internal/flat-properties/FlatNonPrimitivePropertyRenderer";
import { TestUtils } from "../../../TestUtils";
import sinon from "sinon";
import { NonPrimitivePropertyLabelRenderer } from "../../../../components-react/properties/renderers/label/NonPrimitivePropertyLabelRenderer";

describe("FlatNonPrimitivePropertyRenderer", () => {
  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  it("renders correctly", async () => {
    const rendererMount = mount(
      <FlatNonPrimitivePropertyRenderer
        orientation={Orientation.Horizontal}
        propertyRecord={TestUtils.createArrayProperty("Pipes", [TestUtils.createPrimitiveStringProperty("pipe_1", "Water pipe")])}
        valueElement={"string[1]"}
        isExpanded={false}
        onExpandToggled={() => { }}
      />);

    await TestUtils.flushAsyncOperations();

    const labelRenderer = rendererMount.find(NonPrimitivePropertyLabelRenderer);
    expect(labelRenderer.exists()).to.be.true;
    expect(labelRenderer.html().indexOf("Pipes (1)")).to.be.greaterThan(-1);

    expect(rendererMount.find(".components-property-label-renderer-colon").exists()).to.be.false;
  });

  it("renders array size in label correctly", async () => {
    const rendererMount = mount(
      <FlatNonPrimitivePropertyRenderer
        orientation={Orientation.Horizontal}
        propertyRecord={TestUtils.createArrayProperty("Pipes", [
          TestUtils.createPrimitiveStringProperty("pipe_1", "Water pipe"),
          TestUtils.createPrimitiveStringProperty("pipe_2", "Sewage pipe"),
          TestUtils.createPrimitiveStringProperty("pipe_3", "Water pipe"),
        ])}
        valueElement={"string[1]"}
        isExpanded={false}
        onExpandToggled={() => { }}
      />);

    await TestUtils.flushAsyncOperations();

    const labelRenderer = rendererMount.find(NonPrimitivePropertyLabelRenderer);
    expect(labelRenderer.exists()).to.be.true;
    expect(labelRenderer.html().indexOf("Pipes (3)")).to.be.greaterThan(-1);
  });

  it("Should call onExpandToggled when label is clicked and item is not expanded", () => {
    const expandSpy = sinon.spy();
    const rendererMount = mount(
      <FlatNonPrimitivePropertyRenderer
        orientation={Orientation.Horizontal}
        propertyRecord={
          TestUtils.createStructProperty(
            "House",
            {
              building: TestUtils.createPrimitiveStringProperty("Building", "Residential"),
              street: TestUtils.createPrimitiveStringProperty("Street", "Glass st."),
            })}
        isExpanded={false}
        onExpandToggled={expandSpy}
      />);

    expect(expandSpy.callCount).to.be.equal(0);

    rendererMount.find(NonPrimitivePropertyLabelRenderer).simulate("click");
    expect(expandSpy.callCount).to.be.equal(1);

    rendererMount.find(NonPrimitivePropertyLabelRenderer).simulate("click");
    expect(expandSpy.callCount).to.be.equal(2);
  });

  it("Should call onExpandToggled when label is clicked and item is expanded", () => {
    const expandSpy = sinon.spy();
    const rendererMount = mount(
      <FlatNonPrimitivePropertyRenderer
        orientation={Orientation.Horizontal}
        propertyRecord={
          TestUtils.createStructProperty(
            "House",
            {
              building: TestUtils.createPrimitiveStringProperty("Building", "Residential"),
              street: TestUtils.createPrimitiveStringProperty("Street", "Glass st."),
            })}
        isExpanded={true}
        onExpandToggled={expandSpy}
      />);

    expect(expandSpy.callCount).to.be.equal(0);

    rendererMount.find(NonPrimitivePropertyLabelRenderer).simulate("click");
    expect(expandSpy.callCount).to.be.equal(1);

    rendererMount.find(NonPrimitivePropertyLabelRenderer).simulate("click");
    expect(expandSpy.callCount).to.be.equal(2);
  });
});
