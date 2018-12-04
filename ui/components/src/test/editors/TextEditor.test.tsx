/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { mount, shallow } from "enzyme";
import { expect } from "chai";
import { TextEditor } from "../../editors/TextEditor";
import TestUtils from "../TestUtils";

describe("<TextEditor />", () => {
  it("should render", () => {
    mount(<TextEditor />);
  });

  it("renders correctly", () => {
    shallow(<TextEditor />).should.matchSnapshot();
  });

  it("getValue returns proper value after componentDidMount & setState", (done) => {
    const record = TestUtils.createPrimitiveStringProperty("Test", "MyValue");
    const wrapper = mount(<TextEditor value={record} />);
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
    const record = TestUtils.createPrimitiveStringProperty("Test1", "MyValue");
    const wrapper = mount(<TextEditor value={record} />);
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
