/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { mount, shallow } from "enzyme";
import { expect } from "chai";
import { TextEditor } from "../../src/editors/TextEditor";
import { PropertyValue, PropertyValueFormat, PropertyDescription, PropertyRecord } from "../../src/properties";

describe("<TextEditor />", () => {
  it("should render", () => {
    mount(<TextEditor />);
  });

  it("renders correctly", () => {
    shallow(<TextEditor />).should.matchSnapshot();
  });

  const createPropertyValue = (value?: string): PropertyValue => {
    const v: PropertyValue = {
      valueFormat: PropertyValueFormat.Primitive,
      displayValue: value ? value : "",
      value,
    };
    return v;
  };

  const createPropertyDescription = (): PropertyDescription => {
    const pd: PropertyDescription = {
      typename: "text",
      name: "key",
      displayLabel: "label",
    };
    return pd;
  };

  const createPropertyRecord = (value?: string): PropertyRecord => {
    const v = createPropertyValue(value);
    const pd = createPropertyDescription();
    return new PropertyRecord(v, pd);
  };

  it("getValue returns proper value after componentDidMount & setState", (done) => {
    const propertyRecord = createPropertyRecord("MyValue");
    const wrapper = mount(<TextEditor value={propertyRecord} />);
    setImmediate(() => {
      const textEditor = wrapper.instance() as TextEditor;
      expect(textEditor.getValue()).to.equal("MyValue");

      wrapper.unmount();
      done();
    }, 0);
  });

  it("getInputNode returns HTML input node", () => {
    const wrapper = mount(<TextEditor />);
    const textEditor = wrapper.instance() as TextEditor;
    expect(textEditor.getInputNode()).to.not.be.null;
    wrapper.unmount();
  });

  it("HTML input onChange updates value", () => {
    const propertyRecord = createPropertyRecord("MyValue");
    const wrapper = mount(<TextEditor value={propertyRecord} />);
    const textEditor = wrapper.instance() as TextEditor;
    const inputNode = wrapper.find("input");

    expect(inputNode.length).to.eq(1);
    if (inputNode) {
      const testValue = "My new value";
      inputNode.simulate("change", { target: { value: testValue } });
      wrapper.update();
      expect(textEditor.getValue()).to.equal(testValue);
    }
  });
});
