/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { mount, shallow } from "enzyme";
import { expect } from "chai";
import { TextEditor } from "../../ui-components/editors/TextEditor";
import TestUtils from "../TestUtils";

describe("<TextEditor />", () => {
  it("should render", () => {
    mount(<TextEditor />);
  });

  it("renders correctly", () => {
    shallow(<TextEditor />).should.matchSnapshot();
  });

  it("getValue returns proper value after componentDidMount & setState", async () => {
    const record = TestUtils.createPrimitiveStringProperty("Test", "MyValue");
    const wrapper = mount(<TextEditor propertyRecord={record} />);

    await TestUtils.flushAsyncOperations();
    const textEditor = wrapper.instance() as TextEditor;
    expect(textEditor.getValue()).to.equal("MyValue");

    wrapper.unmount();
  });

  it("HTML input onChange updates value", () => {
    const record = TestUtils.createPrimitiveStringProperty("Test1", "MyValue");
    const wrapper = mount(<TextEditor propertyRecord={record} />);
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

  it("componentDidUpdate updates the value", async () => {
    const record = TestUtils.createPrimitiveStringProperty("Test", "MyValue");
    const wrapper = mount(<TextEditor propertyRecord={record} />);

    await TestUtils.flushAsyncOperations();
    const textEditor = wrapper.instance() as TextEditor;
    expect(textEditor.getValue()).to.equal("MyValue");

    const testValue = "MyNewValue";
    const newRecord = TestUtils.createPrimitiveStringProperty("Test", testValue);
    wrapper.setProps({ propertyRecord: newRecord });
    await TestUtils.flushAsyncOperations();
    expect(textEditor.getValue()).to.equal(testValue);

    wrapper.unmount();
  });
});
