/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { mount, shallow } from "enzyme";
import { expect } from "chai";
import { EditorContainer } from "../../src/editors/EditorContainer";
import { PropertyValue, PropertyValueFormat, PropertyDescription, PropertyRecord } from "../../src/properties";

describe("<EditorContainer />", () => {
  it("should render", () => {
    mount(<EditorContainer title="abc" onCommit={() => { }} onCommitCancel={() => { }} />);
  });

  it("renders correctly", () => {
    shallow(<EditorContainer title="abc" onCommit={() => { }} onCommitCancel={() => { }} />).should.matchSnapshot();
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

  it("renders editor for 'text' type using TextEditor", () => {
    const propertyRecord = createPropertyRecord("my value");
    const handleCommit = () => { };
    const handleCommitCancel = () => { };
    const wrapper = mount(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={handleCommit} onCommitCancel={handleCommitCancel} />);
    const inputNode = wrapper.find("input");

    expect(inputNode).to.not.be.null;
    if (inputNode) {
      inputNode.simulate("blur");
      inputNode.simulate("keyDown", { keyCode: 37 }); // left arrow key
      inputNode.simulate("click");
      inputNode.simulate("contextMenu");

      inputNode.simulate("keyDown", { key: "Enter" });

      inputNode.simulate("keyDown", { key: "Escape" });

      inputNode.simulate("keyDown", { key: "Tab" });
    }
  });

});
