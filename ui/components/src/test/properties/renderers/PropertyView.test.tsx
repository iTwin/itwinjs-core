/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount } from "enzyme";
import sinon from "sinon";
import * as React from "react";
import { Orientation, ElementSeparator } from "@bentley/ui-core";
import TestUtils from "../../TestUtils";
import { PropertyView } from "../../../ui-components/properties/renderers/PropertyView";
import { PropertyRecord } from "../../../ui-components/properties/Record";

describe("PropertyView", () => {
  let propertyRecord: PropertyRecord;

  before(() => {
    propertyRecord = TestUtils.createPrimitiveStringProperty("Label", "Model");

    TestUtils.initializeUiComponents(); // tslint:disable-line:no-floating-promises
  });

  it("renders label and value", () => {
    const propertyRenderer = mount(
      <PropertyView
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
        labelElement={"City"}
        valueElement={"Vilnius"}
      />);

    expect(propertyRenderer.find(".components-property-record-label").first().text()).to.be.eq("City");
    expect(propertyRenderer.find(".components-property-record-value").first().text()).to.be.eq("Vilnius");
  });

  it("renders label and value with custom ratio when it's provided", () => {
    const propertyRenderer = mount(
      <PropertyView
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
        labelElement={"City"}
        columnRatio={0.6}
      />);

    expect(propertyRenderer.childAt(0).get(0).props.style).to.have.property("gridTemplateColumns", "60% 40%");
  });

  it("renders ElementSeparator when orientation is horizontal", () => {
    const propertyRenderer = mount(
      <PropertyView
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
        labelElement={"label"}
        onColumnRatioChanged={() => { }}
      />);

    expect(propertyRenderer.childAt(0).hasClass("components-property-record--horizontal"), "class not found").to.be.true;
    expect(propertyRenderer.find(ElementSeparator).first().exists(), "ElementSeparator not found").to.be.true;
    expect(propertyRenderer.childAt(0).get(0).props.style).to.have.property("gridTemplateColumns", "25% 1px 75%");
  });

  it("does not render ElementSeparator when onColumnRatioChanged callback is not provided", () => {
    const propertyRenderer = mount(
      <PropertyView
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
        labelElement={"label"}
      />);

    expect(propertyRenderer.find(ElementSeparator).first().exists(), "ElementSeparator found").to.be.false;
  });

  it("does not render ElementSeparator when orientation is vertical", () => {
    const propertyRenderer = mount(
      <PropertyView
        orientation={Orientation.Vertical}
        propertyRecord={propertyRecord}
        labelElement={"label"}
      />);

    expect(propertyRenderer.childAt(0).hasClass("components-property-record--vertical"), "class not found").to.be.true;
    expect(propertyRenderer.find(ElementSeparator).first().exists(), "ElementSeparator found").to.be.false;
  });

  it("triggers selection if property gets clicked once", () => {
    const onClick = sinon.spy();

    const propertyRenderer = mount(
      <PropertyView
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
        onClick={onClick}
        labelElement={"label"}
      />);

    propertyRenderer.find(".components-property-record--horizontal").first().simulate("click");

    expect(onClick.callCount).to.be.eq(1);
  });

  it("triggers deselection if property gets clicked twice", () => {
    const onClick = sinon.spy();

    const propertyRenderer = mount(
      <PropertyView
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
        onClick={onClick}
        labelElement={"label"}
      />);

    const propertyElement = propertyRenderer.find(".components-property-record--horizontal").first();
    propertyElement.simulate("click");
    propertyElement.simulate("click");

    expect(onClick.callCount).to.be.eq(2);
  });

  it("does not throw if property is clicked but onPropertySelected/Deselected props are not supplied", () => {
    const propertyRenderer = mount(
      <PropertyView
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
        labelElement={"label"}
      />);

    const propertyElement = propertyRenderer.find(".components-property-record--horizontal").first();
    propertyElement.simulate("click");
    propertyElement.simulate("click");
  });

  it("renders as selected when isSelected prop is true", () => {
    const propertyRenderer = mount(
      <PropertyView
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
        isSelected={true}
        labelElement={"label"}
      />);

    expect(propertyRenderer.find(".components--selected").first().exists()).to.be.true;
  });

  it("renders as clickable when onClick prop is given", () => {
    const propertyRenderer = mount(
      <PropertyView
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
        onClick={() => { }}
        labelElement={"label"}
      />);

    expect(propertyRenderer.find(".components--clickable").first().exists()).to.be.true;
  });

  it("renders as hoverable when isSelectable prop is true", () => {
    const propertyRenderer = mount(
      <PropertyView
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
        onClick={() => { }}
        labelElement={"label"}
        isSelectable={true}
      />);

    expect(propertyRenderer.find(".components--hoverable").first().exists()).to.be.true;
  });

  it("does not renders as hoverable when isSelectable prop is true, but it is already selected", () => {
    const propertyRenderer = mount(
      <PropertyView
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
        onClick={() => { }}
        labelElement={"label"}
        isSelectable={true}
        isSelected={true}
      />);

    expect(propertyRenderer.find(".components--hoverable").first().exists()).to.be.false;
  });

  it("renders only label when property record is non primitive", () => {
    propertyRecord = TestUtils.createStructProperty("StructProperty");

    const propertyRenderer = mount(
      <PropertyView
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
        labelElement={"City"}
        valueElement={"Vilnius"}
      />);

    expect(propertyRenderer.find(".components-property-record-label").first().text()).to.be.eq("City");
    expect(propertyRenderer.find(".components-property-record-value").exists()).to.be.false;
  });
});
