/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
// import { mount } from "enzyme";
// import * as React from "react";
import { Orientation } from "@bentley/ui-core";
import { SamplePropertyRecord } from "../PropertyTestHelpers";
import { SelectablePropertyBlock, SelectablePropertyBlockProps, SelectablePropertyBlockState } from "../../../src/propertygrid/component/SelectablePropertyBlock";

describe("SelectablePropertyBlock", () => {
  let props: SelectablePropertyBlockProps;

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

      const key = SelectablePropertyBlock.getPropertyKey(props.category, props.properties[1]);

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
      const nextState: SelectablePropertyBlockState = { keyMatched: false };

      expect(component.shouldComponentUpdate(nextProps, nextState)).to.be.false;
    });

    it("returns true if selectedKey has changed but selection happened in a different category and this category got deselected", () => {
      const component = new SelectablePropertyBlock(props);
      const nextProps = Object.assign({}, props);
      nextProps.selectedPropertyKey = "randomKey";
      component.state = { keyMatched: true };
      const nextState: SelectablePropertyBlockState = { keyMatched: false };

      expect(component.shouldComponentUpdate(nextProps, nextState)).to.be.true;
    });

    it("returns true if selectedKey has changed in this category", () => {
      const component = new SelectablePropertyBlock(props);
      const nextProps = Object.assign({}, props);
      nextProps.selectedPropertyKey = "randomKey";
      component.state = { keyMatched: true };
      const nextState: SelectablePropertyBlockState = { keyMatched: true };

      expect(component.shouldComponentUpdate(nextProps, nextState)).to.be.true;
    });
  });
});
