/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import sinon from "sinon";
import { PropertyRecord } from "@itwin/appui-abstract";
import { ElementSeparator, Orientation } from "@itwin/core-react";
import { PropertyView } from "../../../components-react";
import TestUtils from "../../TestUtils";

describe("PropertyView", () => {
  let propertyRecord: PropertyRecord;

  before(async () => {
    propertyRecord = TestUtils.createPrimitiveStringProperty("Label", "Model");

    await TestUtils.initializeUiComponents();
  });

  describe("Minimum column size disabled grid-template-columns", () => {
    it("renders label and value with custom ratio when it's provided", () => {
      const propertyRenderer = mount(
        <PropertyView
          orientation={Orientation.Horizontal}
          propertyRecord={propertyRecord}
          labelElement={"City"}
          columnRatio={0.6}
          columnInfo={{ isMinimumColumnSizeEnabled: false, minLabelWidth: 30, minValueWidth: 45, actionButtonWidth: 60 }}
        />);

      expect(propertyRenderer.childAt(0).get(0).props.style).to.have.property("gridTemplateColumns", "60% auto");
    });

    it("renders two columns when onColumnRatioChanged callback is not provided", () => {
      const propertyRenderer = mount(
        <PropertyView
          orientation={Orientation.Horizontal}
          propertyRecord={propertyRecord}
          labelElement={"label"}
          columnInfo={{ isMinimumColumnSizeEnabled: false, minLabelWidth: 30, minValueWidth: 45, actionButtonWidth: 60 }}
        />);

      expect(propertyRenderer.childAt(0).get(0).props.style).to.have.property("gridTemplateColumns", "25% auto");
    });

    it("renders three columns when orientation is horizontal and onColumnRatioChanged is provided", () => {
      const propertyRenderer = mount(
        <PropertyView
          orientation={Orientation.Horizontal}
          propertyRecord={propertyRecord}
          labelElement={"label"}
          onColumnRatioChanged={() => ({ ratio: 0.5 })}
          columnInfo={{ isMinimumColumnSizeEnabled: false, minLabelWidth: 30, minValueWidth: 45, actionButtonWidth: 60 }}
        />);

      expect(propertyRenderer.childAt(0).get(0).props.style).to.have.property("gridTemplateColumns", "25% 1px auto");
    });

    it("renders four columns if orientation is horizontal and action button renderers are passed", async () => {
      const propertyRenderer = mount(
        <PropertyView
          orientation={Orientation.Horizontal}
          propertyRecord={propertyRecord}
          labelElement={"label"}
          onColumnRatioChanged={() => ({ ratio: 0.5 })}
          actionButtonRenderers={[(_) => undefined]}
          columnInfo={{ isMinimumColumnSizeEnabled: false, minLabelWidth: 30, minValueWidth: 45, actionButtonWidth: 60 }}
        />);

      expect(propertyRenderer.childAt(0).get(0).props.style).to.have.property("gridTemplateColumns", "25% 1px auto auto");
    });

    it("renders four columns if orientation is horizontal, action button renderers are passed and columnInfo is not passed", async () => {
      const propertyRenderer = mount(
        <PropertyView
          orientation={Orientation.Horizontal}
          propertyRecord={propertyRecord}
          labelElement={"label"}
          onColumnRatioChanged={() => ({ ratio: 0.5 })}
          actionButtonRenderers={[(_) => undefined]}
        />);

      expect(propertyRenderer.childAt(0).get(0).props.style).to.have.property("gridTemplateColumns", "25% 1px auto auto");
    });
  });

  describe("Minimum column size enabled grid-template-columns", () => {
    it("renders label and value with custom ratio when it's provided", () => {
      const propertyRenderer = mount(
        <PropertyView
          orientation={Orientation.Horizontal}
          propertyRecord={propertyRecord}
          labelElement={"City"}
          columnRatio={0.6}
          columnInfo={{ isMinimumColumnSizeEnabled: true, minLabelWidth: 20, minValueWidth: 40, actionButtonWidth: 50 }}
        />);

      expect(propertyRenderer.childAt(0).get(0).props.style).to.have.property("gridTemplateColumns", "minmax(20px, 60%) minmax(40px, 1fr)");
    });

    it("renders two min width columns when onColumnRatioChanged callback is not provided", () => {
      const propertyRenderer = mount(
        <PropertyView
          orientation={Orientation.Horizontal}
          propertyRecord={propertyRecord}
          labelElement={"label"}
          columnInfo={{ isMinimumColumnSizeEnabled: true, minLabelWidth: 10, minValueWidth: 10, actionButtonWidth: 20 }}
        />);

      expect(propertyRenderer.childAt(0).get(0).props.style).to.have.property("gridTemplateColumns", "minmax(10px, 25%) minmax(10px, 1fr)");
    });

    it("renders three min width columns when orientation is horizontal and onColumnRatioChanged is provided", () => {
      const propertyRenderer = mount(
        <PropertyView
          orientation={Orientation.Horizontal}
          propertyRecord={propertyRecord}
          labelElement={"label"}
          onColumnRatioChanged={() => ({ ratio: 0.5 })}
          columnInfo={{ isMinimumColumnSizeEnabled: true, minLabelWidth: 30, minValueWidth: 45, actionButtonWidth: 60 }}
        />);

      expect(propertyRenderer.childAt(0).get(0).props.style).to.have.property("gridTemplateColumns", "minmax(30px, 25%) 1px minmax(45px, 1fr)");
    });

    it("renders four min width columns if orientation is horizontal and action button renderers are passed", async () => {
      const propertyRenderer = mount(
        <PropertyView
          orientation={Orientation.Horizontal}
          propertyRecord={propertyRecord}
          labelElement={"label"}
          onColumnRatioChanged={() => ({ ratio: 0.5 })}
          actionButtonRenderers={[(_) => undefined]}
          columnInfo={{ isMinimumColumnSizeEnabled: true, minLabelWidth: 30, minValueWidth: 45, actionButtonWidth: 60 }}
        />);

      expect(propertyRenderer.childAt(0).get(0).props.style).to.have.property("gridTemplateColumns", "minmax(30px, 25%) 1px minmax(45px, 1fr) 60px");
    });
  });

  it("renders single column if orientation is vertical and action button renderers are not provided", () => {
    const propertyRenderer = mount(
      <PropertyView
        orientation={Orientation.Vertical}
        propertyRecord={propertyRecord}
        labelElement={"label"}
        onColumnRatioChanged={() => ({ ratio: 0.5 })}
      />);

    expect(propertyRenderer.childAt(0).get(0).props.style).to.have.property("gridTemplateColumns", "auto");
  });

  it("renders two columns if orientation is vertical and action button renderers are provided", () => {
    const propertyRenderer = mount(
      <PropertyView
        orientation={Orientation.Vertical}
        propertyRecord={propertyRecord}
        labelElement={"label"}
        onColumnRatioChanged={() => ({ ratio: 0.5 })}
        actionButtonRenderers={[(_) => undefined]}
      />);

    expect(propertyRenderer.childAt(0).get(0).props.style).to.have.property("gridTemplateColumns", "auto auto");
  });

  it("renders two auto columns if orientation is vertical, action button renderers are provided and columnInfo is provided", () => {
    const propertyRenderer = mount(
      <PropertyView
        orientation={Orientation.Vertical}
        propertyRecord={propertyRecord}
        labelElement={"label"}
        onColumnRatioChanged={() => ({ ratio: 0.5 })}
        actionButtonRenderers={[(_) => undefined]}
        columnInfo={{ isMinimumColumnSizeEnabled: true, minLabelWidth: 30, minValueWidth: 45, actionButtonWidth: 60 }}
      />);

    expect(propertyRenderer.childAt(0).get(0).props.style).to.have.property("gridTemplateColumns", "auto auto");
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

  it("renders ElementSeparator when orientation is horizontal and onColumnRatioChanged is provided", () => {
    const propertyRenderer = mount(
      <PropertyView
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
        labelElement={"label"}
        onColumnRatioChanged={() => ({ ratio: 0.5 })}
      />);

    expect(propertyRenderer.childAt(0).hasClass("components-property-record--horizontal"), "class not found").to.be.true;
    expect(propertyRenderer.find(ElementSeparator).first().exists(), "ElementSeparator not found").to.be.true;
  });

  it("does not render ElementSeparator when onColumnRatioChanged is not provided", () => {
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

  it("renders as hoverable when isHoverable prop is true", () => {
    const propertyRenderer = mount(
      <PropertyView
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
        labelElement={"label"}
        isHoverable={true}
      />);

    expect(propertyRenderer.find(".components--hoverable").first().exists()).to.be.true;
  });

  it("changes state on hovering if set to hoverable", async () => {
    const propertyRenderer = mount(
      <PropertyView
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
        labelElement={"label"}
        isHoverable={true}
      />);
    expect(propertyRenderer.state("isHovered")).to.eq(false);
    propertyRenderer.simulate("mouseenter");
    expect(propertyRenderer.state("isHovered")).to.eq(true);
    propertyRenderer.simulate("mouseleave");
    expect(propertyRenderer.state("isHovered")).to.eq(false);
  });

  it("does not changes state on hovering if not set to hoverable", async () => {
    const propertyRenderer = mount(
      <PropertyView
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
        labelElement={"label"}
        isHoverable={false}
      />);
    expect(propertyRenderer.state("isHovered")).to.eq(false);
    propertyRenderer.simulate("mouseenter");
    expect(propertyRenderer.state("isHovered")).to.eq(false);
    propertyRenderer.simulate("mouseleave");
    expect(propertyRenderer.state("isHovered")).to.eq(false);
  });

  it("renders action button list if orientation is horizontal and action button renderers are passed", async () => {
    const propertyRenderer = mount(
      <PropertyView
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
        labelElement={"label"}
        onColumnRatioChanged={() => ({ ratio: 0.5 })}
        actionButtonRenderers={[(_) => undefined]}
      />);
    expect(propertyRenderer.find(".components-property-action-button-list--horizontal").first().exists()).to.be.true;
  });

  it("renders action button list if orientation is vertical and action button renderers are passed", () => {
    const propertyRenderer = mount(
      <PropertyView
        orientation={Orientation.Vertical}
        propertyRecord={propertyRecord}
        labelElement={"label"}
        onColumnRatioChanged={() => ({ ratio: 0.5 })}
        actionButtonRenderers={[(_) => undefined]}
      />);
    expect(propertyRenderer.find(".components-property-action-button-list--vertical").first().exists()).to.be.true;
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

  it("calls onContextMenu callback on property right click", () => {
    const callback = sinon.spy();
    const propertyRenderer = mount(
      <PropertyView
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
        onContextMenu={callback}
        labelElement={"label"}
      />);
    propertyRenderer.find(".components-property-record--horizontal").first().simulate("contextMenu");
    expect(callback).to.be.calledOnceWith(propertyRecord);
  });

  it("calls onRightClick callback on property right click", () => {
    const callback = sinon.spy();
    const propertyRenderer = mount(
      <PropertyView
        orientation={Orientation.Horizontal}
        propertyRecord={propertyRecord}
        onRightClick={callback}
        labelElement={"label"}
      />);
    propertyRenderer.find(".components-property-record--horizontal").first().simulate("contextMenu");
    expect(callback).to.be.calledOnceWith(propertyRecord);
  });

});
