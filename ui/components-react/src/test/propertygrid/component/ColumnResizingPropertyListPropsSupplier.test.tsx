/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import sinon from "sinon";
import { PropertyRecord } from "@itwin/appui-abstract";
import { Orientation } from "@itwin/core-react";
import { ColumnResizingPropertyListPropsSupplier } from "../../../components-react/propertygrid/component/ColumnResizingPropertyListPropsSupplier";
import { PropertyList } from "../../../components-react/propertygrid/component/PropertyList";
import TestUtils from "../../TestUtils";

describe("ColumnResizingPropertyListPropsSupplier", () => {

  let clock: sinon.SinonFakeTimers;
  let records: PropertyRecord[];

  const throttleMs = 16;
  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  beforeEach(() => {
    clock = sinon.useFakeTimers({ now: Date.now() });
    records = [TestUtils.createPrimitiveStringProperty("CADID", "0000 0005 00E0 02D8")];
  });

  afterEach(() => {
    clock.restore();
  });

  function moveElement(moveAmount: { clientX: number } | { clientY: number }, moveDelayMs: number = throttleMs) {
    document.dispatchEvent(new MouseEvent("pointermove", moveAmount));
    clock.tick(moveDelayMs);
  }

  describe("ratio between label and value when width below minimum column size", () => {

    it("changes label-value ratio when it's modified within bounds", () => {
      const propertyBlockMount = mount<ColumnResizingPropertyListPropsSupplier>(
        <ColumnResizingPropertyListPropsSupplier orientation={Orientation.Horizontal} width={100}>
          {(listProps) => <PropertyList {...listProps} properties={records} />}
        </ColumnResizingPropertyListPropsSupplier>,
      );

      expect(propertyBlockMount.state().columnRatio).to.be.eq(0.25);

      const elementSeparator = propertyBlockMount.find(".core-element-separator").first();
      elementSeparator.simulate("pointerdown", { clientX: 10 });
      moveElement({ clientX: 40 });
      document.dispatchEvent(new MouseEvent("pointerup"));

      expect(propertyBlockMount.state().columnRatio).to.be.eq(0.55);
    });

    it("changes label-value ratio to 0.15 when it's modified lower than allowed", () => {
      const propertyBlockMount = mount<ColumnResizingPropertyListPropsSupplier>(
        <ColumnResizingPropertyListPropsSupplier orientation={Orientation.Horizontal} width={100}>
          {(listProps) => <PropertyList {...listProps} properties={records} />}
        </ColumnResizingPropertyListPropsSupplier>,
      );

      expect(propertyBlockMount.state().columnRatio).to.be.eq(0.25);

      const elementSeparator = propertyBlockMount.find(".core-element-separator").first();
      elementSeparator.simulate("pointerdown", { clientX: 30 });
      moveElement({ clientX: 0 });
      document.dispatchEvent(new MouseEvent("pointerup"));

      expect(propertyBlockMount.state().columnRatio).to.be.eq(0.15);
    });

    it("changes label-value ratio to 0.6 when it's modified higher than allowed", () => {
      const propertyBlockMount = mount<ColumnResizingPropertyListPropsSupplier>(
        <ColumnResizingPropertyListPropsSupplier orientation={Orientation.Horizontal} width={100}>
          {(listProps) => <PropertyList {...listProps} properties={records} />}
        </ColumnResizingPropertyListPropsSupplier>,
      );

      expect(propertyBlockMount.state().columnRatio).to.be.eq(0.25);

      const elementSeparator = propertyBlockMount.find(".core-element-separator").first();
      elementSeparator.simulate("pointerdown", { clientX: 25 });
      moveElement({ clientX: 90 });
      document.dispatchEvent(new MouseEvent("pointerup"));

      expect(propertyBlockMount.state().columnRatio).to.be.eq(0.6);
    });
  });

  describe("ratio between label and value when width above minimum column size", () => {

    it("changes label-value ratio when it's modified within bounds", () => {
      const propertyBlockMount = mount<ColumnResizingPropertyListPropsSupplier>(
        <ColumnResizingPropertyListPropsSupplier
          orientation={Orientation.Horizontal}
          width={1000}
          minLabelWidth={100}
          minValueWidth={100}
          actionButtonWidth={100}
        >
          {(listProps) => <PropertyList {...listProps} properties={records} />}
        </ColumnResizingPropertyListPropsSupplier>,
      );

      expect(propertyBlockMount.state().columnRatio).to.be.eq(0.25);

      const elementSeparator = propertyBlockMount.find(".core-element-separator").first();
      elementSeparator.simulate("pointerdown", { clientX: 240 });
      moveElement({ clientX: 490 });
      document.dispatchEvent(new MouseEvent("pointerup"));

      expect(propertyBlockMount.state().columnRatio).to.be.eq(0.5);
    });

    it("changes label-value ratio to minimum label width when it's modified lower than allowed", () => {
      const propertyBlockMount = mount<ColumnResizingPropertyListPropsSupplier>(
        <ColumnResizingPropertyListPropsSupplier
          orientation={Orientation.Horizontal}
          width={1000}
          minLabelWidth={100}
          minValueWidth={100}
          actionButtonWidth={100}
        >
          {(listProps) => <PropertyList {...listProps} properties={records} />}
        </ColumnResizingPropertyListPropsSupplier>,
      );

      expect(propertyBlockMount.state().columnRatio).to.be.eq(0.25);

      const elementSeparator = propertyBlockMount.find(".core-element-separator").first();
      elementSeparator.simulate("pointerdown", { clientX: 255 });
      moveElement({ clientX: 0 });
      document.dispatchEvent(new MouseEvent("pointerup"));

      expect(propertyBlockMount.state().columnRatio).to.be.eq(0.1);
    });

    it("changes label-value ratio to maximum label width when it's modified higher than allowed", () => {
      const propertyBlockMount = mount<ColumnResizingPropertyListPropsSupplier>(
        <ColumnResizingPropertyListPropsSupplier
          orientation={Orientation.Horizontal}
          width={1000}
          minLabelWidth={100}
          minValueWidth={100}
          actionButtonWidth={100}
        >
          {(listProps) => <PropertyList {...listProps} properties={records} />}
        </ColumnResizingPropertyListPropsSupplier>,
      );

      expect(propertyBlockMount.state().columnRatio).to.be.eq(0.25);

      const elementSeparator = propertyBlockMount.find(".core-element-separator").first();
      elementSeparator.simulate("pointerdown", { clientX: 250 });
      moveElement({ clientX: 950 });
      document.dispatchEvent(new MouseEvent("pointerup"));

      expect(propertyBlockMount.state().columnRatio).to.be.eq(0.8);
    });

    it("stops changing label-value ratio after reaching max when element not hovered", () => {
      const propertyBlockMount = mount<ColumnResizingPropertyListPropsSupplier>(
        <ColumnResizingPropertyListPropsSupplier
          orientation={Orientation.Horizontal}
          width={1000}
          minLabelWidth={100}
          minValueWidth={100}
          actionButtonWidth={100}
        >
          {(listProps) => <PropertyList {...listProps} properties={records} />}
        </ColumnResizingPropertyListPropsSupplier>,
      );

      expect(propertyBlockMount.state().columnRatio).to.be.eq(0.25);

      const elementSeparator = propertyBlockMount.find(".core-element-separator").first();
      elementSeparator.simulate("pointerdown", { clientX: 250 });
      moveElement({ clientX: 950 });
      expect(propertyBlockMount.state().columnRatio).to.be.eq(0.8);

      moveElement({ clientX: 980 });
      moveElement({ clientX: 500 });
      document.dispatchEvent(new MouseEvent("pointerup"));

      expect(propertyBlockMount.state().columnRatio).to.be.eq(0.8);
    });

    it("stops changing label-value ratio after reaching min when element not hovered", () => {
      const propertyBlockMount = mount<ColumnResizingPropertyListPropsSupplier>(
        <ColumnResizingPropertyListPropsSupplier
          width={1000}
          orientation={Orientation.Horizontal}
          minLabelWidth={100}
          minValueWidth={100}
          actionButtonWidth={100}
        >
          {(listProps) => <PropertyList {...listProps} properties={records} />}
        </ColumnResizingPropertyListPropsSupplier>,
      );

      expect(propertyBlockMount.state().columnRatio).to.be.eq(0.25);

      const elementSeparator = propertyBlockMount.find(".core-element-separator").first();
      elementSeparator.simulate("pointerdown", { clientX: 250 });
      moveElement({ clientX: 10 });
      expect(propertyBlockMount.state().columnRatio).to.be.eq(0.1);

      moveElement({ clientX: 0 });
      moveElement({ clientX: 500 });
      document.dispatchEvent(new MouseEvent("pointerup"));

      expect(propertyBlockMount.state().columnRatio).to.be.eq(0.1);
    });
  });
});
