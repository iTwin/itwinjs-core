/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import enzyme from "enzyme"; const { mount } = enzyme;
import * as React from "react";
import sinon from "sinon";
import { PropertyRecord } from "@bentley/ui-abstract";
import { Orientation } from "@bentley/ui-core";
import { ColumnResizingPropertyListPropsSupplier } from "../../../ui-components/propertygrid/component/ColumnResizingPropertyListPropsSupplier.js";
import { PropertyList } from "../../../ui-components/propertygrid/component/PropertyList.js";
import TestUtils from "../../TestUtils.js";

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
    const getBoundingClientRect = Element.prototype.getBoundingClientRect;

    before(() => {
      Element.prototype.getBoundingClientRect = () => ({
        bottom: 0,
        height: 0,
        left: 0,
        right: 0,
        toJSON: () => { },
        top: 0,
        width: 100,
        x: 0,
        y: 0,
      });
    });

    after(() => {
      Element.prototype.getBoundingClientRect = getBoundingClientRect;
    });

    it("changes label-value ratio when it's modified within bounds", () => {
      const propertyBlockMount = mount<ColumnResizingPropertyListPropsSupplier>(
        <ColumnResizingPropertyListPropsSupplier orientation={Orientation.Horizontal}>
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
        <ColumnResizingPropertyListPropsSupplier orientation={Orientation.Horizontal}>
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
        <ColumnResizingPropertyListPropsSupplier orientation={Orientation.Horizontal}>
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
    const getBoundingClientRect = Element.prototype.getBoundingClientRect;

    before(() => {
      Element.prototype.getBoundingClientRect = () => ({
        bottom: 0,
        height: 0,
        left: 0,
        right: 0,
        toJSON: () => { },
        top: 0,
        width: 1000,
        x: 0,
        y: 0,
      });
    });

    after(() => {
      Element.prototype.getBoundingClientRect = getBoundingClientRect;
    });

    it("changes label-value ratio when it's modified within bounds", () => {
      const propertyBlockMount = mount<ColumnResizingPropertyListPropsSupplier>(
        <ColumnResizingPropertyListPropsSupplier
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
      elementSeparator.simulate("pointerdown", { clientX: 240 });
      moveElement({ clientX: 490 });
      document.dispatchEvent(new MouseEvent("pointerup"));

      expect(propertyBlockMount.state().columnRatio).to.be.eq(0.5);
    });

    it("changes label-value ratio to minimum label width when it's modified lower than allowed", () => {
      const propertyBlockMount = mount<ColumnResizingPropertyListPropsSupplier>(
        <ColumnResizingPropertyListPropsSupplier
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
      elementSeparator.simulate("pointerdown", { clientX: 255 });
      moveElement({ clientX: 0 });
      document.dispatchEvent(new MouseEvent("pointerup"));

      expect(propertyBlockMount.state().columnRatio).to.be.eq(0.1);
    });

    it("changes label-value ratio to maximum label width when it's modified higher than allowed", () => {
      const propertyBlockMount = mount<ColumnResizingPropertyListPropsSupplier>(
        <ColumnResizingPropertyListPropsSupplier
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
      moveElement({ clientX: 950 });
      document.dispatchEvent(new MouseEvent("pointerup"));

      expect(propertyBlockMount.state().columnRatio).to.be.eq(0.8);
    });

    it("stops changing label-value ratio after reaching max when element not hovered", () => {
      const propertyBlockMount = mount<ColumnResizingPropertyListPropsSupplier>(
        <ColumnResizingPropertyListPropsSupplier
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
