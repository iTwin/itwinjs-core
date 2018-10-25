/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import { Orientation } from "@bentley/ui-core";
import { SamplePropertyRecord } from "../PropertyTestHelpers";
import { SelectablePropertyBlock, SelectablePropertyBlockProps, SelectablePropertyBlockState } from "../../../src/propertygrid/component/SelectablePropertyBlock";
import TestUtils from "../../TestUtils";
import { getPropertyKey } from "../../../src/propertygrid/component/PropertyList";

describe("SelectablePropertyBlock", () => {
  let props: SelectablePropertyBlockProps;

  before(() => {
    TestUtils.initializeUiComponents();
  });

  beforeEach(() => {
    props = {
      orientation: Orientation.Horizontal,
      properties: [new SamplePropertyRecord("CADID", 0, "0000 0005 00E0 02D8")],
      category: {
        name: "Category1",
        label: "Category 1",
        expand: false,
      },
      selectedPropertyKey: "",
    };
  });

  describe("getDerivedStateFromProps", () => {
    const doesKeyMatchAnyPropertyFunc = SelectablePropertyBlock.doesKeyMatchAnyProperty;

    before(() => {
      SelectablePropertyBlock.doesKeyMatchAnyProperty = () => true;
    });

    after(() => {
      SelectablePropertyBlock.doesKeyMatchAnyProperty = doesKeyMatchAnyPropertyFunc;
    });

    it("returns state, with property keyMatched as true", () => {

      const derivedState = SelectablePropertyBlock.getDerivedStateFromProps(props);

      expect(derivedState.keyMatched).to.be.true;
    });
  });

  describe("doesKeyMatchAnyProperty", () => {
    it("returns false if key is undefined", () => {
      const matches = SelectablePropertyBlock.doesKeyMatchAnyProperty(props, undefined);
      expect(matches).to.be.false;
    });

    it("returns true if key did match something", () => {
      props.category.name = "miscellaneous";
      props.properties = [
        new SamplePropertyRecord("label", 0, "0000 0005 00E0 02D8"),
        new SamplePropertyRecord("model", 0, "0000 0005 00E0 02D8"),
      ];

      const key = getPropertyKey(props.category, props.properties[1]);

      const matches = SelectablePropertyBlock.doesKeyMatchAnyProperty(props, key);
      expect(matches).to.be.true;
    });

    it("returns false if key did not match anything", () => {
      props.category.name = "miscellaneous";
      props.properties = [
        new SamplePropertyRecord("label", 0, "0000 0005 00E0 02D8"),
        new SamplePropertyRecord("model", 0, "0000 0005 00E0 02D8"),
      ];

      const key = "wrongkey";

      const matches = SelectablePropertyBlock.doesKeyMatchAnyProperty(props, key);
      expect(matches).to.be.false;
    });
  });

  describe("shouldComponentUpdate", () => {
    it("returns false when props have not changed", () => {
      const component = new SelectablePropertyBlock(props);

      expect(component.shouldComponentUpdate(component.props, component.state)).to.be.false;
    });

    it("returns true if props have changed", () => {
      const component = new SelectablePropertyBlock(props);
      const nextProps = Object.assign({}, props);
      nextProps.orientation = Orientation.Vertical;

      expect(component.shouldComponentUpdate(nextProps, component.state)).to.be.true;
    });

    it("returns false if selectedKey has changed but selection happened in a different category and didn't have a selection before", () => {
      const component = new SelectablePropertyBlock(props);
      const nextProps = Object.assign({}, props);
      nextProps.selectedPropertyKey = "randomKey";
      const nextState: SelectablePropertyBlockState = { keyMatched: false, columnRatio: 0.25 };

      expect(component.shouldComponentUpdate(nextProps, nextState)).to.be.false;
    });

    it("returns true if selectedKey has changed but selection happened in a different category and this category got deselected", () => {
      const component = new SelectablePropertyBlock(props);
      const nextProps = Object.assign({}, props);
      nextProps.selectedPropertyKey = "randomKey";
      component.state = { keyMatched: true, columnRatio: 0.25 };
      const nextState: SelectablePropertyBlockState = { keyMatched: false, columnRatio: 0.25 };

      expect(component.shouldComponentUpdate(nextProps, nextState)).to.be.true;
    });

    it("returns true if selectedKey has changed in this category", () => {
      const component = new SelectablePropertyBlock(props);
      const nextProps = Object.assign({}, props);
      nextProps.selectedPropertyKey = "randomKey";
      component.state = { keyMatched: true, columnRatio: 0.25 };
      const nextState: SelectablePropertyBlockState = { keyMatched: true, columnRatio: 0.25 };

      expect(component.shouldComponentUpdate(nextProps, nextState)).to.be.true;
    });
  });

  describe("ratio between label and value", () => {
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
      props.category.expand = true;

      const propertyBlockMount = mount(<SelectablePropertyBlock {...props} />);

      expect((propertyBlockMount.state("columnRatio") as number)).to.be.eq(0.25);

      const elementSeparator = propertyBlockMount.find(".core-element-separator").first();
      elementSeparator.simulate("pointerdown", { clientX: 10 });
      document.dispatchEvent(new MouseEvent("pointermove", { clientX: 40 }));
      document.dispatchEvent(new MouseEvent("pointerup"));

      expect((propertyBlockMount.state("columnRatio") as number)).to.be.eq(0.55);
    });

    it("changes label-value ratio to 0.15 when it's modified lower than allowed", () => {
      props.category.expand = true;

      const propertyBlockMount = mount(<SelectablePropertyBlock {...props} />);

      expect((propertyBlockMount.state("columnRatio") as number)).to.be.eq(0.25);

      const elementSeparator = propertyBlockMount.find(".core-element-separator").first();
      elementSeparator.simulate("pointerdown", { clientX: 30 });
      document.dispatchEvent(new MouseEvent("pointermove", { clientX: 0 }));
      document.dispatchEvent(new MouseEvent("pointerup"));

      expect((propertyBlockMount.state("columnRatio") as number)).to.be.eq(0.15);
    });

    it("changes label-value ratio to 0.6 when it's modified higher than allowed", () => {
      props.category.expand = true;

      const propertyBlockMount = mount(<SelectablePropertyBlock {...props} />);

      expect((propertyBlockMount.state("columnRatio") as number)).to.be.eq(0.25);

      const elementSeparator = propertyBlockMount.find(".core-element-separator").first();
      elementSeparator.simulate("pointerdown", { clientX: 25 });
      document.dispatchEvent(new MouseEvent("pointermove", { clientX: 90 }));
      document.dispatchEvent(new MouseEvent("pointerup"));

      expect((propertyBlockMount.state("columnRatio") as number)).to.be.eq(0.6);
    });
  });

});
